import { ConvertResult } from '../../core/convert';
import { LINE_LIMIT, MAX_MESSAGE_BYTES, charWidth, utf8ByteLength } from '../../core/metrics';
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
    // 実機の上限は文字数ではなく UTF-8 バイト（全角 3・半角 1）
    const bytes = utf8ByteLength(result.output);
    const over = bytes > MAX_MESSAGE_BYTES;
    // 残量は「全角であと何文字置けるか」で示す（利用者の感覚に近い）
    const remainCells = Math.floor((MAX_MESSAGE_BYTES - bytes) / 3);
    return (
        <>
            <section className="card-inputs">
                <div className="section-title">
                    {title ?? 'チャット表示プレビュー'}
                    <HelpTooltip text="ゲーム内での見え方を再現しています。緑の枠の幅が実機の1行ぶん（全角20文字）で、この幅を超えると自動で折り返されます。" />
                </div>
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
                        （全角約 {Math.floor(LINE_LIMIT)} 文字）を超えています。行を短くしてください。
                    </div>
                )}
                {result.removedLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ 実機で消えてしまう文字を取り除きました（
                        {result.removedLines
                            .map((u) => `${u.line + 1}行目: ${u.chars.join(' ')}`)
                            .join(' ／ ')}
                        ）。別の文字に置き換えてください。
                    </div>
                )}
                {result.filteredSequenceLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ 実機で別の文字に置き換わる並びがあります（
                        {result.filteredSequenceLines
                            .map((u) => `${u.line + 1}行目: ${u.sequences.join(' ')}`)
                            .join(' ／ ')}
                        ）。間に別の文字を挟むか、並び順を変えてください。
                    </div>
                )}
                {result.unknownWidthLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ 幅が未確認の文字が含まれています（
                        {result.unknownWidthLines
                            .map((u) => `${u.line + 1}行目: ${u.chars.join(' ')}`)
                            .join(' ／ ')}
                        ）。実機で形が崩れる可能性があります。
                    </div>
                )}
                {result.leadingSpaceLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ {result.leadingSpaceLines.map((n) => n + 1).join(', ')} 行目の行頭に
                        半角スペースがあります。ゲーム内では消えてしまうため、
                        字下げには全角スペースを使ってください。
                    </div>
                )}
            </section>

            <div className={`char-count ${over ? 'over' : ''}`}>
                {over
                    ? `上限超過（${bytes} / ${MAX_MESSAGE_BYTES}）— 全角 ${Math.ceil((bytes - MAX_MESSAGE_BYTES) / 3)} 文字ぶん減らしてください`
                    : `残り 全角 ${remainCells} 文字ぶん（${bytes} / ${MAX_MESSAGE_BYTES}）`}
                <HelpTooltip text="1メッセージの上限は文字数ではなくバイト数（全角3・半角1）で512バイトです。超えたぶんは送信時に末尾が切り捨てられます。" />
            </div>
            <button className="primary-btn" onClick={onCopy}>
                変換テキストをコピー
            </button>
        </>
    );
};
