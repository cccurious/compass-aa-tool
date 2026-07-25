import {
  LIMIT_SAFE,
  LIMIT_FORCE,
  MARGIN,
  textWidth,
  charWidth,
  isKnownWidth,
  UNUSABLE_CHARS,
  FILTERED_SEQUENCES,
} from './metrics';
import { simulateWrap, SimLine } from './wrap';

/**
 * 複数行 AA → スペーサー付き 1 行テキスト変換（v1・実機検証済みモデル）。
 *
 * 実機規則（2026-07-25 ラウンド 2 で確定）:
 * - 折り返し点の半角スペースは行末・次行頭とも消える（痕跡ゼロ）
 * - 全角スペースはキャリーされる＝行頭の字下げは各行の先頭に書けばよい
 *
 * よって各行末に半角スペースを「確実に折れる幅（LIMIT_FORCE）」まで詰めるだけで
 * よく、キャリーオーバー計算は不要。余ったスペースは実機側が消してくれる。
 *
 * 保証条件: 各行のコンテンツ幅が LIMIT_SAFE 以下であること
 * （超えると未確定帯 [SAFE, FORCE) で実機の折り返しが予測不能）。
 */
export interface ConvertResultLine {
  /** 元の入力行 */
  source: string;
  /** 付与したスペーサー文字列 */
  padding: string;
}

export interface ConvertResult {
  /** ゲームチャットへ貼る 1 行テキスト */
  output: string;
  lines: ConvertResultLine[];
  /** 出力を折り返しシミュレータへ通した結果（プレビュー用） */
  preview: SimLine[];
  /** 幅が LIMIT_SAFE を超え、表示保証ができない入力行番号（0 始まり） */
  overflowLines: number[];
  /** 行頭が半角スペースの入力行番号（実機では消えて字下げにならない） */
  leadingSpaceLines: number[];
  /**
   * 幅が実測できていない文字を含む行番号と該当文字。
   * 幅推測がずれると折り返し位置が狂い、Word Wrap 巻き戻しで
   * 行の途中が次行へ落ちる（2026-07-25 ⌒ 未収載時に実機で発生）
   */
  unknownWidthLines: { line: number; chars: string[] }[];
  /** 実機で消えるため取り除いた文字（行番号つき） */
  removedLines: { line: number; chars: string[] }[];
  /** 隣接すると別の文字に置換される並びを含む行 */
  filteredSequenceLines: { line: number; sequences: string[] }[];
}

const HALF_SPACE_W = charWidth(' ');

export function convert(input: string): ConvertResult {
  const rawLines = input.replace(/\r\n/g, '\n').split('\n');
  const lines: ConvertResultLine[] = [];
  const overflowLines: number[] = [];
  const leadingSpaceLines: number[] = [];
  const unknownWidthLines: { line: number; chars: string[] }[] = [];
  const removedLines: { line: number; chars: string[] }[] = [];
  const filteredSequenceLines: { line: number; sequences: string[] }[] = [];
  let output = '';

  // 前処理はここだけで行い、本処理も次行の先読みも「サニタイズ済みの行」しか見ない。
  // 生の行を先読みすると、送信時に消える文字の幅まで数えて 1 文字ブレークが
  // 誤発火・不発火する（インシデント #1/#2 と同型の行転落になる）
  const srcLines = rawLines.map((raw) => {
    const removed = [...new Set(Array.from(raw).filter((c) => UNUSABLE_CHARS.has(c)))];
    const stripped =
      removed.length > 0
        ? Array.from(raw)
            .filter((c) => !UNUSABLE_CHARS.has(c))
            .join('')
        : raw;
    // 半角スペースのみ（または空）の行は折り返し点で丸ごと消えるため、
    // 全角スペース 1 個の「見た目空行」に置き換えて行を存続させる
    return { text: /^ *$/.test(stripped) ? '　' : stripped, removed };
  });

  srcLines.forEach(({ text: src, removed }, i) => {
    const isLast = i === srcLines.length - 1;
    if (removed.length > 0) removedLines.push({ line: i, chars: removed });
    const seqs = FILTERED_SEQUENCES.filter((seq) => src.includes(seq));
    if (seqs.length > 0) filteredSequenceLines.push({ line: i, sequences: seqs });
    if (/^ /.test(src)) leadingSpaceLines.push(i);
    const unknown = [...new Set(Array.from(src).filter((c) => !isKnownWidth(c)))];
    if (unknown.length > 0) unknownWidthLines.push({ line: i, chars: unknown });
    const contentW = textWidth(src);
    if (contentW > LIMIT_SAFE) overflowLines.push(i);

    let padding = '';
    if (!isLast) {
      // 【1 文字ブレーク最適化】実機の語先読み改行を逆用する（2026-07-25）:
      // 半角スペースの直後の語（次行頭〜次の半角スペースまで・全角スペース込み）が
      // 行の残り幅に入らないなら、その場で改行される。条件を満たす行境界は
      // 半角スペース 1 個だけで改行が成立し、パディング約 20 文字を節約できる。
      // 幅未確認文字が絡む場合は誤発火防止のため通常パディングへ回す
      const nextChars = Array.from(srcLines[i + 1].text);
      const spIdx = nextChars.indexOf(' ');
      const firstWord = nextChars.slice(0, spIdx === -1 ? undefined : spIdx).join('');
      const boundaryKnown =
        unknown.length === 0 && Array.from(firstWord).every((c) => isKnownWidth(c));
      const nextW = textWidth(firstWord);
      if (boundaryKnown && contentW + HALF_SPACE_W + nextW > LIMIT_FORCE + MARGIN.BREAK_FIRE) {
        // そのまま発火する境界: 半角スペース 1 個で改行が成立（最安）
        lines.push({ source: src, padding: ' ' });
        output += src + ' ';
        return;
      }
      if (boundaryKnown) {
        // 発火に足りない分だけ全角スペースで底上げしてから改行させる。
        // 構造は「半角 1 ＋ 全角 n ＋ 半角 1」で、先頭の半角がコンテンツ末尾の語と
        // 全角列の癒着を切る（これが無いとインシデント#1 の jj 転落が再発する）。
        // 全角列は行内に留めるだけでよく、LIMIT_SAFE まで埋める必要がない点が
        // 通常パディング（約 24−幅 文字）との差。幅 10 以下の AA が救われる
        // （実測: 幅 10 は 7 行が限界だったのに対し幅 11 は 15 行という崖があった）
        const need = LIMIT_FORCE + MARGIN.BREAK_FIRE - contentW - HALF_SPACE_W * 2 - nextW;
        const nFullTail = Math.max(0, Math.ceil(need));
        // 全角列を置いても行内に留まること（−0.5 は幅誤差マージン）
        if (contentW + HALF_SPACE_W + nFullTail <= LIMIT_SAFE - MARGIN.LINE_KEEP) {
          const tail = ' ' + '　'.repeat(nFullTail) + ' ';
          lines.push({ source: src, padding: tail });
          output += src + tail;
          return;
        }
      }
      // パディング構造: 「半角スペース 1 ＋ 全角スペース列 ＋ 半角スペース列」
      //
      // 先頭の半角スペース 1 個が肝（インシデント#1/#2 の恒久対策）:
      // 実機の Word Wrap は半角スペースで「次の半角スペースまでの塊」の幅を先読みし、
      // 残り幅に入らなければその場で改行する。全角スペースは塊を切らないため、
      // これが無いとコンテンツ末尾の語（例: jj）に全角スペース列が癒着して
      // 巨大な 1 語になり、コンテンツ内の手前のスペースで改行されて形が崩れる。
      //
      // 全角列は LIMIT_SAFE 以下に収めて行内に留め（文字数節約）、
      // 半角列で LIMIT_FORCE を跨がせて折り返し点で実機側に消してもらう
      // −1 は幅誤差マージン: 欧文フォールバック等でコンテンツ実幅が計算より
      // 最大 1.0 字分広くても、全角列の語判定（先読み）が「入らない」に落ちて
      // 全角列ごと次行へ転落する事故を防ぐ（2026-07-25 レトリバー ´´ 行ずれの対策）
      const nFull = Math.max(
        0,
        Math.floor(LIMIT_SAFE - contentW - HALF_SPACE_W) - MARGIN.FULL_COLUMN_KEEP,
      );
      const used = contentW + HALF_SPACE_W + nFull;
      // 端数マージン: 幅が全て実測済みの行は +1 で足りる。幅未確認の文字を
      // 含む行だけ +3（約 0.7 字分）の保険を残す（文字数節約・2026-07-25）。
      // 超過行（警告済み）は詰め物なしで自力折り返しに任せる
      const margin = unknown.length > 0 ? MARGIN.TAIL_UNKNOWN : MARGIN.TAIL_KNOWN;
      const nHalf = Math.max(0, Math.ceil((LIMIT_FORCE - used) / HALF_SPACE_W) + margin);
      padding = ' ' + '　'.repeat(nFull) + ' '.repeat(nHalf);
    }

    lines.push({ source: src, padding });
    output += src + padding;
  });

  return {
    output,
    lines,
    preview: simulateWrap(output),
    overflowLines,
    leadingSpaceLines,
    unknownWidthLines,
    removedLines,
    filteredSequenceLines,
  };
}
