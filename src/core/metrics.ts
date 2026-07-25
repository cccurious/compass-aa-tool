/**
 * 文字幅テーブルと折り返ししきい値。
 *
 * 実機フォントモデル（2026-07-25 R1〜R6 の実機プローブで確定した 3 層構造）:
 * 1. かな・漢字・全角記号・全角スペース = 固定 1.0（R6-1/2/3: う・＾・＿が全て 20 個/行）
 * 2. 半角（ASCII・半角カナ）= BIZ UDPGothic のプロポーショナル幅
 *    （R5-3: j=0.39 が BIZ の 0.388 と一致。R6-4: 半角スペース 0.34 も BIZ 値）
 * 3. ゲームのフォントアトラスに無い文字 = 全角 1.0 フォールバック
 *    （R5-1: ´ が 1.0。BIZ 自体は 0.51 なのに実機は 1.0 ＝アトラス収録漏れ）
 *
 * 数値の由来は docs/notes/calibration-plan.md。実測確定値は DEVICE_OVERRIDES が最優先。
 */
import biz from './font-widths.json';

/** 折り返し・半角幅は実機校正済み。層 3（どの文字がアトラス漏れか）のみ逐次発見 */
export const CALIBRATED = true;

/**
 * 1 行の折り返ししきい値（全角 1 文字 = 1.0 単位）。
 * R5-3（j×27 が 1 行に収まる）と R2〜R3 の挟み撃ちで L ∈ [20.476, 20.548)。
 * - LIMIT_SAFE 以下なら「折れない」を保証（コンテンツ行の上限）
 * - LIMIT_FORCE 以上なら「折れる」を保証（パディングの到達目標)
 */
export const LIMIT_SAFE = 20.476;
export const LIMIT_FORCE = 20.548;
/** プレビュー用の代表値（未確定帯の中央。生成側は SAFE/FORCE のみを使う） */
export const LINE_LIMIT = (LIMIT_SAFE + LIMIT_FORCE) / 2;

/**
 * 送信上限の判定は core/limit.ts へ移した（折り返しの発生位置に依存するため、
 * 幅テーブルだけでは決まらない）。ここは幅と分類の責務に専念する。
 */

/**
 * 生成側の安全マージン（実機モデル由来の数値なのでここに集約する）。
 * - BREAK_FIRE: 先読みが「入らない」に確実に落ちるための上乗せ。
 *   幅推定が多少ずれても 1 文字ブレークが不発にならない
 * - LINE_KEEP: 行末の全角列が行内に留まることを保証する引き算。
 *   ここを削ると全角列ごと次行へ転落する（レトリバー ´´ 行のずれ）
 * - TAIL_KNOWN / TAIL_UNKNOWN: 半角スペース列の端数。幅が全て実測済みなら 1 個、
 *   未確認文字を含む行は保険を厚くして 3 個
 */
export const MARGIN = {
    BREAK_FIRE: 0.3,
    LINE_KEEP: 0.5,
    FULL_COLUMN_KEEP: 1,
    TAIL_KNOWN: 1,
    TAIL_UNKNOWN: 3,
} as const;

/** UTF-8 でのバイト長（GA4 の計測用。上限判定には messageUnits を使う） */
export function utf8ByteLength(text: string): number {
    return new TextEncoder().encode(text).length;
}

/** 実機の送り幅は 1/64 em グリッドに乗る（下記 GRID の解説を参照） */
const U = 1 / 64;

/**
 * 実機プローブで直接測定した幅（最優先・フォント由来の値より強い）。
 *
 * **法則: 送り幅は必ず k/64 em（2026-07-26 発見）**。
 * 折り返し個数から精密に求めた 4 文字（. , t a）と、R5〜R8 のピッチ実測 13 文字の
 * すべてが 1/64 の格子に最大 0.0075 の誤差で乗る（ピッチ実測の誤差 ±0.05 より十分小さい）。
 * FreeType が送り幅を 26.6 固定小数点＝1/64 単位で持つ実装と一致するため、
 * 以後の実測値は**最寄りの k/64 に丸めて登録する**（測定誤差を消せる）。
 *
 * 測定法: その文字を N 個並べて送り、1 行目に n 個入れば w ∈ (LIMIT_SAFE/(n+1), LIMIT_FORCE/n]。
 * 細い文字ほど 1 行に多く並ぶので精度が上がる（`.` は ±0.003）。
 */
const DEVICE_OVERRIDES: Record<string, number> = {
    // アトラス漏れ → 全角フォールバック（R5-1: 1 行 10 個・ピッチ 24px）
    '´': 1.0,
    // ∥(U+2225): R3 で 1 行に 20 個＋∧ が 10 個入ることから 0.5 と確定
    '∥': 0.5,

    // --- 折り返し個数からの精密実測（誤差 ±0.01 以下） ---
    _: 32 * U, // R7: ×45 で 1 行 41 個
    '.': 18 * U, // 2026-07-26: ×74 で 1 行 73 個
    ',': 18 * U, // 同上
    t: 32 * U, // 2026-07-26: ×52 で 1 行 41 個（_ と同値）
    a: 39 * U, // 2026-07-26: ×45 で 1 行 33 個

    // --- R8 のピッチ実測（±0.05）を 1/64 格子へ丸めたもの ---
    // 英字は BIZ とほぼ一致するが記号類は独自値 ＝ アトラスの実体は BIZ ではなく
    // UD 新ゴ系の別製品と推定（LETS 連続性説と整合）。) は ( の対称と推定（未実測）
    "'": 14 * U,
    '`': 22 * U,
    '|': 19 * U,
    '(': 20 * U,
    ')': 20 * U,
    '=': 35 * U,
    '~': 38 * U,
    '^': 42 * U,
    O: 51 * U,

    // --- 上限のみ判明（その個数では折り返さなかった）。格子上の最大値を暫定採用 ---
    // BIZ 値はいずれも実測上限を超えており過大だった。正確な値は追加プローブ待ち
    '/': 26 * U, // ×50 が 1 行に収まる → w ≤ 0.4095（BIZ 0.510 は過大）
    '\\': 26 * U, // 同上
    '-': 25 * U, // ×51 が 1 行に収まる → w ≤ 0.4015（BIZ 0.490 は過大）
    i: 18 * U, // ×72 が 1 行に収まる → w ≤ 0.2844（BIZ 0.326 は過大）
    l: 18 * U, // ×70 が 1 行に収まる → w ≤ 0.2925（BIZ 0.337 は過大）
    // ஐ(U+0B90 タミル文字): 実機で削除されず幅 0 で入力できる（2026-07-25 ユーザー実測）。
    // 幅 0 で生き残る唯一の既知文字＝「見えない終端ガード」候補（末尾 ▄ 連続の
    // 削られ対策）。自動付与に使う前にコピーバックでの残存と連続時の幅 0 を要再確認
    ஐ: 0,
};

/** BIZ UDPGothic 400 の実測幅（scripts/extract-metrics.mjs で生成・あ=1.0 正規化） */
const BIZ_WIDTHS: Record<string, number> = biz.widths;
const BIZ_MISSING = new Set<string>(biz.missing);

/**
 * 半角クラス（層 2）: BIZ のプロポーショナル幅をそのまま信じる範囲。
 * ASCII と半角カナのみ。Latin-1 記号（´ 等）はアトラス漏れの実績があるため
 * 層 3（全角フォールバック・未確認扱い）に回す。
 */
const HALF_RANGES: [number, number][] = [
    [0x0020, 0x007e], // ASCII
    [0xff61, 0xff9f], // 半角カタカナ
];

/**
 * 全角クラス（層 1・固定 1.0）。文字リテラルで書くと似た字形の別コードポイント
 * 混入に気づけないため（実例: 豈 のつもりで U+8C48 を書き私用領域まで全角扱い）、
 * 必ず \u エスケープで書くこと。
 */
const FULLWIDTH_RE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

/**
 * 全角フォールバック推定クラス（層 3）: 技術記号・図形・ギリシャ・キリル等。
 * ⌒（U+2312）は実機で 1.0 動作を確認済み。他は 1.0 と推定（未実測）。
 */
const FALLBACK_RANGES: [number, number][] = [
    [0x0370, 0x03ff], // ギリシャ（ω 等）
    [0x0400, 0x045f], // キリル（Д 等）
    [0x2100, 0x23ff], // 技術記号（⌒ 等）
    [0x2460, 0x27bf], // 囲み数字・罫線・図形・記号
];

/**
 * 実機プローブで幅 1.0 を確認済みの文字（2026-07-25 の一括検証 B/D/G/H/I/J/K/L）。
 * 「テスト 20 文字＋判定文字 O」で 2 行目に O だけが落ちることを確認した群。
 * ※ § ¶ ± × ÷ † ‡ ‰ ′ ″ ‥ … 〝 〟 は推定 0.5 だったが実機は 1.0 だった。
 */
const VERIFIED_FULLWIDTH = new Set(
    Array.from(
        '⌒´' +
            '∴∵≒≠≡≦≧⊂⊃⊆⊇⊥∽≪≫∟⊿⇔↕' + // B 数学記号2
            'αβγδεζηθικλμνξοπρστω' + // D ギリシャ小文字
            '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳' + // G 囲み数字
            '「」『』【】〈〉《》〔〕〜〆〇々〃〒・※' + // H 日本語の約物
            '＿＾｀＼｜／～＝＋－＊＃＠＆％＄！？：；' + // I 全角記号
            'ぁぃぅぇぉっゃゅょゎァィゥェォヵヶゝゞ゛' + // J 小書き・繰り返し
            'ⅠⅡⅢⅣⅤⅵⅶⅷⅸⅹ℡№㈱㈲㍻㎜㎝㎞㎏㎡' + // K 機種依存・単位
            '§¶†‡‰′″‥…〝〟±×÷∝∮⇄⇅' + // L 欧文記号・約物
            '∀∂∃∇∈∋∏∑√∝' + // A-1
            '∞∠∧∨∩∪∫∬∮' + // A-2（∥ は 0.5 と判明したので除外）
            '←↑→↓↔↕↖↗↘↙' + // C-1
            '⇒⇐⇆⇦⇨' + // C-2（⇑⇓ は実機で消えるため除外）
            '★☆♀♂♪♭♯♠♣♥' + // F-1
            '♦☀☁☂☃☎☜☞✓' + // F-2（✕ は実機で消えるため除外）
            'ΞΠ' + // E-1（単体なら正常。隣接時のみ * に置換される）
            'ΑΒΓΔΘΛΣΦΨΩДЖЗИЛПФЯ', // E-2 ギリシャ大文字・キリル
    ),
);

/**
 * 実機に送ると**消える**文字（2026-07-25 ラウンド 3 で確認）。
 * 送信テキストに残すと AA の形が崩れるため、変換時に取り除いて警告する。
 */
export const UNUSABLE_CHARS = new Set(Array.from('⇑⇓✕'));

/**
 * 隣接すると別の文字に置換される並び（2026-07-25）。
 * `ΞΠ` は `*` 1 文字に置換される。文字単体では正常なので幅の問題ではない。
 */
export const FILTERED_SEQUENCES = ['ΞΠ'];

/**
 * **端末によって見え方が変わる文字**（2026-07-26 実機確認）。
 * Android では全角幅で揃うが iPhone では崩れる。文字自体は消えない。
 * - `▀░▒▓`: 半分の幅で表示される
 * - `▘▝▖▗▚▞▛▜▙▟`（4 分割ブロック）: 幅 0 で完全に見えない
 * - `↕`: 半分の幅（`↑↓↔` は全角のまま ＝ 同じ矢印でも 1 文字ずつ違う）
 * - 二重罫線 `═║╔╗╚╝╠╣╦╩╬`: 半分の幅（太線の罫線は全角のまま）
 *
 * 送る端末と見る端末が違えば結果も変わるため、変換時に警告する。
 * パレットからは撤去済み（core/palette.ts の WITHDRAWN_CHARS）。
 *
 * **PC のフォントからは予測できない**（Consolas は ●↑↓↔↕ を全て狭いと
 * 判定するが実機で崩れるのは ↕ だけ、Segoe UI は ↕ を全角と判定する）。
 * 判定は必ず実機プローブで行う（scripts/gen-width-batch.mjs）。
 */
export const DEVICE_VARIANT_CHARS = new Set(Array.from('▀░▒▓▘▝▖▗▚▞▛▜▙▟' + '↕' + '═║╔╗╚╝╠╣╦╩╬'));

/**
 * 実機で 1.0 動作を範囲ごと確認済みのフォールバック領域。
 * 罫線・ブロック要素: 2026-07-25 あ×13+┏┓┳┃┗┻┛━ プローブで
 * 「7 個目まで 1 行・8 個目の ━ だけ折り返し」＝全て 1.0 と確定
 */
const FALLBACK_VERIFIED_RANGES: [number, number][] = [
    [0x2500, 0x257f], // 罫線素片
    // ブロック要素: **範囲まとめての認定は 2026-07-26 に撤回した**。
    // 実機（iPhone）で 1 文字ずつ確かめたところ、同じブロック内で結果が割れた:
    //   ベタ █ と半分 ▄▌▐ = 全角幅で表示 ✓
    //   濃淡 ░▒▓ と 上半分 ▀ = 半分の幅 ／ 4 分割 ▘▝▖▗▚▞▛▜▙▟ = 幅 0 で不可視
    // 表示できるものだけを確認済みとして残す（残りは未確認＝警告対象に戻す）
    [0x2584, 0x2584], // ▄ 下半分
    [0x2588, 0x2590], // █▉▊▋▌▍▎▏▐ ベタと左右の部分ブロック
    // 幾何学図形: 2026-07-25 あ×13+■□●○◆◇▲△ プローブで △ だけ折り返し＝全て 1.0
    [0x25a0, 0x25ff],
];

const inRanges = (cp: number, ranges: [number, number][]) =>
    ranges.some(([lo, hi]) => cp >= lo && cp <= hi);

export interface CharClass {
    /** 全角 1 文字 = 1.0 とした送り幅 */
    width: number;
    /** 実測または確定クラス由来で、推定に頼っていないか */
    verified: boolean;
}

/**
 * 文字の分類はここ 1 箇所だけ。幅と確からしさを**同時に**返すことで、
 * 「確認済みなのに幅は既定値」という食い違いが構造的に起きないようにしている。
 * （以前は charWidth と isKnownWidth が別々に優先順位を書いており、
 * 確認済み範囲を追記したときに幅の方が追従しない穴があった）
 *
 * 優先順位は上から: 実測の個別上書き → 実測の確認済み集合 → 確認済み範囲 →
 * 半角クラス（BIZ 実測）→ 全角クラス（固定 1.0）→ フォールバック推定。
 */
export function classifyChar(ch: string): CharClass {
    const override = DEVICE_OVERRIDES[ch];
    if (override !== undefined) return { width: override, verified: true };
    // ※ § ± … などクラス分けでは 0.5 と誤推定される文字を含む
    if (VERIFIED_FULLWIDTH.has(ch)) return { width: 1.0, verified: true };

    const cp = ch.codePointAt(0)!;
    if (inRanges(cp, FALLBACK_VERIFIED_RANGES)) return { width: 1.0, verified: true };

    if (inRanges(cp, HALF_RANGES)) {
        const w = BIZ_WIDTHS[ch];
        if (w !== undefined) return { width: w, verified: true };
        // 収録漏れはフォールバックの半角固定幅に落ちる（_ で実証）
        return BIZ_MISSING.has(ch)
            ? { width: 0.5, verified: false }
            : { width: 1.0, verified: true };
    }

    if (ch === '　') return { width: 1.0, verified: true };
    if (FULLWIDTH_RE.test(ch)) return { width: 1.0, verified: true };

    // 層 3 の未実測（ω Д 等）。1.0 と推定するが確認済みではないので警告対象
    if (inRanges(cp, FALLBACK_RANGES)) return { width: 1.0, verified: false };
    return { width: 0.5, verified: false };
}

/** 1 文字の幅（全角=1.0 単位）。実測できていない文字は推定値 */
export function charWidth(ch: string): number {
    return classifyChar(ch).width;
}

/**
 * 幅が実測または確定クラスで信頼できる文字か。
 * false の文字は推定幅になり、折り返し位置が実機とずれる可能性がある。
 */
export function isKnownWidth(ch: string): boolean {
    return classifyChar(ch).verified;
}

/** 文字列の幅合計（サロゲートペア対応のため Array.from） */
export function textWidth(text: string): number {
    let w = 0;
    for (const ch of Array.from(text)) w += charWidth(ch);
    return w;
}
