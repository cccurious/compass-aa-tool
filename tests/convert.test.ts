import { describe, it, expect } from 'vitest';
import { textWidth } from '../src/core/metrics';
import { simulateWrap } from '../src/core/wrap';
import { convert } from '../src/core/convert';

describe('metrics.textWidth（Noto Sans JP 仮説テーブル）', () => {
    it('全角かな・漢字・全角スペースは 1.0', () => {
        expect(textWidth('あいう')).toBe(3.0);
        expect(textWidth('永　愛')).toBe(3.0);
    });
    it('半角スペースは 0.224（Noto Sans JP 実測。仕様書の 0.5 とは異なる仮説値）', () => {
        expect(textWidth(' ')).toBeCloseTo(0.224, 4);
    });
    it('狭幅記号の幅がフォント由来の値になっている', () => {
        expect(textWidth(',')).toBeCloseTo(0.278, 4);
        expect(textWidth('\\')).toBeCloseTo(0.392, 4);
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

describe('wrap.simulateWrap（実機規則: 折り返し点の半角スペースは消える）', () => {
    it('折り返し点の半角スペース連続は行末にも次行頭にも残らない', () => {
        const lines = simulateWrap('あ'.repeat(20) + '          ' + 'い');
        expect(lines).toHaveLength(2);
        expect(lines[1].text).toBe('い'); // 字下げなし（ラウンド2 R2-3 実測）
    });
    it('全角スペースは消えず次行頭へキャリーされる', () => {
        const lines = simulateWrap('あ'.repeat(20) + '　い');
        expect(lines).toHaveLength(2);
        expect(lines[1].text).toBe('　い'); // 1 字分の字下げ（R2-1 実測）
    });
});

describe('wrap.simulateWrap（語の先読み: インシデント#1/#2 の機構）', () => {
    it('半角スペース後の語（全角スペース癒着込み）が入らないと、そこで改行される', () => {
        // R3-2b の予測値。実機検証待ちだが、レトリバー事故を説明する唯一のモデル
        const lines = simulateWrap('あ'.repeat(18) + ' jj' + '　'.repeat(5) + 'い');
        expect(lines[0].text).toBe('あ'.repeat(18));
        expect(lines[1].text).toBe('jj　　　　　い');
    });
});

describe('convert', () => {
    it('レトリバー AA の後ろ足 jj が転落しない（インシデント#1/#2 回帰テスト）', () => {
        const src = [
            '.　 　 _',
            '　　r\'ﾟJヽ ＿__ ____,',
            '. 　 ｀ヽ　 　 　 }ー\'',
            '. 　 　 j j＾⌒j jj',
            '.　 　 ´´ 　 ´´´',
        ];
        const result = convert(src.join('\n'));
        const rendered = result.preview.map((l) => l.text.replace(/[ 　]+$/, ''));
        expect(rendered).toEqual(src.map((s) => s.replace(/[ 　]+$/, '')));
    });
    it('半角 . / : はそのまま送る（全角化はコピー時のみで表示は半角のまま）', () => {
        const result = convert('.　/:あ\nい');
        expect(result.output.startsWith('.　/:あ')).toBe(true);
    });
    it('パディングは先頭に半角スペース 1 個を挟む（語の癒着を切る）', () => {
        const result = convert('あいう\nかきく');
        expect(result.lines[0].padding).toMatch(/^ 　+ +$/);
    });
    it('ラウンドトリップ: 出力をシミュレータへ通すと入力行が復元される', () => {
        const src = ['（＾ω＾）', '　＜わっしょい＞', '∪　∪'];
        const result = convert(src.join('\n'));
        // パディング（行末の全角/半角スペース）は表示に影響しないため除いて比較
        const rendered = result.preview.map((l) => l.text.replace(/[ 　]+$/, ''));
        expect(rendered).toEqual(src.map((s) => s.replace(/[ 　]+$/, '')));
    });
    it('空行は全角スペース行として存続する', () => {
        const result = convert('あ\n\nい');
        expect(result.preview).toHaveLength(3);
        expect(result.preview[1].text.startsWith('　')).toBe(true);
    });
    it('パディングは全角スペース主体で文字数を節約する', () => {
        const result = convert('あいう\nかきく');
        // 幅 3 の行: 半角 1 + 全角 16 個 + 半角数個 ≈ 25 文字弱（半角のみの旧方式は 78 文字超）
        expect(result.lines[0].padding.length).toBeLessThan(28);
        expect(result.lines[0].padding).toMatch(/^ 　+ +$/);
    });
    it('行頭の半角スペースを警告する（実機では消えるため）', () => {
        const result = convert(' い\nあ');
        expect(result.leadingSpaceLines).toEqual([0]);
    });
    it('幅未実測の文字を行番号つきで報告する（⌒事故の再発防止）', () => {
        // U+E000 は私用領域＝どのフォントにも実測値が無い
        const result = convert('ああ\nい');
        expect(result.unknownWidthLines).toEqual([{ line: 0, chars: [''] }]);
    });
    it('⌒（U+2312）は幅 1.0 の実測済み文字（実機事故の原因だった文字）', () => {
        expect(textWidth('⌒')).toBe(1.0);
        expect(convert('j＾⌒j\nい').unknownWidthLines).toEqual([]);
    });
    it('2 行 AA が意図どおり 2 行に折り返される 1 行を出力する', () => {
        const result = convert('あいう\nかきく');
        expect(result.output).not.toContain('\n');
        expect(result.preview).toHaveLength(2);
        expect(result.preview[0].text.startsWith('あいう')).toBe(true);
        expect(result.preview[1].text.startsWith('かきく')).toBe(true);
    });
    it('上限超過行を検出する（LIMIT_SAFE=20.278 超え）', () => {
        const result = convert('あ'.repeat(21) + '\nかきく');
        expect(result.overflowLines).toEqual([0]);
    });
    it('プレビュー行数は入力行数と一致する（超過行なしの場合）', () => {
        const result = convert('（＾ω＾）\n＜わっしょい＞\n∪　∪');
        expect(result.overflowLines).toEqual([]);
        expect(result.preview).toHaveLength(3);
    });
});
