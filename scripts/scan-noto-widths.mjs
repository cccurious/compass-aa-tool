/**
 * Android 側の幅予測リストの生成（確定ロジックの層 2・Android 担当）。
 *
 * Android のフォールバック先はシステムの Noto Sans CJK と確定済み
 * （calibration-plan.md「Android はフォントファイル直読みで成立」・36/37 一致）。
 * calibrate-scan.html（iOS 側）と同じブロックを走査し、全角 1.0 で
 * ないか・グリフが無い文字を洗い出す。
 *
 * 使い方: node scripts/scan-noto-widths.mjs <NotoSansCJKjp-Regular.otf のパス>
 * 出力: docs/notes/noto-scan.json
 */
import * as fontkit from 'fontkit';
import { writeFileSync } from 'node:fs';

const fontPath = process.argv[2];
if (!fontPath) {
    console.error('フォントファイルのパスを指定してください（noto-cjk の NotoSansCJKjp-Regular.otf）');
    process.exit(1);
}
const font = fontkit.openSync(fontPath);
const upem = font.unitsPerEm;

const BLOCKS = [
    [0x0370, 0x03ff], [0x0400, 0x045f], [0x2010, 0x205e], [0x2100, 0x214f],
    [0x2150, 0x218b], [0x2190, 0x21ff], [0x2200, 0x22ff], [0x2300, 0x23ff],
    [0x2460, 0x24ff], [0x2500, 0x257f], [0x2580, 0x259f], [0x25a0, 0x25ff],
    [0x2600, 0x26ff], [0x2700, 0x27bf], [0x3000, 0x303f], [0x3200, 0x32ff],
    [0x3300, 0x33ff],
];

let total = 0;
const deviant = {};
let missing = '';
for (const [a, b] of BLOCKS) {
    for (let cp = a; cp <= b; cp++) {
        const ch = String.fromCodePoint(cp);
        total++;
        if (!font.hasGlyphForCodePoint(cp)) {
            missing += ch;
            continue;
        }
        const w = font.layout(ch).glyphs[0].advanceWidth / upem;
        if (Math.abs(w - 1.0) > 0.03) {
            const key = w.toFixed(2);
            deviant[key] = (deviant[key] ?? '') + ch;
        }
    }
}
const out = {
    v: 'noto-scan-v1',
    font: `${font.fullName} (${font.version ?? ''})`,
    total,
    deviant,
    missing,
};
writeFileSync('docs/notes/noto-scan.json', JSON.stringify(out, null, 1));
const nDev = Object.values(deviant).reduce((s, c) => s + Array.from(c).length, 0);
console.log(`走査 ${total} 文字 / 非全角 ${nDev} 文字 / グリフ無し ${Array.from(missing).length} 文字`);
console.log('→ docs/notes/noto-scan.json');
