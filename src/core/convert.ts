import {
    LIMIT_SAFE,
    LIMIT_FORCE,
    MARGIN,
    textWidth,
    charWidth,
    isKnownWidth,
    classifyChar,
    UNUSABLE_CHARS,
    FILTERED_SEQUENCES,
    UNSAFE_DISPLAY_CHARS,
    DEVICE_RISK_CHARS,
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
    /**
     * 幅未確認のうち、層 2 の予測（Noto 直読み＋iOS ブラウザ走査）で
     * 「全角で出ない」と出た文字。未確認の中でも崩れる可能性が高い
     */
    unknownRiskLines: { line: number; chars: string[] }[];
    /** 実機で消えるため取り除いた文字（行番号つき） */
    removedLines: { line: number; chars: string[] }[];
    /** 隣接すると別の文字に置換される並びを含む行 */
    filteredSequenceLines: { line: number; sequences: string[] }[];
    /** 端末（iOS/Android）で見え方が変わる文字を含む行 */
    deviceVariantLines: { line: number; chars: string[] }[];
    /**
     * 半角文字が多く、端末による幅のブレで折り返し位置が変わりうる行。
     * 全角だけの行は端末差の影響を受けないため、ここには入らない。
     */
    deviceWrapRiskLines: number[];
}

const HALF_SPACE_W = charWidth(' ');

/**
 * 「実測確定で幅ちょうど 1.0」の文字だけか（全角充填パディングの適用条件）。
 * 幅が正確に整数なので、行幅を 20.0 ぴったりに作れて誤差マージンが要らない。
 * 半角・幅未確認・実測 0.8 等の端数文字が混ざる行は従来のスペース式へ回す
 */
const isExactFull = (c: string) => charWidth(c) === 1.0 && classifyChar(c).verified;

export function convert(input: string): ConvertResult {
    const rawLines = input.replace(/\r\n/g, '\n').split('\n');
    const lines: ConvertResultLine[] = [];
    const overflowLines: number[] = [];
    const leadingSpaceLines: number[] = [];
    const unknownWidthLines: { line: number; chars: string[] }[] = [];
    const unknownRiskLines: { line: number; chars: string[] }[] = [];
    const removedLines: { line: number; chars: string[] }[] = [];
    const filteredSequenceLines: { line: number; sequences: string[] }[] = [];
    const deviceVariantLines: { line: number; chars: string[] }[] = [];
    const deviceWrapRiskLines: number[] = [];
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
        const variants = [...new Set(Array.from(src).filter((c) => UNSAFE_DISPLAY_CHARS.has(c)))];
        if (variants.length > 0) deviceVariantLines.push({ line: i, chars: variants });
        // 端末差の警告を出す文字は、そちらで説明済みなので幅未確認の警告からは外す
        // （同じ文字で 2 つ警告が並ぶと、どちらに従えばよいか分からなくなる）
        const unknown = [
            ...new Set(
                Array.from(src).filter((c) => !isKnownWidth(c) && !UNSAFE_DISPLAY_CHARS.has(c)),
            ),
        ];
        // unknown はマージン計算（TAIL_UNKNOWN 等）用に全量を保ち、報告だけ二分する
        const unknownRisk = unknown.filter((ch) => DEVICE_RISK_CHARS.has(ch));
        const unknownMild = unknown.filter((ch) => !DEVICE_RISK_CHARS.has(ch));
        if (unknownRisk.length > 0) unknownRiskLines.push({ line: i, chars: unknownRisk });
        if (unknownMild.length > 0) unknownWidthLines.push({ line: i, chars: unknownMild });
        const contentW = textWidth(src);
        if (contentW > LIMIT_SAFE) overflowLines.push(i);
        // 端末差の余裕を見ても行に収まるか。半角が多くて幅が上限に近い行は、
        // 別の端末だと 1 行に収まらず勝手に折り返される（＝形が崩れる）
        const halfInLine = Array.from(src).filter((c) => c !== '　' && charWidth(c) < 1.0).length;
        if (contentW <= LIMIT_SAFE && contentW + halfInLine * MARGIN.HALF_DRIFT > LIMIT_SAFE) {
            deviceWrapRiskLines.push(i);
        }

        let padding = '';
        if (!isLast) {
            // 【全角充填パディング】units 再校正後の最優先戦略（2026-07-25）:
            // 上限は units ≤ 271 で半角スペースは 1 個 16 も食うため、スペースを
            // 使わない改行が最安になった。行の全文字と次行頭の文字が「実測確定で
            // 幅ちょうど 1.0」なら、全角スペースで行幅を 20.0 に満たすだけで
            // 次行頭の文字が文字単位折り返しで自然に落ちる（実機確認済み:
            // あ×15＋全角 sp×5＋い×20 → い は字下げなしで行頭に立つ）。
            // 幅誤差ゼロなのでマージン不要: 20 ≤ SAFE(20.476)・20+1 > FORCE(20.548)。
            // 幅 20 ちょうどの行はパディング 0 文字＝境界コスト完全ゼロ。
            // 全角の追加は units と同時に文字数も増やすため、全角 16 個以上に
            // なる境界（=1 文字ブレーク以上のコスト）では発火可能なら半角 1 個を選ぶ
            const srcChars = Array.from(src);
            const nextLineChars = Array.from(srcLines[i + 1].text);
            const zeroOk =
                srcChars.length <= 20 &&
                srcChars.every(isExactFull) &&
                nextLineChars.length > 0 &&
                isExactFull(nextLineChars[0]);
            const nZero = 20 - srcChars.length;

            // 【1 文字ブレーク最適化】実機の語先読み改行を逆用する（2026-07-25）:
            // 半角スペースの直後の語（次行頭〜次の半角スペースまで・全角スペース込み）が
            // 行の残り幅に入らないなら、その場で改行される。条件を満たす行境界は
            // 半角スペース 1 個だけで改行が成立し、パディング約 20 文字を節約できる。
            // 幅未確認文字が絡む場合は誤発火防止のため通常パディングへ回す
            const spIdx = nextLineChars.indexOf(' ');
            const firstWord = nextLineChars.slice(0, spIdx === -1 ? undefined : spIdx).join('');
            const boundaryKnown =
                unknown.length === 0 && Array.from(firstWord).every((c) => isKnownWidth(c));
            const nextW = textWidth(firstWord);
            const oneCharFires =
                boundaryKnown && contentW + HALF_SPACE_W + nextW > LIMIT_FORCE + MARGIN.BREAK_FIRE;

            if (zeroOk && (nZero < 16 || !oneCharFires)) {
                // 全角充填が最安（16 units 未満）か、他に無スペース手段がない
                const tail = '　'.repeat(nZero);
                lines.push({ source: src, padding: tail });
                output += src + tail;
                return;
            }
            if (oneCharFires) {
                // そのまま発火する境界: 半角スペース 1 個で改行が成立
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
            // 半角文字は端末ごとに幅が微妙に違う（iPhone で t の折り返しが 1 個ずれた
            // 実測報告）。誤差は行内の半角の個数だけ累積し、足りないと「改行が起きず
            // 2 行が繋がる」という一番痛い壊れ方をするので、その行だけ端数を厚くする
            const halfCount = Array.from(src).filter(
                (c) => c !== '　' && charWidth(c) < 1.0,
            ).length;
            const driftMargin = Math.ceil((halfCount * MARGIN.HALF_DRIFT) / HALF_SPACE_W);
            const margin =
                (unknown.length > 0 ? MARGIN.TAIL_UNKNOWN : MARGIN.TAIL_KNOWN) + driftMargin;
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
        unknownRiskLines,
        removedLines,
        filteredSequenceLines,
        deviceVariantLines,
        deviceWrapRiskLines,
    };
}
