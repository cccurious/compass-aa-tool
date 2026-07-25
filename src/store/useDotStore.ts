import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DotGrid, emptyGrid, GRID_COLS } from '../core/grid';
import { charWidth } from '../core/metrics';
import { PRESET_PALETTE } from '../core/palette';

const INITIAL_ROWS = 8;

/**
 * 行数の上限。実測（tests の行数上限テスト）で、1 メッセージの 512 バイトに
 * 収まる行数は密度で 8〜15 行（幅 20 の密画で 8 行・幅 11 前後で 15 行）。
 * 物理上限の 15 を採り、実際に入るかは文字数カウンタで示す。
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

export interface BulkAddResult {
  added: string[];
  /** 半角など全角幅 1.0 でないため除外した文字 */
  skipped: string[];
  /** 上限を超えたため押し出された古い文字 */
  evicted: string[];
}

interface DotState {
  grid: DotGrid;
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
  /** セルを直接書き戻す（2 本指パン開始時の誤タッチ取り消し用） */
  setCellValue: (row: number, col: number, value: string) => void;
  addPaletteChars: (text: string) => BulkAddResult;
  clearCustom: () => void;
  addRow: () => void;
  removeRow: () => void;
  clearAll: () => void;
}

const putCell = (grid: DotGrid, row: number, col: number, value: string): DotGrid =>
  grid.map((r, ri) => (ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r));

export const useDotStore = create<DotState>()(
  persist(
    (set, get) => ({
      grid: emptyGrid(INITIAL_ROWS),
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
          return { strokeErase: erase, grid: putCell(s.grid, row, col, erase ? '' : s.brush) };
        }),
      endStroke: () => set({ strokeErase: null }),
      setCellValue: (row, col, value) =>
        set((s) => {
          if (row < 0 || row >= s.grid.length || col < 0 || col >= GRID_COLS) return s;
          if (s.grid[row][col] === value) return s;
          return { grid: putCell(s.grid, row, col, value) };
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
          merged.length > MAX_CUSTOM_CHARS ? merged.slice(0, merged.length - MAX_CUSTOM_CHARS) : [];
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

      addRow: () =>
        set((s) =>
          s.grid.length >= MAX_ROWS ? s : { grid: [...s.grid, Array(GRID_COLS).fill('')] },
        ),
      removeRow: () => set((s) => (s.grid.length > 1 ? { grid: s.grid.slice(0, -1) } : s)),
      clearAll: () => set((s) => ({ grid: emptyGrid(s.grid.length) })),
    }),
    {
      name: 'compass-aa-dot',
      // パレット関連だけ保存する。描きかけのグリッドは保存しない
      // （次に開いたとき前回の絵が残っていると驚くため）
      partialize: (s) => ({ recentChars: s.recentChars, customPalette: s.customPalette }),
    },
  ),
);
