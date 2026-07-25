/**
 * 文字幅テーブルと折り返ししきい値。
 *
 * 幅テーブルは【Noto Sans JP 400 仮説】に基づきフォントファイルの
 * Advance Width から生成（scripts/extract-metrics.mjs → noto-widths.json）。
 * 全角（あ）= 1.0 単位。実機プローブでの検証手順と予測値は
 * docs/notes/calibration-plan.md 参照。
 *
 * ⚠️ CALIBRATED が false の間は実機未検証。この値を根拠に精密機能
 * （狭幅記号スペーサーの既定使用・キャリーオーバー制御）を積み増さないこと。
 */
import noto from './noto-widths.json';

export const CALIBRATED = false;

/**
 * 1 行の折り返ししきい値（全角 1 文字 = 1.0 単位）。
 * ラウンド 1・2 の実機プローブ（2026-07-25・iPhone）で L ∈ [20.278, 20.548) を確定。
 * - LIMIT_SAFE 以下なら「折れない」ことを保証できる（コンテンツ行の上限）
 * - LIMIT_FORCE 以上なら「折れる」ことを保証できる（パディングの到達目標）
 * - 中間は未確定帯: この帯に行幅を置いてはいけない
 */
export const LIMIT_SAFE = 20.278;
export const LIMIT_FORCE = 20.548;
/** プレビュー用の代表値（未確定帯の中央。生成側は SAFE/FORCE のみを使う） */
export const LINE_LIMIT = (LIMIT_SAFE + LIMIT_FORCE) / 2;

/**
 * 1 メッセージの最大文字数（暫定・2026-07-25 実機観測）。
 * 半角 a は 196 文字・全角 あ は 184 文字入力できたため、単純な文字数制限では
 * ない可能性がある（測定方法を確認中）。安全側の 184 を採用。
 */
export const MAX_MESSAGE_CHARS = 184;

/**
 * 実機プローブで直接測定した幅（最優先・フォント仮説より強い）。
 * 2026-07-25 R5: ´ は 1 行に 10 個＋px ピッチ 24px で 1.0 確定
 * （ゲームのアトラスに無くフォールバックが全角幅）。j は 1 行に 27 個＋
 * px ピッチ 9.4px で 0.39（BIZ UDPGothic の 0.388 と一致 → 欧文は BIZ 系が濃厚）。
 * 全角スペースは R2/R3 のインデント px 測定で 1.0 確定。
 */
const DEVICE_OVERRIDES: Record<string, number> = {
  '´': 1.0,
  j: 0.39,
};

/** Noto Sans JP で幅 1.0 でない文字の例外マップ（全角=1.0 単位） */
const EXCEPTIONS: Record<string, number> = noto.widths;

/** Noto Sans JP にグリフが無い文字＝フォールバック発生・幅不明の危険文字 */
const MISSING = new Set<string>(noto.missing);

/** 抽出時にスキャンした範囲（この範囲内で missing でなければ幅は実測済み） */
const SCANNED_RANGES: number[][] = noto.ranges;
const EXTRA_SCANNED = new Set(Array.from(noto.extra));

/** スペーサー候補。verified は「実機で入力・表示できることを確認済み」 */
export interface Spacer {
  char: string;
  width: number;
  label: string;
  verified: boolean;
}

/**
 * 実機検証済みの空白挙動（ラウンド 2・2026-07-25）:
 * - 半角スペース: 行中では幅を持つが、折り返し点では行末・行頭とも消える（トリム）。
 *   → 痕跡を残さないパディング部品として最適
 * - 全角スペース: トリムされず次行頭へキャリーされる（見た目の字下げになる）
 *   → 行頭インデントは各行の先頭に全角スペースを書けばそのまま出る
 */
export const SPACERS: Spacer[] = [
  { char: '　', width: charWidth('　'), label: '全角スペース', verified: true },
  { char: ' ', width: charWidth(' '), label: '半角スペース', verified: true },
];

/**
 * 全角判定（East Asian Width の主要域）。
 * 文字リテラルで書くと似た字形の別コードポイント混入に気づけないため
 * （実例: 豈 のつもりで U+8C48 を書き私用領域まで全角扱いになった）、
 * 必ず \u エスケープで書くこと。
 */
const FULLWIDTH_RE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

/** 1 文字の幅（全角=1.0 単位）。実測できていない文字は 0.5 の粗い近似 */
export function charWidth(ch: string): number {
  const d = DEVICE_OVERRIDES[ch];
  if (d !== undefined) return d;
  const w = EXCEPTIONS[ch];
  if (w !== undefined) return w;
  if (ch === '　') return 1.0;
  // スキャン済みで例外マップに無い＝実測 1.0（⌒ 等。exceptions は幅≠1.0 のみ収載）
  if (!MISSING.has(ch)) {
    const cp = ch.codePointAt(0)!;
    if (SCANNED_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)) return 1.0;
    if (EXTRA_SCANNED.has(ch)) return 1.0;
  }
  if (FULLWIDTH_RE.test(ch)) return 1.0;
  return 0.5;
}

/** フォントにグリフが無く、フォールバックで幅が予測不能になりうる文字か */
export function isFallbackRisk(ch: string): boolean {
  return MISSING.has(ch);
}

/**
 * 幅が実測済み（テーブル由来）で信頼できる文字か。
 * false の文字は 0.5/1.0 の推測値になり、パディング計算がずれて
 * Word Wrap 巻き戻し事故を起こしうる（2026-07-25 ⌒ で実害を確認）。
 */
export function isKnownWidth(ch: string): boolean {
  if (ch === '　' || EXCEPTIONS[ch] !== undefined) return true;
  if (MISSING.has(ch)) return false;
  const cp = ch.codePointAt(0)!;
  if (SCANNED_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)) return true;
  if (EXTRA_SCANNED.has(ch)) return true;
  // スキャン外でも、かな・漢字・ハングル等の全角域は 1.0 と確信してよい
  return FULLWIDTH_RE.test(ch);
}

/** 文字列の幅合計（サロゲートペア対応のため Array.from） */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of Array.from(text)) w += charWidth(ch);
  return w;
}
