import { create } from 'zustand';
import { DotGrid, emptyGrid, GRID_COLS } from '../core/grid';
import { charWidth } from '../core/metrics';

/** プリセットは実機で表示・幅を検証済みの全角文字のみ */
export const PRESET_PALETTE = [
  '█', '▓', '▒', '░', '▌',
  '■', '□', '●', '○', '◆', '◇', '▲', '△', '▼', '▽', '★', '☆', '・', 'ω',
];

const INITIAL_ROWS = 8;

/**
 * 行数の上限。実測（tests の行数上限テスト）で、1 メッセージ 184 文字に収まる
 * 行数は密度で 8〜15 行（幅 20 の密画で 8 行・幅 11 前後で 15 行）。
 * 物理上限の 15 を採り、実際に入るかは文字数カウンタで示す。
 */
export const MAX_ROWS = 15;

/**
 * ユーザー追加文字の上限。パレットは 1 行 7 個（375px 幅）で並ぶため、
 * 2 行ぶんの 14 個を上限とする（プリセット 19＋消しゴムで既に 3 行）。
 */
export const MAX_CUSTOM_CHARS = 14;

export interface BulkAddResult {
  added: string[];
  /** 半角など全角幅 1.0 でないため除外した文字 */
  skipped: string[];
  /** 上限に達して入らなかった文字 */
  overflow: string[];
}

interface DotState {
  grid: DotGrid;
  /** ユーザーが追加した文字（プリセットとは別管理・まとめて消せる） */
  customPalette: string[];
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

export const useDotStore = create<DotState>((set, get) => ({
  grid: emptyGrid(INITIAL_ROWS),
  customPalette: [],
  brush: '█',
  strokeErase: null,
  setBrush: (ch) => set({ brush: ch }),

  // 同じ文字のセルを塗ると消去になる（トグル）。判定はストローク開始時に
  // 一度だけ行い、ドラッグ中は同じモードを保つ（1 セルごとに反転すると
  // なぞった軌跡が虫食いになるため）
  beginStroke: (row, col) =>
    set((s) => {
      if (row < 0 || row >= s.grid.length || col < 0 || col >= GRID_COLS) return s;
      const erase = s.brush !== '' && s.grid[row][col] === s.brush;
      return { strokeErase: erase, grid: putCell(s.grid, row, col, erase ? '' : s.brush) };
    }),
  endStroke: () => set({ strokeErase: null }),
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
    const overflow: string[] = [];
    for (const ch of Array.from(text)) {
      if (existing.has(ch) || added.includes(ch)) continue;
      // 全角幅 1.0 の文字だけがグリッドのマス目に乗る（半角は形が崩れる）
      if (charWidth(ch) !== 1.0) {
        if (!skipped.includes(ch)) skipped.push(ch);
        continue;
      }
      if (state.customPalette.length + added.length >= MAX_CUSTOM_CHARS) {
        overflow.push(ch);
        continue;
      }
      added.push(ch);
    }
    if (added.length > 0) {
      set({ customPalette: [...state.customPalette, ...added], brush: added[0] });
    }
    return { added, skipped, overflow };
  },
  clearCustom: () =>
    set((s) => ({
      customPalette: [],
      brush: s.customPalette.includes(s.brush) ? '█' : s.brush,
    })),

  addRow: () =>
    set((s) =>
      s.grid.length >= MAX_ROWS ? s : { grid: [...s.grid, Array(GRID_COLS).fill('')] },
    ),
  removeRow: () => set((s) => (s.grid.length > 1 ? { grid: s.grid.slice(0, -1) } : s)),
  clearAll: () => set((s) => ({ grid: emptyGrid(s.grid.length) })),
}));
