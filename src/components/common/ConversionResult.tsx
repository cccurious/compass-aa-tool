import { ConvertResult } from '../../core/convert';
import {
    LINE_LIMIT,
    MESSAGE_LIMIT_LENGTH,
    MESSAGE_LIMIT_WIDTH,
    charWidth,
    messageCost,
} from '../../core/metrics';
import { HelpTooltip } from './HelpTooltip';

/**
 * 幅テーブル駆動の 1 行レンダリング。
 * 各文字を実機の実測幅のボックスに入れて並べるため、ブラウザ側のフォントが
 * 何であっても文字の累積位置＝実機表示と一致する（フォント差によるずれを排除）。
 */
const ChatLine = ({ text }: { text: string }) => (
    <div className="chat-line">
        {Array.from(text).map((ch, i) => (
            <span key={i} className="chat-ch" style={{ width: `${charWidth(ch)}em` }}>
                {ch}
            </span>
        ))}
        {text === '' && ' '}
    </div>
);

interface ConversionResultProps {
    result: ConvertResult;
    onCopy: () => void;
    /** 見出し（既定「チャット表示プレビュー」） */
    title?: string;
}

/** プレビュー・警告・文字数カウンタ・コピーボタン（貼り付け／ドット打ち共通） */
export const ConversionResult = ({ result, onCopy, title }: ConversionResultProps) => {
    // 実機の上限は 2 本立て（metrics.ts の v4 モデル）:
    //   A: 長さ 271.5（全角の直後の半角スペースだけ 16）／ B: 幅換算 184（半角 0.5）
    const cost = messageCost(result.output);
    const overA = cost.length > MESSAGE_LIMIT_LENGTH;
    const overB = cost.width > MESSAGE_LIMIT_WIDTH;
    const over = overA || overB;
    // 「あと全角何文字置けるか」= 両予算の残りの小さい方（全角 1 字は A/B とも 1 消費）
    const remain = Math.floor(
        Math.min(MESSAGE_LIMIT_LENGTH - cost.length, MESSAGE_LIMIT_WIDTH - cost.width),
    );
    const overBy = Math.ceil(
        Math.max(cost.length - MESSAGE_LIMIT_LENGTH, cost.width - MESSAGE_LIMIT_WIDTH),
    );
    // 超過の主因が「全角直後の半角スペース」のときは内訳を添える（何を減らすべきか示す）
    const spaceHint =
        overA && cost.heavySpaces > 0
            ? `（全角の直後の半角スペース ${cost.heavySpaces} 個が 1 個 16 文字ぶんを消費）`
            : '';
    return (
        <>
            <section className="card-inputs">
                <h3 className="section-title">
                    {title ?? 'チャット表示プレビュー'}
                    <HelpTooltip text="ゲーム内での見え方を再現しています。緑の枠がチャット1行ぶんの幅（全角20文字）で、ここを超えると自動で折り返されます。" />
                </h3>
                <div className="chat-bubble">
                    {/* 実機 1 行ぶんの幅（全角 20.5 字）を持つ枠。これを中央に置くことで
                        吹き出し内の左右位置まで実機と同じ見え方になる */}
                    <div className="chat-canvas">
                        {result.preview.map((line, i) => (
                            <ChatLine key={i} text={line.text} />
                        ))}
                    </div>
                </div>
                {result.overflowLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ {result.overflowLines.map((n) => n + 1).join(', ')} 行目が 1 行の上限
                        （全角約 {Math.floor(LINE_LIMIT)}{' '}
                        文字）を超えています。行を短くしてください。
                    </div>
                )}
                {result.removedLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ ゲーム内で消えてしまう文字を取り除きました（
                        {result.removedLines
                            .map((u) => `${u.line + 1}行目: ${u.chars.join(' ')}`)
                            .join(' ／ ')}
                        ）。別の文字に置き換えてください。
                    </div>
                )}
                {result.filteredSequenceLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ ゲーム内で別の文字に変わってしまう並びがあります（
                        {result.filteredSequenceLines
                            .map((u) => `${u.line + 1}行目: ${u.sequences.join(' ')}`)
                            .join(' ／ ')}
                        ）。間に別の文字を挟むか、並び順を変えてください。
                    </div>
                )}
                {result.unknownWidthLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ ゲーム内での幅が未確認の文字が含まれています（
                        {result.unknownWidthLines
                            .map((u) => `${u.line + 1}行目: ${u.chars.join(' ')}`)
                            .join(' ／ ')}
                        ）。形が崩れるかもしれません。
                    </div>
                )}
                {result.leadingSpaceLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ {result.leadingSpaceLines.map((n) => n + 1).join(', ')} 行目の行頭に
                        半角スペースがあります。ゲーム内では消えてしまうので、
                        字下げには全角スペースを使ってください。
                    </div>
                )}
            </section>

            <div className={`char-count ${over ? 'over' : ''}`}>
                {over
                    ? `上限超過 — 全角 ${overBy} 文字ぶん減らしてください${spaceHint}`
                    : `残り 全角 ${remain} 文字ぶん（幅換算 ${cost.width} / ${MESSAGE_LIMIT_WIDTH}）`}
                <HelpTooltip
                    text={`上限は 2 つあります。① 全角換算 ${MESSAGE_LIMIT_WIDTH} 文字ぶん（半角の文字とスペースは 0.5 文字ぶん）。② 長さ 271 文字ぶん（全角文字の直後にある半角スペースだけ、1 個で全角 16 文字ぶんに膨らみます）。どちらかを超えたぶんは送信時に末尾が切り捨てられます。カウンタの残りは 2 つのうち厳しい方です。`}
                />
            </div>
            <button className="primary-btn" onClick={onCopy}>
                ゲーム用のテキストをコピー
            </button>
        </>
    );
};
