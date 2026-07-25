/**
 * 最終確認ラウンド: **両端末での一致が取れていない文字**の洗い出し。
 *
 * 端末差が出るのはゲームのフォントアトラスに無い「層 3」だけ
 * （かな・漢字・全角記号・ASCII はアトラス内なので OS が変わっても同じ）。
 * これまでの検証はほぼ iOS 側で行っており、Android との一致は未確認だった。
 *
 * 対象:
 *   ① パレット＋候補の全文字（iOS では確認済み・Android 未確認）
 *   ② VERIFIED_FULLWIDTH に入っているが候補に出していない層 3 の文字のうち、
 *      AA でよく使うもの（数学記号の残り・ギリシャ/キリルの残り・
 *      約物・単位・囲み数字の残り）
 *
 * 形式は一括プローブ（1 行 10 文字＋右端に ■）。生存率が高い集団なので
 * こちらが効率的で、崩れた行だけ 3 文字プローブで詰め直せばよい。
 *
 * 使い方: npx vite-node scripts/gen-final-check.ts
 */
import { PRESET_PALETTE, SUGGEST_CHARS } from '../src/core/palette';

const LINES_PER_MESSAGE = 7;

/** 候補に出していないが AA で使われる層 3 の文字（アトラス外＝端末差の可能性がある） */
const EXTRA =
    // 数学記号の残り
    '∂∃∇∏∑∝∠∫∬∮≦≧⊆⊇⊥∽≪≫∟⊿' +
    // 矢印の残り
    '⇄⇅' +
    // ギリシャ小文字の残り
    'ζηθικλμνξο' +
    // ギリシャ大文字・キリルの残り
    'ΒΓΛΞΠЗИЛПФЯ' +
    // 欧文記号・約物（… や ± は AA でも使う）
    '§¶†‡‰′″‥…〝〟±×÷' +
    // 囲み数字の残り
    '⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳' +
    // ローマ数字・単位（機種依存文字として AA に紛れることがある）
    'ⅠⅡⅢⅣⅤⅵⅶⅷⅸⅹ℡№㈱㈲㍻㎜㎝㎞㎏㎡';

/**
 * パレット・候補の文字は実機（iOS）で 1 文字ずつ確認済みなので対象から外す。
 * 残るのは「幅 1.0 として登録しているが個別に見ていない」文字＝
 * 2026-07-25 の一括判定（テスト 20 文字＋判定文字 O）だけを根拠にしているもの。
 * あの方式は巻き添えで誤判定しうることが後に判明したため、ここを潰せば
 * 幅テーブルの根拠が全て個別確認で揃う。
 */
const known = new Set([...PRESET_PALETTE, ...SUGGEST_CHARS]);
const chars = [...new Set(Array.from(EXTRA))].filter((c) => c !== '■' && !known.has(c));

const lines: string[] = [];
for (let i = 0; i < chars.length; i += 10) {
    const g = chars.slice(i, i + 10).join('');
    lines.push(g + '　'.repeat(20 - g.length - 1) + '■');
}

console.log(
    `検査 ${chars.length} 文字（幅 1.0 登録済みだが個別未確認のもの。` +
        `パレット・候補の ${known.size} 文字は確認済みのため除外）` +
        ` → ${lines.length} 行 → ${Math.ceil(lines.length / LINES_PER_MESSAGE)} メッセージ\n`,
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
