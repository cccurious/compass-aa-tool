/**
 * 実機（#コンパス チャット）の入力正規化の再現。
 *
 * ゲーム側は送信時に一部の半角文字を全角へ自動変換する（実機で送信→コピーで
 * 回収したテキストとの diff で確認）。ツール側で同じ変換を先取りしてから
 * 幅計算・パディングすることで、プレビュー＝実機表示を保つ。
 *
 * 確認済みマップ（2026-07-25 ラウンド 4 コピーバック diff で網羅）:
 * - `.` `/` `:` の 3 文字のみ全角へ変換される（URL 無効化フィルタと推定）。
 * - ASCII 英数・他の記号・半角カナ・濁半濁点は全て素通り。削除される文字は無し。
 */
export const DEVICE_NORMALIZE: ReadonlyMap<string, string> = new Map([
  ['.', '．'], // 幅 0.278 → 1.0
  ['/', '／'], // 幅 0.5?  → 1.0
  [':', '：'], // 幅 0.278? → 1.0
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
