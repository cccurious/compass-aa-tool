/**
 * 実機（#コンパス チャット）の入力正規化の再現。
 *
 * ゲーム側は送信時に一部の半角文字を全角へ自動変換する（実機で送信→コピーで
 * 回収したテキストとの diff で確認）。ツール側で同じ変換を先取りしてから
 * 幅計算・パディングすることで、プレビュー＝実機表示を保つ。
 *
 * 確認済みマップ（2026-07-25 レトリバー AA のコピーバック diff）:
 * - `.` (U+002E, 幅0.278) → `．` (U+FF0E, 幅1.0)
 *
 * 未調査: 他の半角記号・削除される文字。コピーバック・プローブ
 * （calibration-plan.md ラウンド 4）で網羅する。判明したらここへ追記する。
 */
export const DEVICE_NORMALIZE: ReadonlyMap<string, string> = new Map([
  ['.', '．'],
]);

export interface NormalizedChange {
  line: number;
  from: string;
  to: string;
}

/** 1 行に実機正規化を適用し、置換があれば変更内容を返す */
export function normalizeRow(
  row: string,
  lineNo: number,
): { text: string; changes: NormalizedChange[] } {
  let text = '';
  const seen = new Map<string, string>();
  for (const ch of Array.from(row)) {
    const to = DEVICE_NORMALIZE.get(ch);
    if (to !== undefined) {
      text += to;
      seen.set(ch, to);
    } else {
      text += ch;
    }
  }
  const changes = [...seen].map(([from, to]) => ({ line: lineNo, from, to }));
  return { text, changes };
}
