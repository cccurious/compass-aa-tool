import { describe, it, expect } from 'vitest';
import { gridToText, emptyGrid, GRID_COLS } from '../src/core/grid';
import { textWidth, messageCost, isOverMessageLimit } from '../src/core/metrics';
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
            "　　r'ﾟJヽ ＿__ ____,",
            ". 　 ｀ヽ　 　 　 }ー'",
            '. 　 　 j j＾⌒j jj',
            '.　 　 ´´ 　 ´´´',
        ];
        const result = convert(src.join('\n'));
        const rendered = result.preview.map((l) => l.text.replace(/[ \u3000]+$/, ''));
        expect(rendered).toEqual(src.map((s) => s.replace(/[ \u3000]+$/, '')));
    });
    it('半角 . / : はそのまま送る（全角化はコピー時のみで表示は半角のまま）', () => {
        const result = convert('.　/:あ\nい');
        expect(result.output.startsWith('.　/:あ')).toBe(true);
    });
    it('スペース式パディングは先頭に半角スペース 1 個を挟む（語の癒着を切る・半角混じり行）', () => {
        // 半角 j を含む行は幅が端数になるため全角充填の対象外＝従来経路に入る
        const result = convert('jあいう\nかきく');
        expect(result.lines[0].padding).toMatch(/^ \u3000+ +$/);
    });
    it('ラウンドトリップ: 出力をシミュレータへ通すと入力行が復元される', () => {
        const src = ['（＾ω＾）', '　＜わっしょい＞', '∪　∪'];
        const result = convert(src.join('\n'));
        // パディング（行末の全角/半角スペース）は表示に影響しないため除いて比較
        const rendered = result.preview.map((l) => l.text.replace(/[ \u3000]+$/, ''));
        expect(rendered).toEqual(src.map((s) => s.replace(/[ \u3000]+$/, '')));
    });
    it('空行は全角スペース行として存続する', () => {
        const result = convert('あ\n\nい');
        expect(result.preview).toHaveLength(3);
        expect(result.preview[1].text.startsWith('　')).toBe(true);
    });
    it('全角のみの行は全角充填（半角スペース 0 個）でパディングされる', () => {
        const result = convert('あいう\nかきく');
        // 幅 3 → 全角 17 個で行幅ちょうど 20.0（半角スペースは units 16 と高価なため不使用）
        expect(result.lines[0].padding).toBe('　'.repeat(17));
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

describe('convert: 全角充填パディング（units 再校正後の最優先戦略・2026-07-25 実機確認）', () => {
    it('全角のみの行は全角スペースで幅 20.0 ちょうどに満たし、半角スペースを使わない', () => {
        const src = ['█'.repeat(15), '▓'.repeat(15)];
        const result = convert(src.join('\n'));
        expect(result.lines[0].padding).toBe('　'.repeat(5));
        // ラウンドトリップ: 文字単位折り返しで 2 行に割れる
        const rendered = result.preview.map((l) => l.text.replace(/[ \u3000]+$/, ''));
        expect(rendered).toEqual(src);
        // 長さコスト: 半角スペース式（30+16=46）より安い 35
        expect(messageCost(result.output).length).toBe(35);
    });
    it('幅 20 ちょうどの行はパディング 0 文字（境界コスト完全ゼロ）', () => {
        const result = convert('█'.repeat(20) + '\n' + '▓'.repeat(20));
        expect(result.lines[0].padding).toBe('');
        expect(result.preview.map((l) => l.text)).toEqual(['█'.repeat(20), '▓'.repeat(20)]);
    });
    it('レトリバー AA が上限内に収まる（旧: スペース 8 個で 279 units → 実機で切断された）', () => {
        const src = [
            '　　　　　　　　　██',
            '　　　　█　　　████　　　█　　き',
            '　　　　██　██████　██　　か',
            '　ん　　████████████　　え',
            '　た　　███▒▒▓□▒▒███　　お',
            '　ん　　█▒▒▒▒▓▓▒▒▒▒█',
            '　か　▒▒　　▜　　　　▜　　▒▒',
            '　！　　▌　　█　　　　█　　▐',
            '　　　　　▄▄▄▄▄▄▄▄▄▄',
        ].join('\n');
        const result = convert(src);
        expect(result.output).not.toContain(' ');
        expect(messageCost(result.output)).toEqual({ length: 175, width: 175, heavySpaces: 0 });
        expect(isOverMessageLimit(messageCost(result.output))).toBe(false);
    });
});

describe('convert: 1 文字ブレーク最適化（半角混じり行で継続使用）', () => {
    it('半角を含む密な境界は半角スペース 1 個で改行する', () => {
        const src = ['j'.repeat(50), 'j'.repeat(50)];
        const result = convert(src.join('\n'));
        expect(result.lines[0].padding).toBe(' ');
        const rendered = result.preview.map((l) => l.text.replace(/[ \u3000]+$/, ''));
        expect(rendered).toEqual(src);
    });
    it('幅未確認文字を含む境界は誤発火せず通常パディング（U+E000 は恒久的に未確認）', () => {
        const result = convert(String.fromCharCode(0xe000).repeat(15) + '\n' + '●'.repeat(15));
        expect(result.lines[0].padding.length).toBeGreaterThan(1);
        expect(result.unknownWidthLines).toHaveLength(1);
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
            if (!isOverMessageLimit(messageCost(convert(src).output))) max = rows;
        }
        return max;
    };
    // 全角充填パディングでは各行が幅換算ちょうど 20 になるため、
    // 幅換算上限 184（v4 の上限 B）が先に効いて行数はどの密度でも 9 行
    // （9×20=180 ≤ 184 < 10×20）。長さ上限 A（271.5）側は 180 で余裕
    it('最も密な幅 20 は 9 行（幅換算 184 が先に効く）', () => {
        expect(rowsThatFit(20)).toBe(9);
    });
    it('中間・疎の密度でも 9〜10 行（全角充填では途中行のコストが密度によらず幅換算 20）', () => {
        expect(rowsThatFit(15)).toBe(9);
        expect(rowsThatFit(10)).toBe(9);
        // 幅 4 の最終行（パディングなし）は 9×20+4=184 でちょうど収まり 10 行
        expect(rowsThatFit(4)).toBe(10);
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
        grid[0][0] = '╭';
        grid[0][1] = '─';
        grid[0][2] = '╮';
        grid[1][0] = '╰';
        grid[1][1] = '─';
        grid[1][2] = '╯';
        const text = gridToText(grid);
        expect(text).toBe('╭─╮' + '\n' + '╰─╯');
        const rendered = convert(text).preview.map((l) => l.text.replace(/[ \u3000]+$/, ''));
        expect(rendered).toEqual(['╭─╮', '╰─╯']);
    });
});

describe('底上げパディング（半角混じり行で 1 文字ブレークを発火させる構造）', () => {
    it('構造は「半角 1 ＋ 全角 n ＋ 半角 1」で、先頭の半角が語の癒着を切る', () => {
        // 半角 j 入りの幅 8 相当の行は素では発火せず、全角充填の対象でもない
        const result = convert('j' + '■'.repeat(7) + '\n' + '●'.repeat(8));
        expect(result.lines[0].padding).toMatch(/^ \u3000+ $/);
    });
    it('底上げしてもシミュレータで意図どおり 2 行に割れる', () => {
        const src = ['j' + '■'.repeat(7), '●'.repeat(8)];
        const result = convert(src.join('\n'));
        const rendered = result.preview.map((l) => l.text.replace(/[ \u3000]+$/, ''));
        expect(rendered).toEqual(src);
    });
    it('通常パディングより短い（底上げは行内に留める分だけで足りる）', () => {
        const boosted = convert('j' + '■'.repeat(7) + '\n' + '●'.repeat(8)).lines[0].padding.length;
        // 次行が狭いと発火に必要な底上げが増えるため、そちらの方が長くなる
        const plain = convert('j' + '■'.repeat(7) + '\n' + '●').lines[0].padding.length;
        expect(boosted).toBeLessThan(plain);
    });
});
