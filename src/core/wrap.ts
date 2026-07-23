import { charWidth, LINE_LIMIT } from './metrics';

/**
 * 自動折り返しシミュレータ。
 * 1 行テキストを実機と同じ規則（幅がしきい値を超える文字の直前で折る）で
 * 行に分割する。校正フェーズでは実機スクショとの一致検証の測定器を兼ねる。
 *
 * 注意: Word Wrap（半角単語巻き戻し）は現時点で未実装。
 * 半角英数の連続を含む入力では実機とズレる（docs/spec.md §5）。
 */
export interface SimLine {
  text: string;
  width: number;
}

export function simulateWrap(oneLine: string, limit: number = LINE_LIMIT): SimLine[] {
  const lines: SimLine[] = [];
  let cur = '';
  let curW = 0;
  for (const ch of Array.from(oneLine)) {
    const w = charWidth(ch);
    if (curW + w > limit && cur !== '') {
      lines.push({ text: cur, width: curW });
      cur = '';
      curW = 0;
    }
    cur += ch;
    curW += w;
  }
  if (cur !== '') lines.push({ text: cur, width: curW });
  return lines;
}
