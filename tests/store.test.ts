import { describe, it, expect, beforeEach } from 'vitest';
import { useDotStore, MAX_CUSTOM_CHARS } from '../src/store/useDotStore';
import { SUGGEST_CHARS } from '../src/core/palette';
import { emptyGrid } from '../src/core/grid';

describe('パレット追加（新規優先の押し出し）', () => {
    beforeEach(() => {
        useDotStore.setState({ customPalette: [], recentChars: [], brush: '█' });
    });
    it('上限を超えると古いものから押し出される', () => {
        const chars = SUGGEST_CHARS.slice(0, MAX_CUSTOM_CHARS + 3);
        const r1 = useDotStore
            .getState()
            .addPaletteChars(chars.slice(0, MAX_CUSTOM_CHARS).join(''));
        expect(r1.added).toHaveLength(MAX_CUSTOM_CHARS);
        expect(r1.evicted).toHaveLength(0);
        const r2 = useDotStore.getState().addPaletteChars(chars.slice(MAX_CUSTOM_CHARS).join(''));
        expect(r2.added).toHaveLength(3);
        // 最古の 3 文字が押し出され、新規は必ず入る
        expect(r2.evicted).toEqual(chars.slice(0, 3));
        const pal = useDotStore.getState().customPalette;
        expect(pal).toHaveLength(MAX_CUSTOM_CHARS);
        expect(pal.slice(-3)).toEqual(chars.slice(MAX_CUSTOM_CHARS));
    });
    it('半角は除外され、押し出しは起きない', () => {
        // ● はプリセット「図形」へ昇格したので、候補に残っている ★ を使う
        const r = useDotStore.getState().addPaletteChars('abc★');
        expect(r.added).toEqual(['★']);
        expect(r.skipped).toEqual(['a', 'b', 'c']);
        expect(r.evicted).toHaveLength(0);
    });
});

describe('アンドゥ（ストローク単位の履歴）', () => {
    beforeEach(() => {
        useDotStore.setState({ grid: emptyGrid(3), history: [], brush: '█', strokeErase: null });
    });
    it('ストローク（begin＋ドラッグ paint）は 1 回のアンドゥで丸ごと戻る', () => {
        const s = () => useDotStore.getState();
        s().beginStroke(0, 0);
        s().paint(0, 1);
        s().paint(0, 2);
        s().endStroke();
        expect(s().grid[0].slice(0, 3)).toEqual(['█', '█', '█']);
        s().undo();
        expect(s().grid).toEqual(emptyGrid(3));
        expect(s().history).toHaveLength(0);
    });
    it('履歴が空のときの undo は何もしない', () => {
        const before = useDotStore.getState().grid;
        useDotStore.getState().undo();
        expect(useDotStore.getState().grid).toBe(before);
    });
    it('全消去・行削除も戻せる。空キャンバスの全消去は履歴を積まない', () => {
        const s = () => useDotStore.getState();
        s().clearAll(); // 空のまま → 履歴なし
        expect(s().history).toHaveLength(0);
        s().beginStroke(1, 1);
        s().endStroke();
        s().removeRow();
        expect(s().grid).toHaveLength(2);
        s().clearAll();
        expect(s().grid).toEqual(emptyGrid(2));
        s().undo(); // 全消去を戻す
        expect(s().grid[1][1]).toBe('█');
        s().undo(); // 行削除を戻す
        expect(s().grid).toHaveLength(3);
        s().undo(); // ストロークを戻す
        expect(s().grid).toEqual(emptyGrid(3));
    });
    it('履歴は上限を超えると古い方から捨てられる', () => {
        const s = () => useDotStore.getState();
        for (let i = 0; i < 60; i++) {
            s().beginStroke(0, 0); // トグルで塗り⇔消去を繰り返す
            s().endStroke();
        }
        expect(s().history).toHaveLength(50);
    });
});
