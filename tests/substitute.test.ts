import { describe, it, expect } from 'vitest';
import {
    EXACT_SUBSTITUTIONS,
    APPROX_SUBSTITUTIONS,
    NO_SUBSTITUTE,
    substituteUnsafe,
} from '../src/core/substitute';
import { UNSAFE_DISPLAY_CHARS, UNUSABLE_CHARS, charWidth, isKnownWidth } from '../src/core/metrics';

const exactKeys = Object.keys(EXACT_SUBSTITUTIONS);
const approxKeys = Object.keys(APPROX_SUBSTITUTIONS);
const allTargets = [...Object.values(EXACT_SUBSTITUTIONS), ...Object.values(APPROX_SUBSTITUTIONS)];

describe('置き換え表の門番', () => {
    /**
     * 一番大事な検査。使用不可の文字が 1 つでも表から漏れると、
     * 「置き換えたのにまだ壊れる」という一番たちの悪い壊れ方をする。
     * 新しく使用不可の文字を見つけたら、必ずどれかへ分類させるための門番。
     */
    it('使用不可の文字を漏れなく分類している', () => {
        const classified = new Set([...exactKeys, ...approxKeys, ...NO_SUBSTITUTE]);
        const missing = [...UNSAFE_DISPLAY_CHARS].filter((c) => !classified.has(c));
        expect(missing, `未分類: ${missing.join('')}`).toEqual([]);
    });

    it('分類した文字は全て使用不可か消える文字である', () => {
        const stray = [...exactKeys, ...approxKeys, ...NO_SUBSTITUTE].filter(
            (c) => !UNSAFE_DISPLAY_CHARS.has(c) && !UNUSABLE_CHARS.has(c),
        );
        expect(stray, `対象外なのに載っている: ${stray.join('')}`).toEqual([]);
    });

    it('送信すると消える文字には全て置き換え先がある', () => {
        const missing = [...UNUSABLE_CHARS].filter((c) => !(c in EXACT_SUBSTITUTIONS));
        expect(missing).toEqual([]);
    });

    it('同じ文字が二重に分類されていない', () => {
        const dup = exactKeys.filter((c) => c in APPROX_SUBSTITUTIONS || NO_SUBSTITUTE.has(c));
        const dup2 = approxKeys.filter((c) => NO_SUBSTITUTE.has(c));
        expect([...dup, ...dup2]).toEqual([]);
    });

    /** 置き換え先が壊れていたら置き換える意味がない */
    it('置き換え先は全て確認済みで幅ちょうど 1.0', () => {
        const bad = allTargets.filter(
            (c) => UNSAFE_DISPLAY_CHARS.has(c) || !isKnownWidth(c) || charWidth(c) !== 1.0,
        );
        expect(bad, `置き換え先として不適格: ${bad.join('')}`).toEqual([]);
    });

    it('置き換えが連鎖しない（先がさらに置き換え対象でない）', () => {
        const chained = allTargets.filter(
            (c) => c in EXACT_SUBSTITUTIONS || c in APPROX_SUBSTITUTIONS,
        );
        expect(chained).toEqual([]);
    });
});

describe('substituteUnsafe', () => {
    it('消える文字をほぼ同形の文字に置き換える', () => {
        expect(substituteUnsafe('⇑⇓✕').text).toBe('⇧⇩╳');
    });

    it('二重罫線の枠を単線の枠にする（═ は救済済みなのでそのまま残る）', () => {
        expect(substituteUnsafe('╔═╦═╗').text).toBe('┌═┬═┐');
        expect(substituteUnsafe('╠═╬═╣').text).toBe('├═┼═┤');
        expect(substituteUnsafe('╚═╩═╝').text).toBe('└═┴═┘');
    });

    it('既定では見た目が変わる置き換えを行わない', () => {
        const r = substituteUnsafe('▓░▒');
        expect(r.text).toBe('▓░▒');
        expect(r.unresolved).toEqual(['▓', '░', '▒']);
    });

    it('approx を立てると濃淡も置き換える', () => {
        expect(substituteUnsafe('▓░▒', true).text).toBe('■▫▪');
    });

    it('代わりが無い文字は approx でも残り unresolved に出る', () => {
        const r = substituteUnsafe('▘▝', true);
        expect(r.text).toBe('▘▝');
        expect(r.unresolved).toEqual(['▘', '▝']);
    });

    it('安全な文字には触れない', () => {
        const safe = '┌─┐│└┘█■○あ';
        expect(substituteUnsafe(safe, true).text).toBe(safe);
        expect(substituteUnsafe(safe, true).replaced).toEqual([]);
    });

    it('置き換えた組を重複なく報告する', () => {
        expect(substituteUnsafe('║║║╬').replaced).toEqual([
            { from: '║', to: '│' },
            { from: '╬', to: '┼' },
        ]);
    });

    /** 出力が実機で崩れないことの最終確認 */
    it('置き換え後は使用不可の文字が残らない（代替なしを除く）', () => {
        const all = [...UNSAFE_DISPLAY_CHARS].filter((c) => !NO_SUBSTITUTE.has(c)).join('');
        expect(substituteUnsafe(all, true).unresolved).toEqual([]);
    });
});
