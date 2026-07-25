import { describe, it, expect } from 'vitest';
import { gridToText, emptyGrid, GRID_COLS } from '../src/core/grid';
import { textWidth, MAX_MESSAGE_BYTES, utf8ByteLength } from '../src/core/metrics';
import { MAX_ROWS } from '../src/store/useDotStore';
import { simulateWrap } from '../src/core/wrap';
import { convert } from '../src/core/convert';

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

describe('convert: 1 文字ブレーク最適化（語先読み改行の逆用）', () => {
    it('次行頭の語が残り幅に入らない境界は半角スペース 1 個で改行する', () => {
        const src = ['█'.repeat(15), '▓'.repeat(15)];
        const result = convert(src.join('\n'));
        expect(result.lines[0].padding).toBe(' ');
        // ラウンドトリップ: シミュレータでも 2 行に割れる
        const rendered = result.preview.map((l) => l.text.replace(/[ 　]+$/, ''));
        expect(rendered).toEqual(src);
        // 出力は 15+1+15 = 31 文字（通常パディングなら 50 文字超）
        expect(Array.from(result.output)).toHaveLength(31);
    });
    it('次行頭の語が小さい境界は通常パディングに回す', () => {
        const result = convert('あいう\nかきく');
        expect(result.lines[0].padding.length).toBeGreaterThan(10);
    });
    it('■●等の幾何学図形も 1 文字ブレークが発火する（幅 1.0 実測済み）', () => {
        const result = convert('■'.repeat(15) + '\n' + '●'.repeat(15));
        expect(result.lines[0].padding).toBe(' ');
    });
    it('幅未確認文字を含む境界は誤発火せず通常パディング（U+E000 は恒久的に未確認）', () => {
        const result = convert(''.repeat(15) + '\n' + '●'.repeat(15));
        expect(result.lines[0].padding.length).toBeGreaterThan(1);
    });
});

describe('grid.gridToText（ドット打ち→AAテキスト・文字数節約規則）', () => {
    it('行末の空セルは出力せず、左端・中間の空セルは全角スペースになる', () => {
        const grid = emptyGrid(2);
        grid[0][1] = '■';
        grid[0][3] = '●';
        grid[1][0] = '□';
        expect(gridToText(grid)).toBe('　■　●\n□');
    });
    it('全空行は空文字列・末尾の全空行は削られる', () => {
        const grid = emptyGrid(4);
        grid[0][0] = '■';
        grid[2][0] = '●';
        expect(gridToText(grid)).toBe('■\n\n●');
    });
    it('20 列すべて埋めた行は LIMIT_SAFE 以下に収まる', () => {
        const grid = emptyGrid(1);
        for (let c = 0; c < GRID_COLS; c++) grid[0][c] = '■';
        const text = gridToText(grid);
        expect(Array.from(text)).toHaveLength(20);
        expect(convert(text).overflowLines).toEqual([]);
    });
});

describe('行数上限（キャンバス設計の根拠・2026-07-25 実測）', () => {
    const rowsThatFit = (width: number) => {
        let max = 0;
        for (let rows = 1; rows <= 20; rows++) {
            const src = Array.from({ length: rows }, () => '█'.repeat(width)).join('\n');
            if (utf8ByteLength(convert(src).output) <= MAX_MESSAGE_BYTES) max = rows;
        }
        return max;
    };
    it('最も密な幅 20 でも 8 行は 184 文字に収まる', () => {
        expect(rowsThatFit(20)).toBe(8);
    });
    it('幅 10 以下でも 1 文字ブレークの底上げが効き 10 行以上入る（崖の解消）', () => {
        expect(rowsThatFit(10)).toBeGreaterThanOrEqual(10);
        expect(rowsThatFit(4)).toBeGreaterThanOrEqual(10);
    });
    it('物理上限 15 行を超える密度は存在しない（MAX_ROWS の根拠）', () => {
        for (let w = 1; w <= 20; w++) expect(rowsThatFit(w)).toBeLessThanOrEqual(MAX_ROWS);
    });
});

describe('罫線パレット（丸角つき）', () => {
    it('丸角 ╭╮╰╯ は幅 1.0 で警告も出ない', () => {
        expect(textWidth('╭╮╰╯')).toBe(4.0);
        expect(convert('╭─╮' + '\n' + '╰─╯').unknownWidthLines).toEqual([]);
    });
    it('丸角の枠がグリッドから崩れずに出力される', () => {
        const grid = emptyGrid(2);
        grid[0][0] = '╭'; grid[0][1] = '─'; grid[0][2] = '╮';
        grid[1][0] = '╰'; grid[1][1] = '─'; grid[1][2] = '╯';
        const text = gridToText(grid);
        expect(text).toBe('╭─╮' + '\n' + '╰─╯');
        const rendered = convert(text).preview.map((l) => l.text.replace(/[ 　]+$/, ''));
        expect(rendered).toEqual(['╭─╮', '╰─╯']);
    });
});

describe('底上げパディング（1 文字ブレークを発火させる構造）', () => {
    it('構造は「半角 1 ＋ 全角 n ＋ 半角 1」で、先頭の半角が語の癒着を切る', () => {
        // 幅 8 の行は素では発火しない（8+0.34+8 < しきい値）ので底上げ経路に入る
        const result = convert('■'.repeat(8) + '\n' + '●'.repeat(8));
        expect(result.lines[0].padding).toMatch(/^ 　+ $/);
    });
    it('底上げしてもシミュレータで意図どおり 2 行に割れる', () => {
        const src = ['■'.repeat(8), '●'.repeat(8)];
        const result = convert(src.join('\n'));
        const rendered = result.preview.map((l) => l.text.replace(/[ 　]+$/, ''));
        expect(rendered).toEqual(src);
    });
    it('通常パディングより短い（底上げは行内に留める分だけで足りる）', () => {
        const boosted = convert('■'.repeat(8) + '\n' + '●'.repeat(8)).lines[0].padding.length;
        // 次行が狭いと発火に必要な底上げが増えるため、そちらの方が長くなる
        const plain = convert('■'.repeat(8) + '\n' + '●').lines[0].padding.length;
        expect(boosted).toBeLessThan(plain);
    });
});
