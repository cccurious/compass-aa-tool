/**
 * 1 行で 3 文字を**個別に**判定するプローブ。
 *
 * 構造: [X×5][■][Y×5][■][Z×5][■][全角スペース×2] + 半角スペース
 *   - 全角なら ■ は 5・11・17 の位置に等間隔で並ぶ
 *   - ある文字が半角なら、その直後の ■ から先が 2.5 字ぶん左へ寄る
 *     → **■ の間隔を見れば、どの文字が細いか 1 行で分かる**
 *   - 末尾の半角スペースが改行を確定させるので各行は独立
 *
 * 一括プローブ（1 行 10 文字）は「10 文字中 1 つ死ぬと残り 9 文字の情報が消える」
 * のが弱点だった。生存率が低い集団ではこちらの方が効率がよい。
 *
 * 使い方: node scripts/gen-triple-probe.mjs "╱╲╳"
 */
const LINES_PER_MESSAGE = 7; // 26.25 units/行 × 7 = 183.75（上限 197）

const target = process.argv[2] ?? '╱╲╳';
const chars = [...new Set(Array.from(target))];

const lines = [];
const labels = [];
for (let i = 0; i < chars.length; i += 3) {
    const g = chars.slice(i, i + 3);
    // 3 文字に満たない行は全角スペースで幅を合わせる
    const body = g.map((c) => c.repeat(5) + '■').join('');
    const used = g.length * 6;
    lines.push(body + '　'.repeat(20 - used));
    labels.push(g.join(' '));
}

console.log(`検査 ${chars.length} 文字 → ${lines.length} 行 → ${Math.ceil(lines.length / LINES_PER_MESSAGE)} メッセージ\n`);
for (let m = 0; m * LINES_PER_MESSAGE < lines.length; m++) {
    const from = m * LINES_PER_MESSAGE;
    const chunk = lines.slice(from, from + LINES_PER_MESSAGE);
    const text = chunk.join(' ');
    const cs = Array.from(text);
    const units = cs.reduce((a, c) => a + (c === ' ' ? 6.75 : c === '　' ? 0.75 : 1), 0);
    console.log(`--- メッセージ ${m + 1}（${chunk.length} 行 / ${cs.length} 字 / ${units} units）---`);
    console.log(text);
    chunk.forEach((_, i) => console.log(`  ${from + i + 1}行目: ${labels[from + i]}`));
    console.log('');
}
console.log('読み方: ■ が等間隔（5・11・17 の位置）なら 3 文字とも全角。');
console.log('        間隔が狭い箇所の直前の文字が細い（半角）。');
console.log('        グリフが出ていない文字は間隔がさらに詰まる（幅 0）。');
