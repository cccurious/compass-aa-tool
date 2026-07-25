/**
 * 「幅 1.0 と断言しているのに未検証」の文字（list-unverified.mjs が出す 175 字）を
 * 一括検証するプローブを生成する。
 *
 * 1 行 = 検査文字 10 個 + 全角スペース 9 個 + ■ + 半角スペース
 *   末尾の半角スペースが改行を強制するので各行は独立（カスケードしない）。
 *   右端の ■ が揃っていない行に、半角化する文字が混じっている。
 *
 * 使い方: node scripts/gen-unverified-probes.mjs
 */
const GROUPS = [
    ['罫線・破線', '┄┅┆┇┈┉┊┋╌╍╎╏'],
    ['罫線・太細の接合', '┞┟┠┡┢┦┧┨┩┪┭┮┯┱┲┵┶┷┹┺┽┾┿╀╁╂╃╄╅╆╇╈╉╊'],
    ['罫線・二重と単線の接合', '╒╓╕╖╘╙╛╜╞╟╡╢╤╥╧╨╪╫'],
    ['罫線・斜めと端点', '╱╲╳╴╵╶╷╸╹╺╻╼╽╾╿'],
    ['ブロック・段階', '▁▂▃▅▆▇▉▊▋▍▎▏▔▕'],
    ['図形・四角', '▢▣▤▥▦▧▨▩▪▫▬▭▮▯▰▱'],
    ['図形・三角', '▴▵▶▷▸▹►▻▾▿◀◁◂◃◄◅'],
    ['図形・丸', '◈◉◊◌◍◎◐◑◒◓◔◕◖◗◯'],
    ['図形・弧と塗り分け', '◘◙◚◛◜◝◞◟◠◡◦◧◨◩◪◫◬◭◮'],
    ['図形・四角と斜め', '◰◱◲◳◴◵◶◷◸◹◺◻◼◽◾◿'],
];

const LINES_PER_MESSAGE = 7;
const lines = [];
const labels = [];
for (const [name, chars] of GROUPS) {
    const cs = Array.from(chars);
    for (let i = 0; i < cs.length; i += 10) {
        const group = cs.slice(i, i + 10).join('');
        lines.push(group + '　'.repeat(20 - group.length - 1) + '■');
        labels.push(`${name}: ${group}`);
    }
}

console.log(`検査 ${GROUPS.reduce((a, [, c]) => a + Array.from(c).length, 0)} 文字 → ${lines.length} 行 → ${Math.ceil(lines.length / LINES_PER_MESSAGE)} メッセージ\n`);
for (let m = 0; m * LINES_PER_MESSAGE < lines.length; m++) {
    const from = m * LINES_PER_MESSAGE;
    const chunk = lines.slice(from, from + LINES_PER_MESSAGE);
    const text = chunk.join(' ');
    const cs = Array.from(text);
    const units = cs.reduce((a, c) => a + (c === ' ' ? 6.75 : c === '　' ? 0.75 : 1), 0);
    console.log(`--- メッセージ ${m + 1}（${chunk.length} 行 / ${cs.length} 字 / ${units} units）---`);
    console.log(text);
    chunk.forEach((_, i) => console.log(`  ${from + i + 1}行目 ${labels[from + i]}`));
    console.log('');
}
