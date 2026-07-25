import { useMemo } from 'react';
import { useDotStore, MAX_ROWS } from '../../store/useDotStore';
import { gridToText, GRID_COLS } from '../../core/grid';
import { convert } from '../../core/convert';
import { ConversionResult } from '../common/ConversionResult';
import { HelpTooltip } from '../common/HelpTooltip';
import { Toast } from '../common/Toast';
import { useToast } from '../../hooks/useToast';
import { useCopyResult } from '../../hooks/useCopyResult';
import { PalettePanel } from './dot/PalettePanel';
import { useZoomPan } from './dot/useZoomPan';
import { useCanvasGestures } from './dot/useCanvasGestures';

interface DotEditorViewProps {
    onSendToConverter: (text: string) => void;
    onCopied: () => void;
}

export const DotEditorView = ({ onSendToConverter, onCopied }: DotEditorViewProps) => {
    const { grid, history, undo, addRow, removeRow, clearAll } = useDotStore();
    const { toast, showToast } = useToast();
    const copyResult = useCopyResult('dot', showToast, onCopied);
    const { zoomed, toggleZoom, wrapRef, thumbRef, updateThumb } = useZoomPan();
    const { onPointerDown, onPointerMove } = useCanvasGestures(wrapRef, updateThumb);

    const text = useMemo(() => gridToText(grid), [grid]);
    const result = useMemo(() => (text ? convert(text) : null), [text]);

    return (
        <div>
            <PalettePanel showToast={showToast} />

            <section className="card-inputs">
                <h3 className="section-title">
                    キャンバス（{GRID_COLS} × {grid.length}）
                    {zoomed && <span className="zoom-badge">2倍表示中</span>}
                    <HelpTooltip
                        text={`横はチャット1行に収まる${GRID_COLS}マス固定です。縦は${MAX_ROWS}行まで増やせますが、長さの上限があるため実際に送れるのは9行が目安です。スマホでマスが小さいときは「拡大」を押してください（拡大中は2本指で横スクロールできます）。`}
                    />
                </h3>
                <div
                    className={`dot-grid-wrap ${zoomed ? 'zoomed' : ''}`}
                    ref={wrapRef}
                    onScroll={updateThumb}
                >
                    <div
                        className="dot-grid"
                        style={{ width: zoomed ? '200%' : '100%' }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                    >
                        {grid.map((row, r) => (
                            <div key={r} className="dot-grid-row">
                                {row.map((cell, c) => (
                                    <div key={c} className="dot-cell" data-cell={`${r},${c}`}>
                                        {cell}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                {zoomed && (
                    <div className="dot-scrollbar" aria-hidden="true">
                        <div className="dot-scrollbar-thumb" ref={thumbRef} />
                    </div>
                )}
                {/* 拡大ボタンが出る幅（640px 以下）では 5 ボタンが 1 行に収まらないため、
                    そこだけ CSS で短縮ラベル（btn-short）へ切り替える */}
                <div className="bulk-actions dot-actions-row">
                    <button
                        className="bulk-btn dot-undo-btn"
                        onClick={undo}
                        disabled={history.length === 0}
                    >
                        ↩ <span className="btn-long">元に</span>戻す
                    </button>
                    <button
                        className={`bulk-btn dot-zoom-btn ${zoomed ? 'active' : ''}`}
                        onClick={toggleZoom}
                    >
                        {zoomed ? (
                            <>
                                等倍<span className="btn-long">にもどす</span>
                            </>
                        ) : (
                            '拡大'
                        )}
                    </button>
                    <button
                        className="bulk-btn"
                        onClick={addRow}
                        disabled={grid.length >= MAX_ROWS}
                    >
                        <span className="btn-long">行を追加</span>
                        <span className="btn-short">行＋</span>
                    </button>
                    <button className="bulk-btn" onClick={removeRow} disabled={grid.length <= 1}>
                        <span className="btn-long">行を削除</span>
                        <span className="btn-short">行−</span>
                    </button>
                    <button className="bulk-btn" onClick={clearAll}>
                        全消去
                    </button>
                </div>
            </section>

            {result ? (
                <ConversionResult result={result} onCopy={() => copyResult(result)} />
            ) : (
                <div className="empty-guide">
                    <p className="empty-guide-lead">マス目をタップすると絵が描けます。</p>
                    <ol className="empty-guide-steps">
                        <li>上のパレットで置きたい文字を選ぶ</li>
                        <li>マス目をなぞって描く（同じ文字をもう一度なぞると消えます）</li>
                        <li>ここに出るプレビューで確認して、コピーしてゲームに貼り付け</li>
                    </ol>
                </div>
            )}

            {result && (
                <button className="secondary-btn" onClick={() => onSendToConverter(text)}>
                    テキストで細かく調整する
                </button>
            )}

            <Toast message={toast} />
        </div>
    );
};
