import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DotGrid, emptyGrid, GRID_COLS } from '../core/grid';
import { charWidth } from '../core/metrics';
import { PRESET_PALETTE } from '../core/palette';

const INITIAL_ROWS = 8;

/**
 * 行数の上限。上限は units（全角換算 271）で、全角充填パディングなら
 * どの密度でも 13〜14 行入る（tests の行数上限テスト）。物理上限の 15 を採り、
 * 実際に入るかは文字数カウンタが units と入力欄の文字数観測値の両面で示す。
 */
export const MAX_ROWS = 15;

/** 「最近使った」に残す数（36px ボタンでスマホ 2 段に収まる上限） */
export const MAX_RECENT = 12;

/**
 * ユーザー追加文字の上限。パレット表示は 3 段で内部スクロールするので
 * 多めに取れる。超えたら**古いものから押し出す**（新規優先。
 * 拒否方式だと「消してから足す」の手間を強いるため）。
 */
export const MAX_CUSTOM_CHARS = 30;

/**
 * アンドゥ履歴の上限。grid は最大 15 行 × 20 列の string 配列なので
 * 50 件持っても数十 KB 程度（メモリだけの話。persist には含めない）。
 */
const MAX_HISTORY = 50;

export interface BulkAddResult {
    added: string[];
    /** 半角など全角幅 1.0 でないため除外した文字 */
    skipped: string[];
    /** 上限を超えたため押し出された古い文字 */
    evicted: string[];
}

interface DotState {
    grid: DotGrid;
    /** アンドゥ用のスナップショット（古い順）。ストローク・行操作・全消去の単位で積む */
    history: DotGrid[];
    undo: () => void;
    /** ユーザーが追加した文字（プリセットとは別管理・まとめて消せる） */
    customPalette: string[];
    /** 最近選んだ文字（新しい順・最大 MAX_RECENT） */
    recentChars: string[];
    /** 選択中の文字。'' は消しゴム */
    brush: string;
    setBrush: (ch: string) => void;
    /** ストローク中の塗りモード。null は未決定（pointerdown で決まる） */
    strokeErase: boolean | null;
    beginStroke: (row: number, col: number) => void;
    endStroke: () => void;
    paint: (row: number, col: number) => void;
    addPaletteChars: (text: string) => BulkAddResult;
    clearCustom: () => void;
    addRow: () => void;
    removeRow: () => void;
    clearAll: () => void;
}

const putCell = (grid: DotGrid, row: number, col: number, value: string): DotGrid =>
    grid.map((r, ri) => (ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r));

/** 現在の grid を履歴へ積む（上限超過は古い方から捨てる）。grid は不変更新なので参照共有で十分 */
const pushHistory = (s: Pick<DotState, 'grid' | 'history'>): DotGrid[] =>
    [...s.history, s.grid].slice(-MAX_HISTORY);

export const useDotStore = create<DotState>()(
    persist(
        (set, get) => ({
            grid: emptyGrid(INITIAL_ROWS),
            history: [],
            customPalette: [],
            recentChars: [],
            brush: '█',
            strokeErase: null,
            setBrush: (ch) =>
                set((s) => {
                    // 既に入っている文字は並べ替えない（選ぶたびにボタンが動くと押し間違えるため）
                    if (ch === '' || s.recentChars.includes(ch)) return { brush: ch };
                    return { brush: ch, recentChars: [ch, ...s.recentChars].slice(0, MAX_RECENT) };
                }),

            // 同じ文字のセルを塗ると消去になる（トグル）。判定はストローク開始時に
            // 一度だけ行い、ドラッグ中は同じモードを保つ（1 セルごとに反転すると
            // なぞった軌跡が虫食いになるため）
            beginStroke: (row, col) =>
                set((s) => {
                    if (row < 0 || row >= s.grid.length || col < 0 || col >= GRID_COLS) return s;
                    const erase = s.brush !== '' && s.grid[row][col] === s.brush;
                    // 履歴はストローク単位（開始時に 1 回だけ積み、ドラッグ中の paint では積まない）
                    return {
                        strokeErase: erase,
                        history: pushHistory(s),
                        grid: putCell(s.grid, row, col, erase ? '' : s.brush),
                    };
                }),
            endStroke: () => set({ strokeErase: null }),
            undo: () =>
                set((s) => {
                    const prev = s.history[s.history.length - 1];
                    if (!prev) return s;
                    return { grid: prev, history: s.history.slice(0, -1), strokeErase: null };
                }),
            paint: (row, col) =>
                set((s) => {
                    if (row < 0 || row >= s.grid.length || col < 0 || col >= GRID_COLS) return s;
                    const value = s.strokeErase ? '' : s.brush;
                    if (s.grid[row][col] === value) return s;
                    return { grid: putCell(s.grid, row, col, value) };
                }),

            addPaletteChars: (text) => {
                const state = get();
                const existing = new Set([...PRESET_PALETTE, ...state.customPalette]);
                const added: string[] = [];
                const skipped: string[] = [];
                for (const ch of Array.from(text)) {
                    if (existing.has(ch) || added.includes(ch)) continue;
                    // 全角幅 1.0 の文字だけがグリッドのマス目に乗る（半角は形が崩れる）
                    if (charWidth(ch) !== 1.0) {
                        if (!skipped.includes(ch)) skipped.push(ch);
                        continue;
                    }
                    added.push(ch);
                }
                // 上限を超えたら古いものから押し出す（配列の先頭が最古）
                const merged = [...state.customPalette, ...added];
                const evicted =
                    merged.length > MAX_CUSTOM_CHARS
                        ? merged.slice(0, merged.length - MAX_CUSTOM_CHARS)
                        : [];
                if (added.length > 0) {
                    set({ customPalette: merged.slice(-MAX_CUSTOM_CHARS), brush: added[0] });
                }
                return { added, skipped, evicted };
            },
            clearCustom: () =>
                set((s) => ({
                    customPalette: [],
                    brush: s.customPalette.includes(s.brush) ? '█' : s.brush,
                })),

            // 行操作と全消去もアンドゥ対象（特に行削除と全消去は絵が消えるので戻せないと痛い）
            addRow: () =>
                set((s) =>
                    s.grid.length >= MAX_ROWS
                        ? s
                        : {
                              history: pushHistory(s),
                              grid: [...s.grid, Array(GRID_COLS).fill('')],
                          },
                ),
            removeRow: () =>
                set((s) =>
                    s.grid.length > 1
                        ? { history: pushHistory(s), grid: s.grid.slice(0, -1) }
                        : s,
                ),
            clearAll: () =>
                set((s) =>
                    s.grid.some((row) => row.some((c) => c !== ''))
                        ? { history: pushHistory(s), grid: emptyGrid(s.grid.length) }
                        : s,
                ),
        }),
        {
            name: 'compass-aa-dot',
            // パレット関連だけ保存する。描きかけのグリッドは保存しない
            // （次に開いたとき前回の絵が残っていると驚くため）
            partialize: (s) => ({ recentChars: s.recentChars, customPalette: s.customPalette }),
        },
    ),
);
