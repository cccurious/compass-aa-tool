/**
 * 実機メッセージ上限の規則探索（v5・2026-07-25）。
 *
 * 規則族 F3「改行イベント課金」: 幅 W の word-wrap をかけたとき、
 *   - 改行を発生させた半角スペース = コスト H（実質「改行 1 回の値段」）
 *   - 改行しなかった半角スペース   = コスト Lc
 *   - 全角グリフ・全角スペース     = 1
 *   - 半角文字                     = hh
 *   上限 A: 累積コスト ≤ C ／ 上限 B: 幅換算（全角1・半角0.5）≤ 184
 *   切断位置 = どちらかを超えない最長プレフィックス
 *
 * 前回（v4 期）の探索が失敗したのは H の候補を 16 前後の粗いグリッドでしか
 * 振っていなかったため。PA と P9 を連立すると H は 1 桁になる。
 *
 * 使い方: npx vite-node scripts/limit-rule-solver.ts
 * 新しい実測が出たら data 配列に [名前, 文字列, 残存文字数(無傷は -1)] を足す。
 */
import { convert } from '../src/core/convert';
import { charWidth } from '../src/core/metrics';

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

/** [名前, 送信文字列, 実機に残った文字数（無傷なら -1）] */
export const data: [string, string, number][] = [
    // --- 切断された実測 ---
    ['PA(語11-19×9)', pa, 151],
    ['PD1(a+PA)', 'a' + pa, 152],
    ['P9(語10×6+尻尾117)', p9, 181],
    ['X1(P9同型・全部０)', '００００００００００ '.repeat(6) + '０'.repeat(117), 181],
    [
        'W2(語10×8+全角sp軽ペア20+尻尾60)',
        '００００００００００ '.repeat(8) + '　 '.repeat(20) + digits(60),
        174,
    ],
    ['電球+あ12', bulbSrc('ああああああああああああ'), 194],
    ['PD2(あ220)', 'あ'.repeat(220), 184],
    ['PD3(a+あ220)', 'a' + 'あ'.repeat(220), 184],
    // --- 無傷の実測 ---
    ['W1(語10×9+尻尾60)', '００００００００００ '.repeat(9) + digits(60), -1],
    ['X2(W1同型・語は数字)', '０１２３４５６７８９ '.repeat(9) + digits(60), -1],
    ['W3(語10×8+a20+尻尾60)', '００００００００００ '.repeat(8) + 'a'.repeat(20) + digits(60), -1],
    ['W4(語5×16+尻尾60)', '０００００ '.repeat(16) + digits(60), -1],
    ['V1(語1×15+尻尾30)', '０ '.repeat(15) + digits(30), -1],
    ['V2(語1×13+全角sp20+尻尾30)', '０ '.repeat(13) + '　 '.repeat(20) + digits(30), -1],
    ['V3(語1×15+a20+尻尾30)', '０ '.repeat(15) + 'a'.repeat(20) + digits(30), -1],
    ['P5(数字85+sp+数字85)', digits(85) + ' ' + digits(85), -1],
    ['P7(語10×4+尻尾132)', '００００００００００ '.repeat(4) + digits(132), -1],
    ['P8(語10×2+尻尾154)', '００００００００００ '.repeat(2) + digits(154), -1],
    ['数字170', digits(170), -1],
    ['あ176(UTF-8 528B)', 'あ'.repeat(176), -1],
    ['aaa196', 'a'.repeat(196), -1],
    ['電球(187字sp30)', bulbSrc(''), -1],
    ['新レトリバー(全角充填175)', retrieverNew, -1],
];

const HALF_SP_W = charWidth(' ');

/**
 * 幅 W で折り返したときの改行点。
 * spaceBreaks: 改行を発生させた半角スペースの index
 * charBreaks: 文字単位で折り返した位置（その文字の index。スペースを介さない改行）
 */
export function findBreaks(
    cs: string[],
    W: number,
): { spaceBreaks: Set<number>; charBreaks: Set<number> } {
    const spaceBreaks = new Set<number>();
    const charBreaks = new Set<number>();
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
                // 改行が起きたスペース連続（先頭の 1 個を代表として記録）
                spaceBreaks.add(i);
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
            charBreaks.add(i);
            curW = 0;
            curLen = 0;
            continue;
        }
        curW += w;
        curLen++;
        i++;
    }
    return { spaceBreaks, charBreaks };
}

/** 後方互換（診断スクリプト用） */
export const breakingSpaces = (cs: string[], W: number) => findBreaks(cs, W).spaceBreaks;

const WIDTH_CAP = 184;
const widthEq = (c: string) => (c !== ' ' && charWidth(c) >= 1.0 ? 1 : 0.5);

interface Params {
    W: number;
    /** 改行を起こした半角スペースのコスト */
    H: number;
    /** 改行を起こさなかった半角スペースのコスト */
    Lc: number;
    /** 半角文字のコスト */
    hh: number;
    /** 全角スペースのコスト（全角グリフ 1 と別扱いにできるようにする） */
    zsp: number;
    /** 文字単位の折り返し 1 回あたりのコスト（スペースを介さない改行） */
    Kc: number;
}

/** 幅 W ごとに各ケースの内訳を数えておく */
interface Counts {
    full: number;
    half: number;
    zsp: number;
    brk: number;
    nbrk: number;
    /** この範囲で起きた文字単位折り返しの回数 */
    cbrk: number;
}
type Kind = 'full' | 'half' | 'zsp' | 'brk' | 'nbrk';

interface CaseCounts {
    kept: number;
    /** 残存プレフィックスぶん（無傷ケースは全文） */
    pre: Counts;
    /** 切断された 1 文字ぶん（無傷ケースは null） */
    nextIsBrk: Kind | null;
    /** 切断された 1 文字が文字単位折り返しの位置だったか */
    nextIsCharBreak: boolean;
    /** 幅換算（上限 B 用） */
    preWidth: number;
    nextWidth: number;
    totalWidth: number;
}

const kindOf = (ch: string, i: number, brk: Set<number>): Kind =>
    ch === ' '
        ? brk.has(i)
            ? 'brk'
            : 'nbrk'
        : ch === '　'
          ? 'zsp'
          : charWidth(ch) >= 1.0
            ? 'full'
            : 'half';

const countUpTo = (cs: string[], brk: Set<number>, cbrk: Set<number>, end: number): Counts => {
    const c: Counts = { full: 0, half: 0, zsp: 0, brk: 0, nbrk: 0, cbrk: 0 };
    for (let i = 0; i < end; i++) {
        c[kindOf(cs[i], i, brk)]++;
        if (cbrk.has(i)) c.cbrk++;
    }
    return c;
};

const prepare = (W: number): CaseCounts[] =>
    data.map(([, s, kept]) => {
        const cs = Array.from(s);
        const { spaceBreaks: brk, charBreaks: cbrk } = findBreaks(cs, W);
        const end = kept === -1 ? cs.length : kept;
        const pre = countUpTo(cs, brk, cbrk, end);
        let nextIsBrk: CaseCounts['nextIsBrk'] = null;
        let nextWidth = 0;
        let nextIsCharBreak = false;
        if (kept !== -1) {
            nextIsBrk = kindOf(cs[kept], kept, brk);
            nextWidth = widthEq(cs[kept]);
            nextIsCharBreak = cbrk.has(kept);
        }
        let preWidth = 0;
        for (let i = 0; i < end; i++) preWidth += widthEq(cs[i]);
        let totalWidth = 0;
        for (const ch of cs) totalWidth += widthEq(ch);
        return { kept, pre, nextIsBrk, nextIsCharBreak, preWidth, nextWidth, totalWidth };
    });

const costOf = (c: Counts, p: Params) =>
    c.full + c.half * p.hh + c.zsp * p.zsp + c.brk * p.H + c.nbrk * p.Lc + c.cbrk * p.Kc;
const unitCost = (kind: Kind, p: Params) =>
    kind === 'full'
        ? 1
        : kind === 'half'
          ? p.hh
          : kind === 'zsp'
            ? p.zsp
            : kind === 'brk'
              ? p.H
              : p.Lc;

function evaluate(cases: CaseCounts[], p: Params): { lo: number; hi: number } | null {
    let lo = 0;
    let hi = Infinity;
    for (const cse of cases) {
        const a = costOf(cse.pre, p);
        if (cse.kept === -1) {
            if (cse.totalWidth > WIDTH_CAP) return null;
            lo = Math.max(lo, a);
        } else {
            if (cse.preWidth > WIDTH_CAP) return null;
            if (cse.preWidth + cse.nextWidth > WIDTH_CAP) continue; // 幅上限が犯人
            lo = Math.max(lo, a);
            const next = unitCost(cse.nextIsBrk!, p) + (cse.nextIsCharBreak ? p.Kc : 0);
            hi = Math.min(hi, a + next - 1e-9);
        }
    }
    return lo <= hi ? { lo, hi } : null;
}

/**
 * 厳密解が無いので**最良近似**を探す。
 * 切断ケースの「残存プレフィックスのコスト」は全て C にほぼ等しくなるはずなので、
 * その散らばり（最大 − 最小）を最小化するパラメータを選ぶ。
 * 併せて、無傷ケースのコストが C を超えていないか（超過ぶん）も罰則に入れる。
 */
interface Fit {
    p: Params;
    spread: number;
    penalty: number;
    C: number;
    detail: { name: string; cost: number; cut: boolean }[];
}

function fit(cases: CaseCounts[], p: Params): Fit {
    const cutCosts: number[] = [];
    const detail: { name: string; cost: number; cut: boolean }[] = [];
    for (let i = 0; i < cases.length; i++) {
        const cse = cases[i];
        const cost = costOf(cse.pre, p);
        const isCut = cse.kept !== -1;
        // 幅上限 B が犯人のケース（PD2/PD3）は A の評価から外す
        const byWidth = isCut && cse.preWidth + cse.nextWidth > WIDTH_CAP;
        detail.push({ name: data[i][0], cost, cut: isCut && !byWidth });
        if (isCut && !byWidth) cutCosts.push(cost);
    }
    const C = Math.min(...cutCosts);
    const spread = Math.max(...cutCosts) - C;
    // 無傷なのに C を超えているぶんの合計（本来 0 であるべき）
    let penalty = 0;
    for (const d of detail) if (!d.cut && d.cost > C) penalty += d.cost - C;
    return { p, spread, penalty, C, detail };
}

let best: Fit | null = null;
for (let Wi = 2020; Wi <= 2060; Wi += 4) {
    const W = Wi / 100;
    const cases = prepare(W);
    for (let Hi = 0; Hi <= 400; Hi += 5) {
        const H = Hi / 20; // 0〜20 を 0.25 刻み
        for (const Lc of [0, 0.25, 0.5, 0.75, 1, 1.5, 2]) {
            for (const hh of [0, 0.25, 0.5, 0.75, 1]) {
                for (const zsp of [0, 0.25, 0.5, 0.75, 1]) {
                    for (let Kci = 0; Kci <= 60; Kci += 2) {
                        const Kc = Kci / 4; // 0〜15 を 0.5 刻み
                        const f = fit(cases, { W, H, Lc, hh, zsp, Kc });
                        const score = f.spread + f.penalty;
                        if (!best || score < best.spread + best.penalty) best = f;
                    }
                }
            }
        }
    }
}

if (best) {
    const p = best.p;
    console.log('=== 最良近似モデル ===');
    console.log(
        `W=${p.W} 改行sp=${p.H} 非改行sp=${p.Lc} 半角=${p.hh} 全角sp=${p.zsp} 文字折り返し=${p.Kc}`,
    );
    console.log(
        `C ≈ ${best.C.toFixed(2)} / 切断群のばらつき=${best.spread.toFixed(2)} / 無傷群の超過=${best.penalty.toFixed(2)}`,
    );
    console.log('');
    for (const d of best.detail) {
        const mark = d.cut ? '切断' : '無傷';
        const diff = d.cost - best.C;
        console.log(
            `${mark} ${d.name}: コスト=${d.cost.toFixed(1)} (C との差 ${diff >= 0 ? '+' : ''}${diff.toFixed(1)})`,
        );
    }
}
