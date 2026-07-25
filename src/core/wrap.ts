import { charWidth, LINE_LIMIT } from './metrics';

/**
 * 自動折り返しシミュレータ（実機検証済みモデル・2026-07-25 ラウンド 3 改訂）。
 *
 * 確定した実機規則:
 * - 半角スペースに当たると「次の半角スペースまでの塊（語）」の幅を先読みし、
 *   行の残り幅に入らなければその場で改行する（貪欲 Word Wrap）。
 *   全角スペースは語を切らない＝語に含まれて幅を太らせる（インシデント#1/#2 の原因）
 * - 改行点の半角スペース連続は行末・次行頭とも消える
 * - 半角スペース以外は文字単位で流し、超える文字の直前で折る
 *   （後方への巻き戻しはしない: R3-4 で `jj` が j / j に割れることを確認）
 * - 全角スペースは消えず次行頭へキャリーされて字下げになる（R3-1 でインデント 5 を実測）
 *
 * 未検証: 語の先読みが全角文字（かな・漢字）で切れるかどうか（R3-6 プローブ待ち）。
 * 本実装は「語＝次の半角スペースまで」とする。
 */
export interface SimLine {
    text: string;
    width: number;
}

export function simulateWrap(oneLine: string, limit: number = LINE_LIMIT): SimLine[] {
    const chars = Array.from(oneLine);
    const lines: SimLine[] = [];
    let cur = '';
    let curW = 0;

    const pushLine = () => {
        lines.push({ text: cur, width: curW });
        cur = '';
        curW = 0;
    };

    let i = 0;
    while (i < chars.length) {
        const ch = chars[i];
        if (ch === ' ') {
            // 語の先読み: 連続スペースを飛ばした先の「次の半角スペースまでの塊」
            let j = i;
            while (j < chars.length && chars[j] === ' ') j++;
            let wordW = 0;
            let k = j;
            while (k < chars.length && chars[k] !== ' ') {
                wordW += charWidth(chars[k]);
                k++;
            }
            const spaceRunW = (j - i) * charWidth(' ');
            if (cur !== '' && wordW > 0 && curW + spaceRunW + wordW > limit) {
                // 語が入らない → ここで改行し、スペース連続は消える
                pushLine();
                i = j;
                continue;
            }
            // 語が入る → スペースはそのまま流す（行中スペースは幅を持つ）
            cur += ch;
            curW += charWidth(' ');
            i++;
            continue;
        }
        const w = charWidth(ch);
        if (curW + w > limit && cur !== '') {
            // 文字単位の折り返し（巻き戻しなし）。行頭に来る半角スペースは上の分岐で処理済み
            pushLine();
            continue;
        }
        cur += ch;
        curW += w;
        i++;
    }
    if (cur !== '') pushLine();
    return lines;
}
