import { describe, it, expect } from 'vitest';
import {
    charWidth,
    isKnownWidth,
    classifyChar,
    textWidth,
    messageCost,
    isOverMessageLimit,
    MESSAGE_LIMIT_LENGTH,
    MESSAGE_LIMIT_WIDTH,
} from '../src/core/metrics';
import { PALETTE_CATEGORIES, SUGGEST_CHARS } from '../src/core/palette';

/**
 * 実機の実測値そのものの回帰テスト。再校正（ゲーム更新で幅が変わったとき）は
 * まずこのファイルを回して、どの実測が崩れたかを特定する。
 */
describe('実機校正済みの 3 層モデル', () => {
    it('層1: かな・漢字・全角記号・全角スペースは固定 1.0（R6-1/2/3 実測）', () => {
        expect(textWidth('あいう')).toBe(3.0);
        expect(textWidth('永　愛')).toBe(3.0);
        expect(textWidth('＾＿う')).toBe(3.0);
    });
    it('層2: 半角は BIZ UDPGothic のプロポーショナル幅（R5-3/R6-4 実測）', () => {
        expect(textWidth(' ')).toBeCloseTo(0.3403, 4);
        expect(textWidth('j')).toBeCloseTo(0.3876, 4);
        expect(textWidth(',')).toBeCloseTo(0.3164, 4);
    });
    it('層3: アトラス漏れは全角 1.0 フォールバック（R5-1 で ´=1.0 実測）', () => {
        expect(textWidth('´')).toBe(1.0);
        expect(textWidth('⌒')).toBe(1.0);
    });
    it('_ は ASCII だがアトラス漏れで固定 0.5（R7 実測。BIZ 0.311 不採用）', () => {
        expect(textWidth('_')).toBe(0.5);
    });
    it('∥ は幅 0.5（R3 実測。20 個の後ろに ∧ が 10 個入る）', () => {
        expect(textWidth('∥')).toBe(0.5);
    });
    it('R8 ピッチ実測の記号は個別上書きが BIZ 値に優先する', () => {
        expect(textWidth('|')).toBe(0.29);
        expect(textWidth('=')).toBe(0.54);
        expect(textWidth('r')).toBeCloseTo(0.4594, 4); // 英字は BIZ のまま
    });
    it('罫線・ブロック・幾何学図形は範囲ごと 1.0 実測済み', () => {
        expect(textWidth('┏┓┃━')).toBe(4.0);
        expect(textWidth('█▌░▒▓')).toBe(5.0);
        expect(textWidth('■□●○')).toBe(4.0);
    });
    it('推定 0.5 だった約物・欧文記号は実機 1.0（一括検証 H/L）', () => {
        for (const ch of '※§¶±×÷†‡‰′″‥…〝〟') expect(textWidth(ch)).toBe(1.0);
    });
    it('ஐ は削除されず幅 0（2026-07-25 実測。見えない終端ガード候補）', () => {
        expect(textWidth('ஐ')).toBe(0);
        expect(classifyChar('ஐ').verified).toBe(true);
    });
});

describe('メッセージ上限の二重モデル v4（2026-07-25・プローブ 26 本で確定）', () => {
    it('上限 A: 全角 1・半角 0.5・半角スペースは全角グリフ直後のみ 16', () => {
        const c = messageCost('あ a　 ');
        // あ(1) + sp(あの直後=16) + a(0.5) + 全sp(1) + sp(全スペース直後=0.5)
        expect(c.length).toBe(1 + 16 + 0.5 + 1 + 0.5);
        expect(c.heavySpaces).toBe(1);
    });
    it('上限 B: 幅換算は全角 1・半角(スペース含む) 0.5', () => {
        expect(messageCost('あ a　 ').width).toBe(1 + 0.5 + 0.5 + 1 + 0.5);
    });
    it('レトリバー旧出力の実測: 残存部分（０143+全角直後 sp8）は A ちょうど 271', () => {
        const kept = messageCost(('０'.repeat(17) + ' ').repeat(8) + '０'.repeat(7));
        expect(kept.length).toBe(143 + 8 * 16);
        expect(kept.length).toBeLessThanOrEqual(MESSAGE_LIMIT_LENGTH);
    });
    it('PD1 実測: 先頭に半角 a を足しても切断位置が動かない（a=0.5 で A=271.5 まで残存）', () => {
        const kept = messageCost('a' + ('０'.repeat(17) + ' ').repeat(8) + '０'.repeat(7));
        expect(kept.length).toBe(MESSAGE_LIMIT_LENGTH);
    });
    it('PD2/PD3 実測: あ×184 で幅換算上限。半角 a は 0.5 と数える', () => {
        expect(messageCost('あ'.repeat(184)).width).toBe(MESSAGE_LIMIT_WIDTH);
        expect(messageCost('a' + 'あ'.repeat(183)).width).toBe(183.5);
        expect(isOverMessageLimit(messageCost('あ'.repeat(185)))).toBe(true);
    });
    it('電球 AA 型（半角 30 スペース混在 187 字）は両上限とも無傷 ＝ 単一 16 重み説の反証', () => {
        // 全角スペース直後・半角直後・スペース連続内のスペースは全て 0.5
        const c = messageCost('　 　 a ﾉ  ' + 'あ'.repeat(150));
        expect(c.heavySpaces).toBe(0);
        expect(isOverMessageLimit(c)).toBe(false);
    });
    it('あ×176（UTF-8 528 バイト）は無傷 ＝ 旧 512 バイト説の反証', () => {
        expect(isOverMessageLimit(messageCost('あ'.repeat(176)))).toBe(false);
    });
});

describe('分類の内部整合（食い違いの門番）', () => {
    it('確認済みと判定した文字は必ず推定既定値（0.5）でない', () => {
        // 「verified なのに幅は既定値」という無警告の食い違いを防ぐ。
        // 確認済み範囲を追記したとき、幅の方が追従していなければここで落ちる
        const ranges: [number, number][] = [
            [0x2500, 0x257f], // 罫線素片
            [0x2580, 0x259f], // ブロック要素
            [0x25a0, 0x25ff], // 幾何学図形
        ];
        for (const [lo, hi] of ranges) {
            for (let cp = lo; cp <= hi; cp++) {
                const ch = String.fromCodePoint(cp);
                expect(isKnownWidth(ch), `U+${cp.toString(16)}`).toBe(true);
                expect(charWidth(ch), `U+${cp.toString(16)}`).toBe(1.0);
            }
        }
    });
    it('classifyChar の幅と確からしさは charWidth / isKnownWidth と一致する', () => {
        for (const ch of 'あ_∥´j ※★←⇒ᚠ') {
            const c = classifyChar(ch);
            expect(c.width).toBe(charWidth(ch));
            expect(c.verified).toBe(isKnownWidth(ch));
        }
    });
    it('未確認の文字は確認済みと言わない（ルーン文字は検証対象外）', () => {
        expect(isKnownWidth(String.fromCharCode(0x16a0))).toBe(false);
    });
});

describe('パレットの門番', () => {
    it('パレットの全文字が幅 1.0 かつ確認済み', () => {
        for (const c of PALETTE_CATEGORIES) {
            for (const ch of c.chars) {
                expect(textWidth(ch), `${c.label} の ${ch}`).toBe(1.0);
                expect(isKnownWidth(ch), `${c.label} の ${ch}`).toBe(true);
            }
        }
    });
    it('「候補から選ぶ」の全文字も幅 1.0 かつ確認済み', () => {
        for (const ch of SUGGEST_CHARS) {
            expect(textWidth(ch), `候補 の ${ch}`).toBe(1.0);
            expect(isKnownWidth(ch), `候補 の ${ch}`).toBe(true);
        }
    });
});
