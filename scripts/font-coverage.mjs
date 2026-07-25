import * as fontkit from 'fontkit';

const TARGETS = Array.from(
    new Set(
        Array.from(
            '█■□▄▌▐◤◥◣◢' +
                '─│┌┐└┘╭╮╰╯├┤┬┴┼━┃┏┓┗┛┣┫┳┻╋┍┑┕┙┎┒┖┚┝┥┰┸═║╔╗╚╝╠╣╦╩╬' +
                '●○◆◇▲△▼▽・ω★☆♠♣♥♦♪♭♯♀♂' +
                '←↑→↓↔↕↖↗↘↙⇒⇔⇐⇆⇦⇨' +
                '∀∩∪∧∨√∞∴∵≠≡≒⊂⊃∈∋⌒' +
                '☀☁☂☃☎☜☞✓' +
                '「」『』【】〈〉《》〜※〆〇々' +
                'αβγδεπρστωΑΔΘΣΦΨΩДЖ' +
                '①②③④⑤⑥⑦⑧⑨⑩',
        ),
    ),
);

const FONTS = [
    ['Consolas（端末の等幅）', 'C:/Windows/Fonts/consola.ttf'],
    ['Segoe UI（Windows の UI）', 'C:/Windows/Fonts/segoeui.ttf'],
    ['Cascadia Mono', 'C:/Windows/Fonts/CascadiaMono.ttf'],
    ['Arial', 'C:/Windows/Fonts/arial.ttf'],
];

for (const [label, path] of FONTS) {
    let font;
    try {
        font = fontkit.openSync(path);
    } catch {
        console.log(`\n=== ${label} : 読み込めず（${path}）`);
        continue;
    }
    const em = font.unitsPerEm;
    // 全角の基準: このフォントに「あ」があればその幅、無ければ em をそのまま使う
    const hasKana = font.hasGlyphForCodePoint('あ'.codePointAt(0));
    const narrow = [];
    const wide = [];
    const missing = [];
    for (const ch of TARGETS) {
        const cp = ch.codePointAt(0);
        if (!font.hasGlyphForCodePoint(cp)) {
            missing.push(ch);
            continue;
        }
        const g = font.glyphForCodePoint(cp);
        const w = g.advanceWidth / em;
        (w < 0.75 ? narrow : wide).push(`${ch}(${w.toFixed(2)})`);
    }
    console.log(`\n=== ${label} : em=${em} / かな収録=${hasKana}`);
    console.log(`  ★このフォントが持っていて狭い（＝PC で半角に見える）: ${narrow.length} 字`);
    console.log(`    ${narrow.join(' ')}`);
    console.log(`  持っているが全角幅: ${wide.length} 字  ${wide.slice(0, 20).join(' ')}`);
    console.log(`  フォント外（＝CJK フォントへ落ちる＝全角で描かれる）: ${missing.length} 字`);
    console.log(`    ${missing.join('')}`);
}
