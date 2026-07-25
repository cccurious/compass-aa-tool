/**
 * 規則族 F2: 幅 W の word-wrap で「改行が発火したスペース」だけコスト H、
 * それ以外のスペースは L。文字は全角 1・半角 hh。上限 A=C・上限 B=184 固定。
 */
import { convert } from '../../../../../../../../Claude/compass-aa-tool/src/core/convert';
import { charWidth } from '../../../../../../../../Claude/compass-aa-tool/src/core/metrics';

const digits = (n: number) => Array.from('０１２３４５６７８９'.repeat(30)).slice(0, n).join('');
const zeroWords = [11, 19, 19, 19, 19, 16, 17, 16, 15];
const pa = zeroWords.map((n) => '０'.repeat(n)).join(' ');
const p9 = '０１２３４５６７８９ '.repeat(6) + digits(117);
const bulbSrc = (tail: string) =>
    convert(
        [
            '　　 ＼　　__　　／',
            '　 　＿　（ｍ）　＿　あ！今日土曜日ど！',
            '　 　　　　|ミ|',
            '.　 　／ 　｀´　 ＼',
            '',
            '　　　 　(　‘ｊ’∩',
            '　　　　（つ　　ﾉ',
            '　　　　⊂＿ .ﾉ',
            '　　　　　 (ノ' + tail,
        ].join('\n'),
    ).output;
const retrieverNew = convert(
    [
        '　　　　　　　　　██',
        '　　　　█　　　████　　　█　　き',
        '　　　　██　██████　██　　か',
        '　ん　　████████████　　え',
        '　た　　███▒▒▓□▒▒███　　お',
        '　ん　　█▒▒▒▒▓▓▒▒▒▒█',
        '　か　▒▒　　▜　　　　▜　　▒▒',
        '　！　　▌　　█　　　　█　　▐',
        '　　　　　▄▄▄▄▄▄▄▄▄▄',
    ].join('\n'),
).output;

const data: [string, string, number][] = [
    ['PA', pa, 151],
    ['PD1', 'a' + pa, 152],
    ['P9', p9, 181],
    ['W2', ('０'.repeat(10) + ' ').repeat(8) + '　 '.repeat(20) + digits(60), 174],
    ['bulb2', bulbSrc('ああああああああああああ'), 194],
    ['PD2', 'あ'.repeat(220), 184],
    ['PD3', 'a' + 'あ'.repeat(220), 184],
    ['W1', ('０'.repeat(10) + ' ').repeat(9) + digits(60), -1],
    ['W3', ('０'.repeat(10) + ' ').repeat(8) + 'a'.repeat(20) + digits(60), -1],
    ['W4', ('０'.repeat(5) + ' ').repeat(16) + digits(60), -1],
    ['V1', '０ '.repeat(15) + digits(30), -1],
    ['V2', '０ '.repeat(13) + '　 '.repeat(20) + digits(30), -1],
    ['V3', '０ '.repeat(15) + 'a'.repeat(20) + digits(30), -1],
    ['P5', digits(85) + ' ' + digits(85), -1],
    ['P7', ('０'.repeat(10) + ' ').repeat(4) + digits(132), -1],
    ['P8', ('０'.repeat(10) + ' ').repeat(2) + digits(154), -1],
    ['digits170', digits(170), -1],
    ['あ176', 'あ'.repeat(176), -1],
    ['aaa196', 'a'.repeat(196), -1],
    ['bulb1', bulbSrc(''), -1],
    ['retriever175', retrieverNew, -1],
];

// 幅 W での折り返し: 改行が発火したスペース（連続の先頭）の index 集合を返す
const HALF_SP_W = charWidth(' ');
function breakSpaces(cs: string[], W: number): Set<number> {
    const out = new Set<number>();
    let curW = 0;
    let curLen = 0;
    let i = 0;
    while (i < cs.length) {
        const c = cs[i];
        if (c === ' ') {
            let j = i;
            while (j < cs.length && cs[j] === ' ') j++;
            let wordW = 0;
            let k = j;
            while (k < cs.length && cs[k] !== ' ') {
                wordW += charWidth(cs[k]);
                k++;
            }
            const spaceRunW = (j - i) * HALF_SP_W;
            if (curLen > 0 && wordW > 0 && curW + spaceRunW + wordW > W) {
                out.add(i);
                curW = 0;
                curLen = 0;
                i = j;
                continue;
            }
            curW += HALF_SP_W;
            curLen++;
            i++;
            continue;
        }
        const w = charWidth(c);
        if (curW + w > W && curLen > 0) {
            curW = 0;
            curLen = 0;
            continue; // 文字単位折り返し（ペナルティ対象外）
        }
        curW += w;
        curLen++;
        i++;
    }
    return out;
}

const charsAll = data.map(([, s]) => Array.from(s));
let found = 0;
const hits: string[] = [];
for (let Wi = 1500; Wi <= 2100; Wi += 2) {
    const W = Wi / 100;
    const brk = charsAll.map((cs) => breakSpaces(cs, W));
    for (const H of [10, 12, 14, 15, 15.5, 16, 17, 18, 20]) {
        for (const L of [0.25, 0.5, 0.75, 1]) {
            for (const hh of [0, 0.25, 0.5, 1]) {
                let lo = 0;
                let hi = Infinity;
                let ok = true;
                for (let m = 0; m < data.length && ok; m++) {
                    const kept = data[m][2];
                    const cs = charsAll[m];
                    const bs = brk[m];
                    const cost = (idx: number) => {
                        const c = cs[idx];
                        if (c === ' ') return bs.has(idx) ? H : L;
                        return charWidth(c) >= 1.0 ? 1 : hh;
                    };
                    const wEq = (idx: number) =>
                        cs[idx] === ' ' ? 0.5 : charWidth(cs[idx]) >= 1.0 ? 1 : 0.5;
                    let a = 0;
                    let b = 0;
                    if (kept === -1) {
                        for (let i = 0; i < cs.length; i++) {
                            a += cost(i);
                            b += wEq(i);
                        }
                        if (b > 184) ok = false;
                        lo = Math.max(lo, a);
                    } else {
                        for (let i = 0; i < kept; i++) {
                            a += cost(i);
                            b += wEq(i);
                        }
                        if (b > 184) {
                            ok = false;
                            break;
                        }
                        const nA = a + cost(kept);
                        const nB = b + wEq(kept);
                        if (nB > 184) continue;
                        lo = Math.max(lo, a);
                        hi = Math.min(hi, nA - 1e-9);
                    }
                }
                if (ok && lo <= hi) {
                    found++;
                    if (hits.length < 30)
                        hits.push(`W=${W} H=${H} L=${L} half=${hh} C∈[${lo}, ${hi.toFixed(1)}]`);
                }
            }
        }
    }
}
console.log(hits.join('\n'));
console.log(`適合パラメータ数: ${found}`);

