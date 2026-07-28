import { describe, it, expect } from 'vitest';
import { convert } from '../src/core/convert';
import { DEVICE_RISK_CHARS, isKnownWidth } from '../src/core/metrics';

/**
 * 端末差の疑いリスト（層 2 予測）の配線を検査する。
 * リストの中身自体はスキャン結果の生成物なので、ここでは
 * 「未確認文字の警告が疑いあり／兆候なしに正しく二分されること」だけを見る。
 */
describe('端末差の疑いリスト', () => {
    // ⌂ は両スキャンとも非全角（iOS 0.60）・実測なし → 疑いあり側の代表
    // ♨ は両スキャンとも全角に出た・実測なし → 兆候なし側の代表
    it('前提: 代表文字の分類が生成データと一致している', () => {
        expect(isKnownWidth('⌂')).toBe(false);
        expect(DEVICE_RISK_CHARS.has('⌂')).toBe(true);
        expect(isKnownWidth('♨')).toBe(false);
        expect(DEVICE_RISK_CHARS.has('♨')).toBe(false);
    });

    it('疑いのある未確認文字は unknownRiskLines に出る', () => {
        const r = convert('⌂あ\nあ');
        expect(r.unknownRiskLines).toEqual([{ line: 0, chars: ['⌂'] }]);
        expect(r.unknownWidthLines).toEqual([]);
    });

    it('兆候のない未確認文字は unknownWidthLines に出る', () => {
        const r = convert('♨あ\nあ');
        expect(r.unknownWidthLines).toEqual([{ line: 0, chars: ['♨'] }]);
        expect(r.unknownRiskLines).toEqual([]);
    });

    it('同じ行に混在したら両方の警告に振り分けられる', () => {
        const r = convert('⌂♨\nあ');
        expect(r.unknownRiskLines).toEqual([{ line: 0, chars: ['⌂'] }]);
        expect(r.unknownWidthLines).toEqual([{ line: 0, chars: ['♨'] }]);
    });

    it('使用不可の文字は端末差警告で説明済みなのでどちらにも出ない', () => {
        const r = convert('║あ\nあ');
        expect(r.deviceVariantLines).toEqual([{ line: 0, chars: ['║'] }]);
        expect(r.unknownRiskLines).toEqual([]);
        expect(r.unknownWidthLines).toEqual([]);
    });

    it('確定済みの実測文字は疑いリストに混ざっていても警告されない', () => {
        // ═ は実測 1.0（層 1）だがブラウザ走査では 0.71 に出てリスト側に居る。
        // 層 1 が優先されるので警告ゼロであること
        const r = convert('═あ\nあ');
        expect(r.unknownRiskLines).toEqual([]);
        expect(r.unknownWidthLines).toEqual([]);
        expect(r.deviceVariantLines).toEqual([]);
    });
});
