import { useMemo } from 'react';
import { convert } from '../../core/convert';
import { substituteUnsafe } from '../../core/substitute';
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

    // 置き換え候補の下見（ボタンを出すかどうかの判定に使う）。
    // exact: 意味が保たれる置き換えだけ ／ full: 見た目が変わるものも含む
    const exact = useMemo(() => substituteUnsafe(input, false), [input]);
    const full = useMemo(() => substituteUnsafe(input, true), [input]);
    const approxExtra = full.replaced.length - exact.replaced.length;

    const applySubstitute = (approx: boolean) => {
        const r = approx ? full : exact;
        setInput(r.text);
        showToast(
            `${r.replaced.length} 種類の文字を置き換えました` +
                (r.unresolved.length > 0
                    ? `（${r.unresolved.join(' ')} は代わりがありません）`
                    : ''),
        );
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
                    <button className="bulk-btn" onClick={() => setInput('')}>
                        クリア
                    </button>
                </div>
                {/* 貼り付け AA はどんな文字でも来るので、保証できない旨だけは常に見せる。
                    ただし画面が文字だらけになると読まれなくなるため、ここは最小限にして
                    詳しい説明は「使い方・注意」へ逃がす（2026-07-26 ユーザー方針） */}
                <div className="notice-note">
                    文字の幅は端末によって少し変わることがあり、すべての環境で
                    同じ見え方になるとはお約束できません。 きれいに出したいときは
                    <b>ドット打ちエディタ</b>がおすすめです。 くわしくは
                    <b>使い方・注意</b>をご覧ください。
                </div>
            </section>

            {result ? (
                <ConversionResult
                    result={result}
                    onCopy={() => copyResult(result)}
                    substituteActions={
                        exact.replaced.length > 0 || approxExtra > 0 ? (
                            <div>
                                {exact.replaced.length > 0 && (
                                    <button
                                        className="substitute-btn"
                                        onClick={() => applySubstitute(false)}
                                    >
                                        安全な文字に置き換える（{exact.replaced.length} 種類）
                                    </button>
                                )}
                                {approxExtra > 0 && (
                                    <button
                                        className="substitute-btn"
                                        onClick={() => applySubstitute(true)}
                                    >
                                        見た目が変わる置き換えも行う（＋{approxExtra} 種類）
                                    </button>
                                )}
                            </div>
                        ) : null
                    }
                />
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
