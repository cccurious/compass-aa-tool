/**
 * 画面表示専用: 絵文字になりうる文字をモノクロのテキスト字形で描かせる。
 *
 * ⚽⚾ などは Unicode の既定が「絵文字表示」なので、ブラウザがカラー絵文字で
 * 描いてしまう（iOS Safari で顕著）。実機のゲーム内はモノクロのグリフで
 * 出ることを確認済みなので、プレビューやパレットの見た目が実機とずれる。
 * 異体字セレクタ VS15（U+FE0E ＝テキスト表示指定）を後置して字形を揃える。
 *
 * **表示にだけ使うこと。** コピーされる出力テキストに VS15 を混ぜると、
 * ゲーム側でどう数えられるか未検証の文字を 1 つ増やすことになる。
 * 判定は \p{Emoji}（将来ユーザーが貼る未知の文字にも効く汎用判定）。
 * ASCII の数字や # も Emoji プロパティを持つため、全角域だけを対象にする。
 */
const EMOJI_CAPABLE = /\p{Emoji}/u;

export function textGlyph(ch: string): string {
    // VS15 は必ず \u エスケープで書く（不可視文字のリテラル混入は目視で検出できない）
    return ch.codePointAt(0)! > 0xff && EMOJI_CAPABLE.test(ch) ? ch + '︎' : ch;
}

/** 文字列版（警告の文字リストなど、複数文字まとめて表示する箇所用） */
export function textGlyphs(text: string): string {
    return Array.from(text).map(textGlyph).join('');
}
