import { useMemo, useState } from 'react';
import { convert } from '../../core/convert';
import { ConversionResult } from '../common/ConversionResult';
import { HelpTooltip } from '../common/HelpTooltip';
import { utf8ByteLength, MAX_MESSAGE_BYTES } from '../../core/metrics';
import { trackCopy } from '../../utils/analytics';

interface AaConverterViewProps {
    input: string;
    setInput: (text: string) => void;
    onCopied: () => void;
}

export const AaConverterView = ({ input, setInput, onCopied }: AaConverterViewProps) => {
    const [toast, setToast] = useState('');

    const result = useMemo(() => (input ? convert(input) : null), [input]);

    const handleCopy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.output);
            const bytes = utf8ByteLength(result.output);
            trackCopy({
                source: 'aa',
                bytes,
                lines: result.preview.length,
                over_limit: bytes > MAX_MESSAGE_BYTES,
                had_removed_chars: result.removedLines.length > 0,
                had_unknown_width: result.unknownWidthLines.length > 0,
            });
            setToast('コピーしました');
            onCopied();
        } catch {
            setToast('コピーできませんでした。もう一度お試しください');
        }
        setTimeout(() => setToast(''), 2000);
    };

    return (
        <div>
            <section className="card-inputs">
                <h3 className="section-title">
                    AAを貼り付け
                    <HelpTooltip text="すでにあるAAを改行したまま貼り付けてください。ゲーム内で同じ形に見えるよう、見えない調整を自動で入れます。" />
                </h3>
                <textarea
                    className="aa-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="ここに AA を貼り付け"
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
