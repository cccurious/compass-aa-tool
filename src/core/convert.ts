import { LIMIT_SAFE, LIMIT_FORCE, textWidth, charWidth, isKnownWidth } from './metrics';
import { simulateWrap, SimLine } from './wrap';
import { normalizeRow, NormalizedChange } from './normalize';

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
  /** 実機の自動変換を先取りした置換（例: `.` → `．`）。行番号つき */
  normalizedChanges: NormalizedChange[];
}

const HALF_SPACE_W = charWidth(' ');

export function convert(input: string): ConvertResult {
  const srcLines = input.replace(/\r\n/g, '\n').split('\n');
  const lines: ConvertResultLine[] = [];
  const overflowLines: number[] = [];
  const leadingSpaceLines: number[] = [];
  const unknownWidthLines: { line: number; chars: string[] }[] = [];
  let output = '';

  const normalizedChanges: NormalizedChange[] = [];

  srcLines.forEach((rawInput, i) => {
    const isLast = i === srcLines.length - 1;
    // 実機の自動変換（. → ． 等）を先取り。変換後の文字で幅計算しないと
    // 実機とパディングがずれる（2026-07-25 実機コピーバックで発覚）
    const { text: raw, changes } = normalizeRow(rawInput, i);
    normalizedChanges.push(...changes);
    // 半角スペースのみ（または空）の行は折り返し点で丸ごと消えるため、
    // 全角スペース 1 個の「見た目空行」に置き換えて行を存続させる
    const src = /^ *$/.test(raw) ? '　' : raw;
    if (/^ /.test(src)) leadingSpaceLines.push(i);
    const unknown = [...new Set(Array.from(src).filter((c) => !isKnownWidth(c)))];
    if (unknown.length > 0) unknownWidthLines.push({ line: i, chars: unknown });
    const contentW = textWidth(src);
    if (contentW > LIMIT_SAFE) overflowLines.push(i);

    let padding = '';
    if (!isLast) {
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
      const nFull = Math.max(0, Math.floor(LIMIT_SAFE - contentW - HALF_SPACE_W));
      const used = contentW + HALF_SPACE_W + nFull;
      // +3 は端数＋幅誤差の安全マージン（約 0.7 字分）。
      // 超過行（警告済み）は詰め物なしで自力折り返しに任せる
      const nHalf = Math.max(0, Math.ceil((LIMIT_FORCE - used) / HALF_SPACE_W) + 3);
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
    normalizedChanges,
  };
}
