import { describe, it, expect } from 'vitest';
import { textGlyph, textGlyphs } from '../src/utils/textGlyph';
import { convert } from '../src/core/convert';

const VS15 = '︎';

describe('textGlyph（表示専用の絵文字化防止）', () => {
    it('既定が絵文字表示の文字に VS15 を後置する', () => {
        expect(textGlyph('⚾')).toBe('⚾' + VS15);
        expect(textGlyph('⚽')).toBe('⚽' + VS15);
    });

    it('VS16 で絵文字にもなれる文字にも付ける（iOS Safari は既定でも絵文字に寄せがち）', () => {
        expect(textGlyph('⚠')).toBe('⚠' + VS15);
        expect(textGlyph('♨')).toBe('♨' + VS15);
    });

    it('絵文字にならない文字には何も足さない', () => {
        for (const ch of ['■', '█', '─', 'あ', '☆', '☖', 'a']) {
            expect(textGlyph(ch), ch).toBe(ch);
        }
    });

    it('ASCII は Emoji プロパティ持ち（数字・#）でも対象外', () => {
        expect(textGlyph('1')).toBe('1');
        expect(textGlyph('#')).toBe('#');
    });

    it('文字列版はサロゲート・結合を壊さず 1 文字ずつ処理する', () => {
        expect(textGlyphs('⚾あ⚽')).toBe('⚾' + VS15 + 'あ⚽' + VS15);
    });

    /** 一番大事な検査: コピーされる変換結果に VS15 が混ざらないこと */
    it('convert の出力（コピーされるテキスト）には VS15 が入らない', () => {
        const r = convert('⚽⚾♨あ\nあああ');
        expect(r.output.includes(VS15)).toBe(false);
    });
});
