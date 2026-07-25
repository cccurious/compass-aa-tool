import { charWidth, LINE_LIMIT } from './metrics';

/**
 * 自動折り返しシミュレータ（実機検証済みの規則・2026-07-25 ラウンド 2）。
 * - 幅がしきい値を超える文字の直前で折る
 * - 折り返し点の半角スペース連続は消える（行末に残らず、次行頭にも出ない）
 * - 全角スペースは消えず、次行頭へキャリーされて字下げになる
 *
 * 注意: Word Wrap（半角英数単語の巻き戻し）は未実装。
 * 半角英数の連続を含む入力では実機とズレる可能性（docs/spec.md §5）。
 */
export interface SimLine {
  text: string;
  width: number;
}

export function simulateWrap(oneLine: string, limit: number = LINE_LIMIT): SimLine[] {
  const lines: SimLine[] = [];
  let cur = '';
  let curW = 0;
  let eating = false; // 折り返し直後: 半角スペースを食べている状態

  for (const ch of Array.from(oneLine)) {
    if (eating) {
      if (ch === ' ') continue; // 折り返し点の半角スペースは消える
      eating = false;
    }
    const w = charWidth(ch);
    if (curW + w > limit && cur !== '') {
      lines.push({ text: cur, width: curW });
      cur = '';
      curW = 0;
      if (ch === ' ') {
        eating = true;
        continue;
      }
    }
    cur += ch;
    curW += w;
  }
  if (cur !== '') lines.push({ text: cur, width: curW });
  return lines;
}
