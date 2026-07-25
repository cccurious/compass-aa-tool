import { useMemo, useState } from 'react';
import { convert } from '../../core/convert';
import { ConversionResult } from '../common/ConversionResult';

interface AaConverterViewProps {
    input: string;
    setInput: (text: string) => void;
}

export const AaConverterView = ({ input, setInput }: AaConverterViewProps) => {
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
            <section className="card-inputs">
                <div className="section-title">AAを貼り付け</div>
                <textarea
                    className="aa-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                        'ここに AA を貼り付け（改行したままで OK）\n' +
                        'ゲーム内で同じ形に見えるよう自動で調整します'
                    }
                    rows={8}
                    spellCheck={false}
                />
                <div className="bulk-actions">
                    <button className="bulk-btn" onClick={() => setInput('')}>クリア</button>
                </div>
            </section>

            {result && <ConversionResult result={result} onCopy={handleCopy} />}

            <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
        </div>
    );
};
