/**
 * 「幅テーブルが 1.0 と断言しているのに、実機で 1 文字ずつ見ていない文字」の一覧。
 *
 * 端末差が出るのは**ゲームのフォントアトラスに無くフォールバックで描かれる文字**
 * （＝層 3）だけ。かな・漢字・全角記号（層 1）と ASCII（層 2）はアトラス内なので
 * OS が変わっても同じ。したがって層 3 のうち未検証のものが危険リスト。
 *
 * 使い方: node scripts/list-unverified.mjs
 */

/** 幅 1.0 として扱っている層 3 の範囲（src/core/metrics.ts と一致させること） */
const CLAIMED_RANGES = [
    ['罫線素片', 0x2500, 0x257f],
    ['ブロック要素', 0x2580, 0x259f],
    ['幾何学図形', 0x25a0, 0x25ff],
];

/** 2026-07-26 までに実機で 1 文字ずつ見た文字 */
const TESTED = new Set(
    Array.from(
        // 一括プローブ（第 2 ラウンド）
        '□┌┐└┘╭╮╰╯├┤┬┴┼━┃┏┓┗┛┣┫┳┻╋┍┑┕┙┎┒┖┚┝┥┰┸●○◆◇▲△▼▽・ω★☆♠♣♥♦♪♭♯♀♂' +
            '←↑→↓↔↖↗↘↙⇒⇔⇐⇆⇦⇨∀∩∪∧∨√∞∴∵≠≡≒⊂⊃∈∋⌒☀☁☂☃☎☜☞✓' +
            '「」『』【】〈〉《》〜※〆〇々αβγδεπρστΑΔΘΣΦΨΩДЖ①②③④⑤⑥⑦⑧⑨⑩' +
            // 犯人特定プローブ
            '█▄▌▐◤◥◣◢─│' +
            // ブロック比較プローブ
            '▀░▒▓▘▝▖▗▚▞▛▜▙▟■' +
            // 二重罫線（半分と判明）
            '═║╔╗╚╝╠╣╦╩╬',
    ),
);

console.log('=== 幅 1.0 と断言しているが未検証の文字 ===\n');
const buckets = [];
for (const [name, lo, hi] of CLAIMED_RANGES) {
    const chars = [];
    for (let cp = lo; cp <= hi; cp++) {
        const ch = String.fromCodePoint(cp);
        if (!TESTED.has(ch)) chars.push(ch);
    }
    const total = hi - lo + 1;
    console.log(`【${name}】U+${lo.toString(16)}〜U+${hi.toString(16)}: 全 ${total} 字中 ${chars.length} 字が未検証`);
    console.log(`  ${chars.join('')}\n`);
    buckets.push({ name, chars });
}
const all = buckets.flatMap((b) => b.chars);
console.log(`合計 ${all.length} 字が未検証`);
export { buckets, all };
