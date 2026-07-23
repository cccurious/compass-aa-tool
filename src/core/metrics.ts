/**
 * 文字幅テーブルと折り返ししきい値。
 *
 * ⚠️ 本ファイルの数値は仕様書（docs/spec.md）由来の【未校正の仮値】。
 * 実機データ（materials/）での校正が済むまで、この値を根拠に
 * 精密な調整機能を積み増さないこと（CLAUDE.md「凍結」参照）。
 * 校正済みになったら CALIBRATED を true にし、根拠を docs/notes/ へ記録する。
 */

export const CALIBRATED = false;

/** 1 行の折り返ししきい値（全角 1 文字 = 1.0 単位） */
export const LINE_LIMIT = 20.5;

/** スペーサー候補。実機での入力可否は未検証（narrow 系は特に要確認） */
export interface Spacer {
  char: string;
  width: number;
  label: string;
  /** 実機で入力・表示できることを確認済みか */
  verified: boolean;
}

export const SPACERS: Spacer[] = [
  { char: '　', width: 1.0, label: '全角スペース', verified: false },
  { char: ' ', width: 0.5, label: '半角スペース', verified: false },
];

/** 全角判定（East Asian Width の主要域。厳密化は校正フェーズで） */
const FULLWIDTH_RE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

/** 1 文字の幅（未校正: 全角 1.0 / それ以外 0.5 の粗い近似） */
export function charWidth(ch: string): number {
  if (ch === '　') return 1.0;
  if (FULLWIDTH_RE.test(ch)) return 1.0;
  return 0.5;
}

/** 文字列の幅合計（サロゲートペア対応のため Array.from） */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of Array.from(text)) w += charWidth(ch);
  return w;
}
