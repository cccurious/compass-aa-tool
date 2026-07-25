/**
 * GA4 計測。BM チェッカーとは別プロパティで管理するため、測定 ID は
 * index.html 側の gtag スニペットで指定する（差し替え手順は docs/notes/ga4-setup.md）。
 *
 * gtag が読み込まれていない環境（未設定・広告ブロック）でも落ちないよう、
 * 送信は常にこのヘルパー経由にする。
 */
const send = (event: string, params: Record<string, unknown> = {}) => {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag === 'function') w.gtag('event', event, params);
};

/** SPA のビュー切替を手動でページビューとして送る */
export const trackView = (view: string) => {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag !== 'function') return;
  w.gtag('event', 'page_view', {
    page_title: view,
    page_location: `${location.origin}${location.pathname}?view=${view}`,
    page_path: `${location.pathname}?view=${view}`,
  });
};

/** コピー＝このツールの完了地点。どちらの作り方が使われているかを見る */
export const trackCopy = (params: {
  source: 'dot' | 'aa';
  bytes: number;
  lines: number;
  over_limit: boolean;
}) => send('copy_aa', params);

/** ドット打ちからテキスト編集へ送った回数 */
export const trackSendToConverter = (params: { lines: number }) =>
  send('send_to_converter', params);

/** パレットへの文字追加（どんな文字が求められているかの手掛かり） */
export const trackPaletteAdd = (params: { added: number; skipped: number }) =>
  send('palette_add', params);

/** 実機で消える文字・置換される並びが入力された回数（仕様案内の改善材料） */
export const trackBlockedChars = (params: { kind: 'removed' | 'sequence'; chars: string }) =>
  send('blocked_chars', params);
