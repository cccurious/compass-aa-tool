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

/** Noto Sans JP で幅 1.0 でない文字の例外マップ（全角=1.0 単位） */
const EXCEPTIONS: Record<string, number> = noto.widths;

/** Noto Sans JP にグリフが無い文字＝フォールバック発生・幅不明の危険文字 */
const MISSING = new Set<string>(noto.missing);

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

/** 全角判定（East Asian Width の主要域） */
const FULLWIDTH_RE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

/** 1 文字の幅（全角=1.0 単位）。テーブル外の非全角は 0.5 の粗い近似 */
export function charWidth(ch: string): number {
  const w = EXCEPTIONS[ch];
  if (w !== undefined) return w;
  if (ch === '　') return 1.0;
  if (FULLWIDTH_RE.test(ch)) return 1.0;
  return 0.5;
}

/** フォントにグリフが無く、フォールバックで幅が予測不能になりうる文字か */
export function isFallbackRisk(ch: string): boolean {
  return MISSING.has(ch);
}

/** 文字列の幅合計（サロゲートペア対応のため Array.from） */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of Array.from(text)) w += charWidth(ch);
  return w;
}
