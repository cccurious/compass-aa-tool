/**
 * 「破綻」判定の行に紛れていた**片方の端末では表示できていた文字**を救済するプローブ。
 *
 * 2026-07-26 の全数検証で、行単位では破綻していても
 * 「この文字は出ていた」という報告があったものを集めた。
 * 全角幅で両端末とも表示できるなら、パレットに戻せる。
 *
 * 1 行 = 検査文字 + 全角スペース + ■（右端の目印）+ 半角スペース（改行の確定）。
 * 使い方: node scripts/gen-rescue-probe.mjs
 */
const CANDIDATES = [
    ['丸系（◈◍ 以外は表示されていた）', '◉◊◎◐◑◒◓'],
    ['大きい丸（◔◕◖◗ 以外は表示されていた）', '◯'],
    ['白丸（この行で唯一表示されていた）', '◦'],
    ['右向き三角（Android で表示されていた）', '▶▷'],
    ['左向き三角（Android で表示されていた）', '◀◁'],
    ['角丸長方形（▬▭▮▯▰ 以外の 1 文字）', '▱'],
];

const chars = CANDIDATES.flatMap(([, c]) => Array.from(c));
const lines = [];
for (let i = 0; i < chars.length; i += 10) {
    const group = chars.slice(i, i + 10).join('');
    lines.push(group + '　'.repeat(20 - group.length - 1) + '■');
}

console.log(`救済候補 ${chars.length} 文字 → ${lines.length} 行 → 1 メッセージ\n`);
const text = lines.join(' ');
const cs = Array.from(text);
const units = cs.reduce((a, c) => a + (c === ' ' ? 6.75 : c === '　' ? 0.75 : 1), 0);
console.log(`--- 送信用（${cs.length} 字 / ${units} units）---`);
console.log(text);
console.log('');
lines.forEach((l, i) => console.log(`  ${i + 1}行目: ${Array.from(l).slice(0, 10).join('')}`));
console.log('');
console.log('内訳:');
for (const [name, c] of CANDIDATES) console.log(`  ${c} … ${name}`);
console.log('');
console.log('※ この 14 文字は「片方の端末では表示されていた」もの。');
console.log('   iOS と Android の**両方**で ■ が右端に揃っていれば救済できる。');
