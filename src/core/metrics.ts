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
 * 1 メッセージの最大文字数。
 *
 * 入力欄の上限と**送信時の上限は別物**（2026-07-25 実測で判明）:
 * - 入力欄: 半角 a は 196 文字で停止・全角 あ は IME 確定時に 184 文字へ切り詰め
 * - 送信後: 184 文字のドット絵を送ると**先頭 180 文字だけが残り末尾 4 文字が消えた**
 *   （コピーバックで先頭 180 文字の完全一致を確認）
 *
 * ツールが守るべきは送信側の 180。入力欄の値（184/196）を信じると末尾が欠ける。
 */
export const MAX_MESSAGE_CHARS = 180;

/**
 * 1 メッセージの上限は **UTF-8 で 512 バイト**（2026-07-25 確定）。
 * 文字数ではないため、全角ばかりだと 170 文字で頭打ちになる一方、
 * 半角を多く含む文なら 180 文字を超えても通る（「超過と出たのに表示された」の正体）。
 *
 * 根拠: 184 文字（524 バイト）のドット絵を送ると先頭 180 文字だけが残り、
 * その 180 文字は **ちょうど 512 バイト**だった（181 文字目まで入れると 515 バイト）。
 * 全角 = 3 バイト・半角 = 1 バイトなので、パディングの半角スペースは非常に安い。
 */
export const MAX_MESSAGE_BYTES = 512;

/** UTF-8 でのバイト長（実機の上限判定はこの値で行う） */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * 実機プローブで直接測定した幅（最優先・フォント由来の値より強い）。
 * - ´=1.0: R5-1 で 1 行 10 個＋px ピッチ 24px（アトラス漏れ→全角フォールバック）
 * - _=0.5: R7 の _×45 プローブで 1 行 41 個 → w ∈ [0.4875, 0.5012]。
 *   ASCII でもアトラス漏れがあり、フォールバックは JIS 固定ピッチ流
 *   （半角 0.5 / 全角 1.0）に落ちることの実証。BIZ の 0.311 は不採用
 */
const DEVICE_OVERRIDES: Record<string, number> = {
  '´': 1.0,
  _: 0.5,
  // ∥(U+2225): 2026-07-25 ラウンド 3 で 1 行に 20 個＋∧ が 10 個入ることから 0.5 と確定
  '∥': 0.5,
  // R8 ピッチ実測（2026-07-25・±0.05 程度）。英字は BIZ 一致だが記号類は
  // BIZ とも 0.5 固定とも異なる独自値 ＝ 真のアトラスフォントは UD 新ゴ系の
  // 別物と推定（LETS 連続性説と整合）。) は ( の対称と推定（未実測）
  "'": 0.22,
  '`': 0.35,
  '|': 0.29,
  '(': 0.32,
  ')': 0.32,
  '=': 0.54,
  '~': 0.59,
  '^': 0.655,
  O: 0.8,
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
const FULLWIDTH_RE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

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
 * 実機で 1.0 動作を範囲ごと確認済みのフォールバック領域。
 * 罫線・ブロック要素: 2026-07-25 あ×13+┏┓┳┃┗┻┛━ プローブで
 * 「7 個目まで 1 行・8 個目の ━ だけ折り返し」＝全て 1.0 と確定
 */
const FALLBACK_VERIFIED_RANGES: [number, number][] = [
  [0x2500, 0x257f], // 罫線素片
  // ブロック要素: 2026-07-25 █▌░▒▓×10 が 20/20/10 の 3 行に折り返し＝全て 1.0
  // （▌ は見た目半分だが送り幅は全角）
  [0x2580, 0x259f],
  // 幾何学図形: 2026-07-25 あ×13+■□●○◆◇▲△ プローブで △ だけ折り返し＝全て 1.0
  [0x25a0, 0x25ff],
];

const inRanges = (cp: number, ranges: [number, number][]) =>
  ranges.some(([lo, hi]) => cp >= lo && cp <= hi);

/** 1 文字の幅（全角=1.0 単位）。実測できていない文字は推定値 */
export function charWidth(ch: string): number {
  const d = DEVICE_OVERRIDES[ch];
  if (d !== undefined) return d;
  // 実機確認済みの全角（※ § ± … などクラス分けでは 0.5 と誤推定される文字を含む）
  if (VERIFIED_FULLWIDTH.has(ch)) return 1.0;
  const cp = ch.codePointAt(0)!;
  if (inRanges(cp, HALF_RANGES)) {
    const w = BIZ_WIDTHS[ch];
    if (w !== undefined) return w;
    return BIZ_MISSING.has(ch) ? 0.5 : 1.0;
  }
  if (ch === '　') return 1.0;
  if (FULLWIDTH_RE.test(ch)) return 1.0;
  if (inRanges(cp, FALLBACK_RANGES)) return 1.0;
  return 0.5;
}

/**
 * 幅が実測または確定クラスで信頼できる文字か。
 * false の文字は推定幅になり、折り返し位置が実機とずれる可能性がある。
 */
export function isKnownWidth(ch: string): boolean {
  if (DEVICE_OVERRIDES[ch] !== undefined || VERIFIED_FULLWIDTH.has(ch)) return true;
  const cp = ch.codePointAt(0)!;
  if (inRanges(cp, FALLBACK_VERIFIED_RANGES)) return true;
  if (inRanges(cp, HALF_RANGES)) return BIZ_WIDTHS[ch] !== undefined || !BIZ_MISSING.has(ch);
  if (ch === '　') return true;
  if (FULLWIDTH_RE.test(ch)) return true;
  // 層 3 の未実測文字（ω Д 等）は 1.0 と推定するが、確認済みではない
  return false;
}

/** スペーサー候補。verified は「実機で入力・表示・挙動を確認済み」 */
export interface Spacer {
  char: string;
  width: number;
  label: string;
  verified: boolean;
}

/**
 * 実機検証済みの空白挙動（R2〜R3）:
 * - 半角スペース: 行中では幅 0.34・折り返し点では行末・行頭とも消える
 * - 全角スペース: トリムされず次行頭へキャリーされる（字下げになる）
 */
export const SPACERS: Spacer[] = [
  { char: '　', width: charWidth('　'), label: '全角スペース', verified: true },
  { char: ' ', width: charWidth(' '), label: '半角スペース', verified: true },
];

/** 文字列の幅合計（サロゲートペア対応のため Array.from） */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of Array.from(text)) w += charWidth(ch);
  return w;
}
