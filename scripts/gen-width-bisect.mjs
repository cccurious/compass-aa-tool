/**
 * 一括プローブ（gen-width-batch.mjs）で「崩れた行」が見つかったあと、
 * その行の 10 文字から犯人を 1 文字ずつ特定するためのプローブ。
 *
 * 1 行の構造: [同じ検査文字 10 個][全角スペース 9 個][■][半角スペース]
 *   - 全角なら幅 20 ちょうど。半角なら 15 になり **■ が 5 字ぶん左へ大きくずれる**
 *     （一括プローブの 0.5 字ぶんのズレより遥かに読みやすい）
 *   - 末尾の半角スペースで改行が確定するので各行は独立
 *
 * 使い方: node scripts/gen-width-bisect.mjs "█▄▌▐◤◥◣◢─│"
 */
const LINES_PER_MESSAGE = 5; // units 24.5/行 × 5 = 122.5（上限 197 に余裕）

const target = process.argv[2] ?? '█▄▌▐◤◥◣◢─│';
const chars = [...new Set(Array.from(target))];

const lines = chars.map((c) => c.repeat(10) + '　'.repeat(9) + '■');

console.log(`検査 ${chars.length} 文字 → ${Math.ceil(lines.length / LINES_PER_MESSAGE)} メッセージ\n`);
for (let m = 0; m * LINES_PER_MESSAGE < lines.length; m++) {
    const chunk = lines.slice(m * LINES_PER_MESSAGE, (m + 1) * LINES_PER_MESSAGE);
    const text = chunk.join(' ');
    const cs = Array.from(text);
    const units = cs.reduce((a, c) => a + (c === ' ' ? 6.75 : c === '　' ? 0.75 : 1), 0);
    console.log(`--- メッセージ ${m + 1}（${chunk.length} 行 / ${cs.length} 字 / ${units} units）---`);
    console.log(text);
    console.log(
        '  各行:',
        chunk.map((l) => Array.from(l)[0]).join(' '),
        '（■ が右端に揃っていれば全角・大きく左にずれていれば半角）',
    );
    console.log('');
}
