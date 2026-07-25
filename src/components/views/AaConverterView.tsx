import { useMemo, useState } from 'react';
import { convert } from '../../core/convert';
import { CALIBRATED, LINE_LIMIT, MAX_MESSAGE_CHARS, charWidth } from '../../core/metrics';

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

const SAMPLE = '（＾ω＾）\n＜わっしょい＞\n∪　∪';

export const AaConverterView = () => {
    const [input, setInput] = useState('');
    const [toast, setToast] = useState('');

    const result = useMemo(() => (input ? convert(input) : null), [input]);

    const handleCopy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.output);
            setToast('コピーしました！');
        } catch {
            setToast('コピーに失敗しました');
        }
        setTimeout(() => setToast(''), 2000);
    };

    return (
        <div>
            {!CALIBRATED && (
                <div className="calibration-note">
                    ⚠️ 開発版: 文字幅データは実機未校正です。実際の表示とズレる場合があります。
                </div>
            )}

            <section className="card-inputs">
                <div className="section-title">AAを貼り付け</div>
                <textarea
                    className="aa-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`作りたい形のAAを複数行で入力\n例:\n${SAMPLE}`}
                    rows={8}
                    spellCheck={false}
                />
                <div className="bulk-actions">
                    <button className="bulk-btn" onClick={() => setInput(SAMPLE)}>サンプル</button>
                    <button className="bulk-btn" onClick={() => setInput('')}>クリア</button>
                </div>
            </section>

            {result && (
                <>
                    <section className="card-inputs">
                        <div className="section-title">チャット表示プレビュー</div>
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

                    <div className={`char-count ${Array.from(result.output).length > MAX_MESSAGE_CHARS ? 'over' : ''}`}>
                        {Array.from(result.output).length} / {MAX_MESSAGE_CHARS} 文字
                        {Array.from(result.output).length > MAX_MESSAGE_CHARS &&
                            ' — 上限超過。行数を減らすか行を短くしてください'}
                    </div>
                    <button className="primary-btn" onClick={handleCopy}>
                        変換テキストをコピー
                    </button>
                </>
            )}

            <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
        </div>
    );
};
