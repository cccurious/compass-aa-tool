import { describe, it, expect } from 'vitest';
import { charWidth, isKnownWidth, classifyChar, textWidth } from '../src/core/metrics';
import { messageCost, isOverLimit, BREAK_SPACE_COST } from '../src/core/limit';
import {
    PALETTE_CATEGORIES,
    PRESET_PALETTE,
    SUGGEST_CHARS,
    WITHDRAWN_CHARS,
} from '../src/core/palette';

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
    it('層2: 未実測の半角は BIZ UDPGothic のプロポーショナル幅（R5-3/R6-4 実測）', () => {
        expect(textWidth(' ')).toBeCloseTo(0.3403, 4);
        expect(textWidth('j')).toBeCloseTo(0.3876, 4);
        expect(textWidth('e')).toBeCloseTo(0.704, 3);
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
    it('実測済みの記号は個別上書きが BIZ 値に優先し、値は 1/64 グリッドに乗る', () => {
        expect(textWidth('|')).toBe(19 / 64);
        expect(textWidth('=')).toBe(35 / 64);
        expect(textWidth('r')).toBeCloseTo(0.4594, 4); // 未実測の英字は BIZ のまま
    });
    it('折り返し個数から精密実測した 4 文字（2026-07-26）', () => {
        // その文字を N 個送って 1 行目に n 個入る → w ∈ (LIMIT_SAFE/(n+1), LIMIT_FORCE/n]
        expect(textWidth('.')).toBe(18 / 64); // ×74 → 1 行 73 個
        expect(textWidth(',')).toBe(18 / 64);
        expect(textWidth('t')).toBe(32 / 64); // ×52 → 1 行 41 個
        expect(textWidth('a')).toBe(39 / 64); // ×45 → 1 行 33 個
    });
    it('全ての実測値が 1/64 em グリッドに乗る（法則の門番）', () => {
        for (const ch of Array.from("_.,ta'`|()=~^Oi l/\\-")) {
            const w = textWidth(ch);
            if (ch === ' ') continue; // 半角スペースは未実測（BIZ 値）
            expect(Number.isInteger(Math.round(w * 64 * 1e6) / 1e6), `${ch} = ${w}`).toBe(true);
        }
    });
    it('罫線・ブロック・幾何学図形は範囲ごと 1.0 実測済み', () => {
        expect(textWidth('┏┓┃━')).toBe(4.0);
        expect(textWidth('█▌▄■')).toBe(4.0);
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

describe('送信上限モデル v5（2026-07-26・実機 23 本／切断位置まで 20 本一致）', () => {
    it('重み: 全角グリフ 1・半角/全角スペース/改行しない半角スペース 0.75', () => {
        expect(messageCost('あ a　').length).toBe(1 + 0.75 + 0.75 + 0.75);
    });
    it('上限 B は実測の表示幅そのもの（半角は文字ごとに固有の幅）', () => {
        // T3（全角 172＋半角 24＝「半角 0.5」換算では 184 ちょうど）が 3 字切られたため、
        // 幅換算の近似ではなく実幅で測っていると判明した
        expect(messageCost('あ a　').width).toBeCloseTo(textWidth('あ a　'), 6);
    });
    it('改行を起こした半角スペースだけ 6.75（＝ 0.75 ＋ 改行 6）', () => {
        const c = messageCost('あ'.repeat(20) + ' ' + 'い'.repeat(20));
        expect(c.breakSpaces).toBe(1);
        expect(c.length).toBe(40 + BREAK_SPACE_COST);
    });
    it('W1 と P9 の分岐: 2 語が 1 行に収まるなら改行せず安い', () => {
        // 10 字語 ×2 は 1 行に収まる（10 + 0.34 + 10 < 20.5）ので改行しない
        expect(messageCost('０'.repeat(10) + ' ' + '０'.repeat(10)).breakSpaces).toBe(0);
        // 11 字語と 19 字語は 1 行に入らないので改行が起きる
        expect(messageCost('０'.repeat(11) + ' ' + '０'.repeat(19)).breakSpaces).toBe(1);
    });
    it('実測 PA: 語 11〜19 を 9 個並べた 159 字は上限超過（実機は 151 字で切断）', () => {
        const pa = [11, 19, 19, 19, 19, 16, 17, 16, 15].map((n) => '０'.repeat(n)).join(' ');
        expect(isOverLimit(messageCost(pa))).toBe(true);
    });
    it('実測 W1: 同じ 159 字でも 2 語ずつ 1 行に収まる構成なら無傷', () => {
        const w1 = ('０'.repeat(10) + ' ').repeat(9) + '０'.repeat(60);
        expect(isOverLimit(messageCost(w1))).toBe(false);
    });
    it('実測 PD2: スペース皆無でも全角 185 文字で幅換算上限を超える', () => {
        expect(isOverLimit(messageCost('あ'.repeat(184)))).toBe(false);
        expect(isOverLimit(messageCost('あ'.repeat(185)))).toBe(true);
    });
    it('あ×176（UTF-8 528 バイト）は無傷 ＝ 旧 512 バイト説の反証', () => {
        expect(isOverLimit(messageCost('あ'.repeat(176)))).toBe(false);
    });
    it('実測 S2: 文字数 196 の上限（長さ・幅に余裕があっても 197 字で切れる）', () => {
        // 半角 100 + 全角 96 = 196 字（長さ 171・幅 146 で両方とも余裕がある）
        const at = 'a'.repeat(100) + 'あ'.repeat(96);
        expect(messageCost(at).chars).toBe(196);
        expect(isOverLimit(messageCost(at))).toBe(false);
        expect(isOverLimit(messageCost(at + 'あ'))).toBe(true);
    });
    it('実測 S1/S5: 改行を多く含む構成でも長さが上限内なら無傷', () => {
        const s1 =
            Array.from({ length: 7 }, () => '０'.repeat(19)).join(' ') + ' ' + '０'.repeat(15);
        expect(messageCost(s1).breakSpaces).toBe(7);
        expect(isOverLimit(messageCost(s1))).toBe(false);
    });
    it('実測 T1/T2: 上限 A は 197.0 は通り 197.75 は通らない', () => {
        const t1 = [11, 19, 19, 19, 19, 16, 17, 16, 7].map((n) => '０'.repeat(n)).join(' ');
        expect(messageCost(t1).length).toBe(197);
        expect(isOverLimit(messageCost(t1))).toBe(false);
        expect(isOverLimit(messageCost(t1 + 'a'))).toBe(true);
    });
    it('実測 T5: 連続スペースで高いのは改行を起こす 1 個だけ', () => {
        let s = '０'.repeat(19);
        for (let i = 0; i < 6; i++) s += '  ' + '０'.repeat(19);
        s += '  ' + '０'.repeat(10);
        expect(messageCost(s).breakSpaces).toBe(7); // スペースは 14 個あるが改行は 7 回
        expect(isOverLimit(messageCost(s))).toBe(false);
    });
});

describe('分類の内部整合（食い違いの門番）', () => {
    it('確認済みと判定した文字は必ず推定既定値（0.5）でない', () => {
        // 「verified なのに幅は既定値」という無警告の食い違いを防ぐ。
        // 確認済み範囲を追記したとき、幅の方が追従していなければここで落ちる
        // 2026-07-26 の全数実機検証で「範囲まとめての認定」は全廃した。
        // ここは metrics.ts の FALLBACK_VERIFIED_RANGES と一致させること
        const ranges: [number, number][] = [
            [0x2500, 0x2503], // ─━│┃
            [0x250c, 0x254b], // ┌〜╋
            [0x256d, 0x2570], // ╭╮╯╰
            [0x2581, 0x258f], // ▁〜▏
            [0x2594, 0x2595], // ▔▕
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
    it('取り下げた文字はプリセットにも候補にも残っていない', () => {
        for (const ch of WITHDRAWN_CHARS) {
            expect(PRESET_PALETTE.includes(ch), `プリセットに ${ch} が残っている`).toBe(false);
            expect(SUGGEST_CHARS.includes(ch), `候補に ${ch} が残っている`).toBe(false);
        }
    });
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
