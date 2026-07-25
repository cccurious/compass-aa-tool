/**
 * ドット打ちグリッド → AA テキスト変換（純関数）。
 *
 * 文字数節約の規則（docs/notes/dot-editor-requirements.md）:
 * - 行末（右端）の空セルは出力しない（行末の全角スペースはパディングと重複するだけ）
 * - 左端・中間の空セルは全角スペース（字下げ・隙間はキャリー仕様で保たれる）
 * - 全空行は空文字列（convert の空行処理が全角スペース 1 個行にする）
 * - 末尾の全空行は削る
 */

/** グリッドのセル。'' が空セル、それ以外は全角 1 文字 */
export type DotGrid = string[][];

export const GRID_COLS = 20;

export function emptyGrid(rows: number): DotGrid {
    return Array.from({ length: rows }, () => Array(GRID_COLS).fill(''));
}

export function gridToText(grid: DotGrid): string {
    const lines = grid.map((row) => {
        let lastFilled = -1;
        row.forEach((cell, i) => {
            if (cell !== '') lastFilled = i;
        });
        return row
            .slice(0, lastFilled + 1)
            .map((cell) => (cell === '' ? '　' : cell))
            .join('');
    });
    // 末尾の全空行を削る
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n');
}
