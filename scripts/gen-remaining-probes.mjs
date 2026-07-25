/**
 * AA 変換の精度を上げるための残り検証プローブ。
 *
 * 目的は 2 つ:
 *   ① まだ実機で見ていない文字の幅を確定する
 *   ② **iOS と Android で一致しているか**を確かめる（一致していれば AA 変換で救える）
 *
 * 1 行 = 検査文字 10 個 + 全角スペース + ■（右端の目印）+ 半角スペース（改行の確定）。
 * 各行は独立するので、崩れた行だけを次のラウンドで詰められる。
 *
 * 使い方: node scripts/gen-remaining-probes.mjs
 */

const GROUPS = [
    // --- 優先度 1: パレットから予防的に外したもの（戻せる可能性が高い） ---
    ['二重罫線の残り（╠╣╦╩╬ は未確認のまま外している）', '╠╣╦╩╬'],

    // --- 優先度 2: 幾何学図形の残り（救済プローブで一部が生きていた系統） ---
    ['丸の残り', '◈◌◍◔◕◖◗'],
    ['弧・塗り分け', '◘◙◚◛◜◝◞◟◠◡'],
    ['四角の塗り分け', '◧◨◩◪◫◬◭◮'],
    ['四角と斜めの分割', '◰◱◲◳◴◵◶◷◸◹◺◻◼◽◾◿'],
    ['小さい四角・長方形', '▢▣▤▥▦▧▨▩▪▫▬▭▮▯▰'],
    ['小さい三角', '▴▵▸▹►▻▾▿◂◃◄◅'],

    // --- 優先度 3: AA で頻出だが幅が「上限のみ判明」の半角 ---
    // （幅そのものは別プローブで測る。ここでは端末差の有無だけ見る）

    // --- 優先度 4: 罫線の落ちた系統（念のため個別確認） ---
    ['罫線の破線', '┄┅┆┇┈┉┊┋╌╍╎╏'],
    ['二重線と単線の接合', '╒╓╕╖╘╙╛╜╞╟╡╢╤╥╧╨╪╫'],
    ['斜めと端点', '╱╲╳╴╵╶╷╸╹╺╻╼╽╾╿'],
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

const total = GROUPS.reduce((a, [, c]) => a + Array.from(c).length, 0);
console.log(`検査 ${total} 文字 → ${lines.length} 行 → ${Math.ceil(lines.length / LINES_PER_MESSAGE)} メッセージ\n`);
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
