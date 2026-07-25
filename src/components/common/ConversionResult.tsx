import { ConvertResult } from '../../core/convert';
import { LINE_LIMIT, MAX_MESSAGE_CHARS, charWidth } from '../../core/metrics';

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
    const outLen = Array.from(result.output).length;
    return (
        <>
            <section className="card-inputs">
                <div className="section-title">{title ?? 'チャット表示プレビュー'}</div>
                <div className="chat-bubble">
                    {result.preview.map((line, i) => (
                        <ChatLine key={i} text={line.text} />
                    ))}
                </div>
                {result.overflowLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ {result.overflowLines.map((n) => n + 1).join(', ')} 行目が 1 行の上限
                        （全角約 {Math.floor(LINE_LIMIT)} 文字）を超えています。行を短くしてください。
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

            <div className={`char-count ${outLen > MAX_MESSAGE_CHARS ? 'over' : ''}`}>
                {outLen} / {MAX_MESSAGE_CHARS} 文字
                {outLen > MAX_MESSAGE_CHARS && ' — 上限超過。行数を減らすか行を短くしてください'}
            </div>
            <button className="primary-btn" onClick={onCopy}>
                変換テキストをコピー
            </button>
        </>
    );
};
