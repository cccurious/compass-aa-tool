import { charWidth } from './metrics';
import { spaceBreakIndices } from './wrap';

/**
 * 1 メッセージの送信上限（2026-07-26 モデル v5・実機プローブ 23 本で決着）。
 *
 * 上限は 2 本立てで、**どちらかを超えた分が入力欄の確定時に末尾から切り捨てられる**。
 *
 * 上限 A「長さ」: 文字ごとの重み付き合計 ≤ LIMIT_LENGTH
 *   - 全角グリフ（幅 1.0 の文字）      = 1
 *   - 半角文字・全角スペース・半角スペース = 0.75
 *   - **改行を発生させた半角スペース   = 6.75**（＝ 0.75 ＋ 改行 1 回ぶんの 6）
 * 上限 B「幅換算」: 全角 1・半角（スペース含む）0.5 の合計 ≤ LIMIT_WIDTH
 *
 * 「改行したスペースだけが高い」のが要点。同じ 10 文字語の連なりでも、
 * 2 語が 1 行に収まる（＝改行しない）W1 は無傷で、改行を伴う P9 は切られた。
 * 実測 23 本のうち 20 本は切断位置まで 1 文字も違わず再現し、残り 3 本も ±1 文字。
 * 経緯と全データは docs/notes/calibration-plan.md、探索器は scripts/limit-rule-solver.ts。
 */
export const LIMIT_LENGTH = 196;
export const LIMIT_WIDTH = 184;

/** 改行を起こした半角スペース 1 個ぶんの重み（内訳: 通常 0.75 ＋ 改行 6） */
export const BREAK_SPACE_COST = 6.75;
/** 半角文字・全角スペース・改行しない半角スペースの重み */
export const LIGHT_COST = 0.75;

export interface MessageCost {
    /** 上限 A に対する重み付き長さ */
    length: number;
    /** 上限 B に対する幅換算 */
    width: number;
    /** 改行を起こした（＝ 6.75 換算になった）半角スペースの個数 */
    breakSpaces: number;
}

export function messageCost(text: string): MessageCost {
    const chars = Array.from(text);
    const breaks = spaceBreakIndices(text);
    let length = 0;
    let width = 0;
    let breakSpaces = 0;
    chars.forEach((c, i) => {
        if (c === ' ') {
            const isBreak = breaks.has(i);
            length += isBreak ? BREAK_SPACE_COST : LIGHT_COST;
            if (isBreak) breakSpaces++;
            width += 0.5;
            return;
        }
        // 全角スペースは「幅 1.0 だが長さは軽い」という実測どおりの二面性を持つ
        const isFullGlyph = c !== '　' && charWidth(c) >= 1.0;
        length += isFullGlyph ? 1 : LIGHT_COST;
        width += c !== ' ' && charWidth(c) >= 1.0 ? 1 : 0.5;
    });
    return { length, width, breakSpaces };
}

export const isOverLimit = (cost: MessageCost): boolean =>
    cost.length > LIMIT_LENGTH || cost.width > LIMIT_WIDTH;

/** あと何文字ぶん置けるか（全角 1 文字を単位に、2 つの上限のうち厳しい方） */
export const remainingFullWidth = (cost: MessageCost): number =>
    Math.floor(Math.min(LIMIT_LENGTH - cost.length, LIMIT_WIDTH - cost.width));

/** 超過ぶん（全角何文字ぶん減らせばよいか） */
export const overBy = (cost: MessageCost): number =>
    Math.ceil(Math.max(cost.length - LIMIT_LENGTH, cost.width - LIMIT_WIDTH));
