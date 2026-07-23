import { describe, it, expect } from 'vitest';
import { textWidth } from '../src/core/metrics';
import { simulateWrap } from '../src/core/wrap';
import { convert } from '../src/core/convert';

describe('metrics.textWidth', () => {
    it('全角は 1.0・半角は 0.5 で数える', () => {
        expect(textWidth('あいう')).toBe(3.0);
        expect(textWidth('ab ')).toBe(1.5);
        expect(textWidth('あa　 ')).toBe(3.0);
    });
});

describe('wrap.simulateWrap', () => {
    it('全角 20 文字は折り返さない', () => {
        const lines = simulateWrap('あ'.repeat(20));
        expect(lines).toHaveLength(1);
    });
    it('全角 21 文字は 21 文字目で折り返す', () => {
        const lines = simulateWrap('あ'.repeat(21));
        expect(lines).toHaveLength(2);
        expect(lines[0].text).toBe('あ'.repeat(20));
        expect(lines[1].text).toBe('あ');
    });
});

describe('convert', () => {
    it('2 行 AA が意図どおり 2 行に折り返される 1 行を出力する', () => {
        const result = convert('あいう\nかきく');
        expect(result.output).not.toContain('\n');
        expect(result.preview).toHaveLength(2);
        expect(result.preview[0].text.startsWith('あいう')).toBe(true);
        expect(result.preview[1].text.startsWith('かきく')).toBe(true);
    });
    it('上限超過行を検出する', () => {
        const result = convert('あ'.repeat(25) + '\nかきく');
        expect(result.overflowLines).toEqual([0]);
    });
    it('プレビュー行数は入力行数と一致する（超過行なしの場合）', () => {
        const result = convert('（＾ω＾）\n＜わっしょい＞\n∪　∪');
        expect(result.overflowLines).toEqual([]);
        expect(result.preview).toHaveLength(3);
    });
});
