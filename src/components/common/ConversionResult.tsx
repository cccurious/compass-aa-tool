import { ConvertResult } from '../../core/convert';
import {
    LINE_LIMIT,
    MESSAGE_UNIT_LIMIT,
    INPUT_FIELD_CHARS_OBSERVED,
    charWidth,
    messageUnits,
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
    // 実機の上限は「重み付き文字数」（通常 1・半角スペースのみ 16）。units ＝ 全角換算
    const units = messageUnits(result.output);
    const over = units > MESSAGE_UNIT_LIMIT;
    // 入力欄の打鍵段階には別の文字数制限（観測 184）もあるため、迫ったら注意書き
    const nearInputCap =
        !over && Array.from(result.output).length > INPUT_FIELD_CHARS_OBSERVED.fullWidth - 4;
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
                    ? `上限超過（${units} / ${MESSAGE_UNIT_LIMIT}）— 全角 ${units - MESSAGE_UNIT_LIMIT} 文字ぶん減らしてください`
                    : nearInputCap
                      ? `残り 全角 ${MESSAGE_UNIT_LIMIT - units} 文字ぶん（${units} / ${MESSAGE_UNIT_LIMIT}）※文字数も入力欄の上限付近です`
                      : `残り 全角 ${MESSAGE_UNIT_LIMIT - units} 文字ぶん（${units} / ${MESSAGE_UNIT_LIMIT}）`}
                <HelpTooltip
                    text={`1メッセージの上限は全角換算で ${MESSAGE_UNIT_LIMIT} 文字ぶんです。ほとんどの文字は 1 文字ぶんですが、改行の代わりに入る半角スペースだけは 1 個で全角 16 文字ぶんを消費します。超えたぶんは送信時に末尾が切り捨てられます。`}
                />
            </div>
            <button className="primary-btn" onClick={onCopy}>
                ゲーム用のテキストをコピー
            </button>
        </>
    );
};
