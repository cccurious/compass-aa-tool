import { describe, it, expect, beforeEach } from 'vitest';
import { useDotStore, MAX_CUSTOM_CHARS } from '../src/store/useDotStore';
import { SUGGEST_CHARS } from '../src/core/palette';

describe('パレット追加（新規優先の押し出し）', () => {
    beforeEach(() => {
        useDotStore.setState({ customPalette: [], recentChars: [], brush: '█' });
    });
    it('上限を超えると古いものから押し出される', () => {
        const chars = SUGGEST_CHARS.slice(0, MAX_CUSTOM_CHARS + 3);
        const r1 = useDotStore.getState().addPaletteChars(chars.slice(0, MAX_CUSTOM_CHARS).join(''));
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
        const r = useDotStore.getState().addPaletteChars('abc●');
        expect(r.added).toEqual(['●']);
        expect(r.skipped).toEqual(['a', 'b', 'c']);
        expect(r.evicted).toHaveLength(0);
    });
});
