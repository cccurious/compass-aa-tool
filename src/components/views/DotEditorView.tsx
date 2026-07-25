import { useMemo, useRef, useState } from 'react';
import {
    useDotStore,
    PALETTE_CATEGORIES,
    MAX_ROWS,
    MAX_CUSTOM_CHARS,
} from '../../store/useDotStore';
import { gridToText, GRID_COLS } from '../../core/grid';
import { convert } from '../../core/convert';
import { ConversionResult } from '../common/ConversionResult';
import { HelpTooltip } from '../common/HelpTooltip';
import { utf8ByteLength, MAX_MESSAGE_BYTES } from '../../core/metrics';
import { trackCopy, trackPaletteAdd } from '../../utils/analytics';

interface DotEditorViewProps {
    onSendToConverter: (text: string) => void;
    onCopied: () => void;
}

export const DotEditorView = ({ onSendToConverter, onCopied }: DotEditorViewProps) => {
    const {
        grid, customPalette, recentChars, brush, setBrush, beginStroke, paint, endStroke,
        addPaletteChars, clearCustom, addRow, removeRow, clearAll,
    } = useDotStore();
    const [charInput, setCharInput] = useState('');
    const [toast, setToast] = useState('');
    const [category, setCategory] = useState(PALETTE_CATEGORIES[0].id);
    const paintingRef = useRef(false);

    // 最近使った文字を先頭に、追加した文字は専用カテゴリにまとめる
    const tabs = [
        ...(recentChars.length > 0
            ? [{ id: 'recent', label: '最近', chars: recentChars }]
            : []),
        ...PALETTE_CATEGORIES,
        ...(customPalette.length > 0
            ? [{ id: 'custom', label: '追加分', chars: customPalette }]
            : []),
    ];
    const shown = tabs.find((t) => t.id === category) ?? tabs[0];

    const text = useMemo(() => gridToText(grid), [grid]);
    const result = useMemo(() => (text ? convert(text) : null), [text]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2600);
    };

    const handleAddChars = () => {
        if (!charInput.trim()) return;
        const { added, skipped, overflow } = addPaletteChars(charInput);
        trackPaletteAdd({ added: added.length, skipped: skipped.length });
        const parts: string[] = [];
        if (added.length > 0) parts.push(`${added.join('')} を追加`);
        if (skipped.length > 0) parts.push(`半角など ${skipped.length} 字は対象外`);
        if (overflow.length > 0) parts.push(`上限 ${MAX_CUSTOM_CHARS} 字のため ${overflow.length} 字は省略`);
        showToast(parts.length > 0 ? parts.join(' ／ ') : '追加できる新しい全角文字がありません');
        if (added.length > 0) {
            setCharInput('');
            setCategory('custom');
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.output);
            const bytes = utf8ByteLength(result.output);
            trackCopy({
                source: 'dot',
                bytes,
                lines: result.preview.length,
                over_limit: bytes > MAX_MESSAGE_BYTES,
            });
            onCopied();
        } catch {
            showToast('コピーに失敗しました');
        }
    };

    // ドラッグ塗り: 座標からセルを特定する
    const cellAt = (clientX: number, clientY: number): [number, number] | null => {
        const el = document.elementFromPoint(clientX, clientY);
        const cell = el?.closest('[data-cell]');
        if (!cell) return null;
        const [r, c] = (cell as HTMLElement).dataset.cell!.split(',').map(Number);
        return [r, c];
    };

    return (
        <div>
            <section className="card-inputs">
                <div className="section-title">
                    パレット
                    <HelpTooltip text="マス目に置く文字を選びます。「4分割」を使うと1マスを2×2の点として扱えるので細かい絵が描けます。同じ文字のマスをもう一度なぞると消えます。" />
                </div>
                <div className="dot-tabs">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            className={`dot-tab ${shown.id === t.id ? 'active' : ''}`}
                            onClick={() => setCategory(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="dot-palette">
                    <button
                        className={`dot-palette-btn ${brush === '' ? 'active' : ''}`}
                        onClick={() => setBrush('')}
                        title="消しゴム"
                    >
                        消
                    </button>
                    {shown.chars.map((ch) => (
                        <button
                            key={ch}
                            className={`dot-palette-btn ${brush === ch ? 'active' : ''}`}
                            onClick={() => setBrush(ch)}
                        >
                            {ch}
                        </button>
                    ))}
                </div>
                <div className="dot-add-row">
                    <input
                        className="dot-add-input"
                        value={charInput}
                        onChange={(e) => setCharInput(e.target.value)}
                        placeholder="文章を貼ると全角文字を抽出"
                    />
                    <button className="bulk-btn" onClick={handleAddChars}>パレットに追加</button>
                    {customPalette.length > 0 && (
                        <button
                            className="bulk-btn"
                            onClick={() => {
                                clearCustom();
                                setCategory(PALETTE_CATEGORIES[0].id);
                            }}
                        >
                            追加分を消去（{customPalette.length}）
                        </button>
                    )}
                </div>
                <div className="dot-hint">
                    同じ文字のマスをなぞると消去になります。半角文字はマス目に乗らないため除外されます。
                </div>
            </section>

            <section className="card-inputs">
                <div className="section-title">
                    キャンバス（{GRID_COLS} × {grid.length}）
                    <HelpTooltip
                        text={`横は実機1行に収まる${GRID_COLS}マス固定です。行は${MAX_ROWS}行まで増やせますが、絵が密だと途中で送信の上限に達します。`}
                    />
                </div>
                <div
                    className="dot-grid"
                    onPointerDown={(e) => {
                        const pos = cellAt(e.clientX, e.clientY);
                        if (!pos) return;
                        paintingRef.current = true;
                        beginStroke(pos[0], pos[1]);
                        // タッチの暗黙キャプチャを解除してドラッグ塗りを elementFromPoint で追う。
                        // キャプチャが無い場合（マウス等）は NotFoundError になるため握りつぶす
                        try {
                            (e.target as Element).releasePointerCapture(e.pointerId);
                        } catch {
                            /* キャプチャ未設定なら何もしない */
                        }
                    }}
                    onPointerMove={(e) => {
                        if (!paintingRef.current) return;
                        const pos = cellAt(e.clientX, e.clientY);
                        if (pos) paint(pos[0], pos[1]);
                    }}
                    onPointerUp={() => { paintingRef.current = false; endStroke(); }}
                    onPointerLeave={() => { paintingRef.current = false; endStroke(); }}
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
                <div className="bulk-actions">
                    <button className="bulk-btn" onClick={addRow} disabled={grid.length >= MAX_ROWS}>
                        行を追加
                    </button>
                    <button className="bulk-btn" onClick={removeRow} disabled={grid.length <= 1}>
                        行を削除
                    </button>
                    <button className="bulk-btn" onClick={clearAll}>全消去</button>
                </div>
            </section>

            {result ? (
                <ConversionResult result={result} onCopy={handleCopy} />
            ) : (
                <div className="dot-empty-note">マスをタップして絵を描くと、ここにプレビューが出ます。</div>
            )}

            {result && (
                <button
                    className="secondary-btn"
                    onClick={() => onSendToConverter(text)}
                >
                    テキストとして編集（AA変換へ）
                </button>
            )}

            <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
        </div>
    );
};
