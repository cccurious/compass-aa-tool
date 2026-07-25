import { create } from 'zustand';
import { DotGrid, emptyGrid, GRID_COLS } from '../core/grid';

/** プリセットは実機で表示検証済みの全角文字のみ（C-1〜C-3・ブロック要素プローブ） */
export const PRESET_PALETTE = [
  '█', '▓', '▒', '░', '▌',
  '■', '□', '●', '○', '◆', '◇', '▲', '△', '▼', '▽', '★', '☆', '・', 'ω',
];

const INITIAL_ROWS = 5;

interface DotState {
  grid: DotGrid;
  palette: string[];
  /** 選択中の文字。'' は消しゴム */
  brush: string;
  setBrush: (ch: string) => void;
  paint: (row: number, col: number) => void;
  addPaletteChar: (ch: string) => void;
  addRow: () => void;
  removeRow: () => void;
  clearAll: () => void;
}

export const useDotStore = create<DotState>((set) => ({
  grid: emptyGrid(INITIAL_ROWS),
  palette: [...PRESET_PALETTE],
  brush: '■',
  setBrush: (ch) => set({ brush: ch }),
  paint: (row, col) =>
    set((s) => {
      if (row < 0 || row >= s.grid.length || col < 0 || col >= GRID_COLS) return s;
      if (s.grid[row][col] === s.brush) return s;
      const grid = s.grid.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? s.brush : c)) : r,
      );
      return { grid };
    }),
  addPaletteChar: (ch) =>
    set((s) => (s.palette.includes(ch) ? s : { palette: [...s.palette, ch] })),
  addRow: () => set((s) => ({ grid: [...s.grid, Array(GRID_COLS).fill('')] })),
  removeRow: () =>
    set((s) => (s.grid.length > 1 ? { grid: s.grid.slice(0, -1) } : s)),
  clearAll: () => set((s) => ({ grid: emptyGrid(s.grid.length) })),
}));
