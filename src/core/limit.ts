import { charWidth, textWidth } from './metrics';
import { spaceBreakIndices } from './wrap';

/**
 * 1 メッセージの送信上限（2026-07-26 モデル v6・実機プローブ 28 本で決着）。
 *
 * 上限は **3 本立て**で、どれかを超えた分が入力欄の確定時に末尾から切り捨てられる。
 *
 * 上限 A「長さ」: 文字ごとの重み付き合計 ≤ LIMIT_LENGTH
 *   - 全角グリフ（幅 1.0 の文字）          = 1
 *   - 半角文字・全角スペース・半角スペース = 0.75
 *   - **改行を発生させた半角スペース       = 6.75**（＝ 0.75 ＋ 改行 1 回ぶんの 6）
 * 上限 B「表示幅」: **実測の文字幅の合計**（textWidth）≤ LIMIT_WIDTH
 *   当初は「全角 1・半角 0.5」の近似だと考えていたが、T3 プローブ
 *   （全角 172＋半角 24＝幅換算では 184 ちょうど）が 3 文字切られたことで、
 *   実際の表示幅（半角は文字ごとに固有の幅）で測っていると判明した。
 * 上限 C「文字数」: 単純な文字数 ≤ LIMIT_CHARS
 *
 * A の要点は「改行したスペースだけが高い」。同じ 10 文字語の連なりでも、
 * 2 語が 1 行に収まる（＝改行しない）W1 は無傷で、改行を伴う P9 は切られた。
 * C は「半角 a は 196 文字で入力が止まる」という初期からの観測の正体でもある
 * （S2 プローブ: 221 字・長さ 196・幅 171 が**ちょうど 196 字**で切断された）。
 * 経緯と全データは docs/notes/calibration-plan.md、探索器は scripts/limit-rule-solver.ts。
 */
/** 上限 A。T1（197.0 ちょうど）が無傷・T2（197.75）が 1 字切断で [197, 197.75) と確定 */
export const LIMIT_LENGTH = 197;
export const LIMIT_WIDTH = 184;
export const LIMIT_CHARS = 196;

/** 改行を起こした半角スペース 1 個ぶんの重み（内訳: 通常 0.75 ＋ 改行 6） */
export const BREAK_SPACE_COST = 6.75;
/** 半角文字・全角スペース・改行しない半角スペースの重み */
export const LIGHT_COST = 0.75;

export interface MessageCost {
    /** 上限 A に対する重み付き長さ */
    length: number;
    /** 上限 B に対する幅換算 */
    width: number;
    /** 上限 C に対する単純な文字数 */
    chars: number;
    /** 改行を起こした（＝ 6.75 換算になった）半角スペースの個数 */
    breakSpaces: number;
}

export function messageCost(text: string): MessageCost {
    const chars = Array.from(text);
    const breaks = spaceBreakIndices(text);
    let length = 0;
    let breakSpaces = 0;
    chars.forEach((c, i) => {
        if (c === ' ') {
            const isBreak = breaks.has(i);
            length += isBreak ? BREAK_SPACE_COST : LIGHT_COST;
            if (isBreak) breakSpaces++;
            return;
        }
        // 全角スペースは「幅 1.0 だが長さは軽い」という実測どおりの二面性を持つ
        const isFullGlyph = c !== '　' && charWidth(c) >= 1.0;
        length += isFullGlyph ? 1 : LIGHT_COST;
    });
    return { length, width: textWidth(text), chars: chars.length, breakSpaces };
}

export const isOverLimit = (cost: MessageCost): boolean =>
    cost.length > LIMIT_LENGTH || cost.width > LIMIT_WIDTH || cost.chars > LIMIT_CHARS;

/** あと何文字ぶん置けるか（全角 1 文字を単位に、3 つの上限のうち厳しい方） */
export const remainingFullWidth = (cost: MessageCost): number =>
    Math.floor(
        Math.min(LIMIT_LENGTH - cost.length, LIMIT_WIDTH - cost.width, LIMIT_CHARS - cost.chars),
    );

/** 超過ぶん（全角何文字ぶん減らせばよいか） */
export const overBy = (cost: MessageCost): number =>
    Math.ceil(
        Math.max(cost.length - LIMIT_LENGTH, cost.width - LIMIT_WIDTH, cost.chars - LIMIT_CHARS),
    );
