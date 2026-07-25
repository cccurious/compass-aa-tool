import { useMemo } from 'react';
import { convert } from '../../core/convert';
import { ConversionResult } from '../common/ConversionResult';
import { HelpTooltip } from '../common/HelpTooltip';
import { Toast } from '../common/Toast';
import { useToast } from '../../hooks/useToast';
import { useCopyResult } from '../../hooks/useCopyResult';

interface AaConverterViewProps {
    input: string;
    setInput: (text: string) => void;
    onCopied: () => void;
}

export const AaConverterView = ({ input, setInput, onCopied }: AaConverterViewProps) => {
    const { toast, showToast } = useToast();
    const copyResult = useCopyResult('aa', showToast, onCopied);

    const result = useMemo(() => (input ? convert(input) : null), [input]);

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
                    <button className="bulk-btn" onClick={() => setInput('')}>
                        クリア
                    </button>
                </div>
                {/* 貼り付け AA はどんな文字でも来るため、実機確認が追いついていない
                    文字が混ざりうる。条件つきの警告だけでは気づけないので、
                    現状の精度をこの位置に常時出しておく（2026-07-26 ユーザー要望） */}
                <div className="notice-note">
                    <b>変換精度について</b>
                    <br />
                    iOS と Android では一部の文字が違う幅で表示されることが分かっており、
                    まだ全ての文字を確認できていません。そのため貼り付けた AA によっては、
                    実機での折り返し位置がプレビューとずれることがあります。
                    確認できた文字から順次対応していきます。
                    <br />
                    確実に同じ形で表示したい場合は、確認済みの文字だけを載せている
                    <b>ドット打ちエディタ</b>のご利用がおすすめです。
                </div>
            </section>

            {result ? (
                <ConversionResult result={result} onCopy={() => copyResult(result)} />
            ) : (
                <div className="empty-guide">
                    <p className="empty-guide-lead">
                        他所で見つけた AA や、自分で作った AA を貼り付けてください。
                    </p>
                    <p className="empty-guide-note">
                        改行はそのままで構いません。ゲームのチャットは改行が使えないため、
                        同じ形に見えるよう自動で調整した 1 行のテキストに変換します。
                    </p>
                </div>
            )}

            <Toast message={toast} />
        </div>
    );
};
