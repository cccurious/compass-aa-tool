/**
 * 端末差（iOS で半角になる文字）を洗い出す一括プローブの生成。
 *
 * 1 行の構造: [検査文字 10 個][全角スペース 9 個][■][半角スペース]
 *   - 幅は 10 + 9 + 1 = 20。末尾の半角スペースが「次の行の語（20 幅）が入らない」
 *     判定を起こすので**必ずそこで改行**する ＝ 各行が独立し、
 *     1 つの文字が半角でも後続行に影響しない（カスケードしない）
 *   - 右端の ■ が位置合わせの目印。行内に半角化する文字があると
 *     その行の ■ だけ左へ 0.5 字ぶんずれる ＝ 右端がガタつく行が犯人
 *
 * 使い方: node scripts/gen-width-batch.mjs
 * 実機で送って「右端の ■ が揃っていない行」を報告してもらい、
 * その行の 10 文字を次のラウンドで 1 文字ずつ詰める。
 */
const LINES_PER_MESSAGE = 7; // units 24.5/行 × 7 = 171.5（上限 197）

// 検査対象: パレットのプリセットと「候補から選ぶ」の全文字
const PRESET =
    '█■□▄▌▐' +
    '◤◥◣◢' +
    '─│┌┐└┘╭╮╰╯├┤┬┴┼' +
    '━┃┏┓┗┛┣┫┳┻╋' +
    '┍┑┕┙┎┒┖┚┝┥┰┸' +
    '═║╔╗╚╝╠╣╦╩╬';
const SUGGEST =
    '●○◆◇▲△▼▽・ω' +
    '★☆♠♣♥♦♪♭♯♀♂' +
    '←↑→↓↔↖↗↘↙⇒⇔⇐⇆⇦⇨' +
    '∀∩∪∧∨√∞∴∵≠≡≒⊂⊃∈∋⌒' +
    '☀☁☂☃☎☜☞✓' +
    '「」『』【】〈〉《》〜※〆〇々' +
    'αβγδεπρστωΑΔΘΣΦΨΩДЖ' +
    '①②③④⑤⑥⑦⑧⑨⑩';

/**
 * 既に実機で「半角になる／見えない」と確定した文字は検査対象から外す
 * （src/core/metrics.ts の DEVICE_VARIANT_CHARS と同じ内容）。
 * 除外しておかないと、その行が必ず崩れて他の文字の判定を隠してしまう。
 */
const KNOWN_BAD = new Set(Array.from('▀▐░▒▓▘▝▖▗▚▞▛▜▙▟↕═║╔╗╚╝╠╣╦╩╬'));

/** 既に「全角で正常」と確認できた文字も外す（検査を残りに集中させる） */
const KNOWN_OK = new Set(Array.from('█▄▌◤◥◣◢─│'));

// ■ は目印に使うので検査対象から外す（重複を除いて順序は保つ）
const chars = [...new Set(Array.from(PRESET + SUGGEST))].filter(
    (c) => c !== '■' && !KNOWN_BAD.has(c) && !KNOWN_OK.has(c),
);

const lines = [];
for (let i = 0; i < chars.length; i += 10) {
    const group = chars.slice(i, i + 10).join('');
    const pad = '　'.repeat(20 - group.length - 1); // 検査文字 + 全角スペース + ■ で 20 幅
    lines.push(group + pad + '■');
}

console.log(`検査対象 ${chars.length} 文字 → ${lines.length} 行 → ${Math.ceil(lines.length / LINES_PER_MESSAGE)} メッセージ\n`);
for (let m = 0; m * LINES_PER_MESSAGE < lines.length; m++) {
    const chunk = lines.slice(m * LINES_PER_MESSAGE, (m + 1) * LINES_PER_MESSAGE);
    // 行末の半角スペースで改行を確定させる（最終行は不要）
    const text = chunk.join(' ');
    const cs = Array.from(text);
    const units =
        cs.reduce((a, c) => a + (c === ' ' ? 6.75 : c === '　' ? 0.75 : 1), 0);
    console.log(`--- メッセージ ${m + 1}（${chunk.length} 行 / ${cs.length} 字 / ${units} units）---`);
    console.log(text);
    console.log('  収録文字:', chunk.map((l, i) => `${m * LINES_PER_MESSAGE + i + 1}行目=${l.slice(0, 10)}`).join(' '));
    console.log('');
}
