import { useMemo, useState } from 'react';
import { convert } from '../../core/convert';
import { CALIBRATED, LINE_LIMIT } from '../../core/metrics';

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
                                <div key={i} className="chat-line">{line.text || ' '}</div>
                            ))}
                        </div>
                        {result.overflowLines.length > 0 && (
                            <div className="warn-note">
                                ⚠️ {result.overflowLines.map((n) => n + 1).join(', ')} 行目が 1 行の上限
                                （全角約 {LINE_LIMIT} 文字）を超えています。行を短くしてください。
                            </div>
                        )}
                    </section>

                    <button className="primary-btn" onClick={handleCopy}>
                        変換テキストをコピー
                    </button>
                </>
            )}

            <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
        </div>
    );
};
