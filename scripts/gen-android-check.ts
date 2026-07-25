/**
 * 「安全」としている文字を **Android でも**確認するためのプローブ生成。
 *
 * これまでの検証はほぼ iOS で行っており、逆方向（iOS で OK・Android で NG）は
 * 潰せていない。両端末で通ったものだけを安全とすれば、AA 変換の信頼性が上がる。
 *
 * 1 行 = 検査文字 10 個 + 全角スペース + ■（右端の目印）+ 半角スペース（改行の確定）。
 * 各行は独立するので、崩れた行だけを次のラウンドで詰められる。
 *
 * 使い方: npx vite-node scripts/gen-android-check.ts
 */
import { PRESET_PALETTE, SUGGEST_CHARS } from '../src/core/palette';

const LINES_PER_MESSAGE = 7;

// ■ は目印に使うので検査対象から外す
const chars = [...new Set([...PRESET_PALETTE, ...SUGGEST_CHARS])].filter((c) => c !== '■');

const lines: string[] = [];
for (let i = 0; i < chars.length; i += 10) {
    const group = chars.slice(i, i + 10).join('');
    lines.push(group + '　'.repeat(20 - group.length - 1) + '■');
}

console.log(
    `安全リスト ${chars.length} 文字 → ${lines.length} 行 → ${Math.ceil(lines.length / LINES_PER_MESSAGE)} メッセージ\n`,
);
for (let m = 0; m * LINES_PER_MESSAGE < lines.length; m++) {
    const from = m * LINES_PER_MESSAGE;
    const chunk = lines.slice(from, from + LINES_PER_MESSAGE);
    const text = chunk.join(' ');
    const cs = Array.from(text);
    const units = cs.reduce((a, c) => a + (c === ' ' ? 6.75 : c === '　' ? 0.75 : 1), 0);
    console.log(`--- メッセージ ${m + 1}（${chunk.length} 行 / ${cs.length} 字 / ${units} units）---`);
    console.log(text);
    chunk.forEach((l, i) =>
        console.log(`  ${from + i + 1}行目: ${Array.from(l).slice(0, 10).join('')}`),
    );
    console.log('');
}
