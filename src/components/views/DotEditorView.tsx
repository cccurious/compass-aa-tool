import { useMemo, useRef, useState } from 'react';
import { useDotStore } from '../../store/useDotStore';
import { gridToText, GRID_COLS } from '../../core/grid';
import { convert } from '../../core/convert';
import { charWidth, MAX_MESSAGE_CHARS } from '../../core/metrics';

interface DotEditorViewProps {
    onSendToConverter: (text: string) => void;
}

export const DotEditorView = ({ onSendToConverter }: DotEditorViewProps) => {
    const { grid, palette, brush, setBrush, paint, addPaletteChar, addRow, removeRow, clearAll } =
        useDotStore();
    const [newChar, setNewChar] = useState('');
    const [toast, setToast] = useState('');
    const paintingRef = useRef(false);

    const text = useMemo(() => gridToText(grid), [grid]);
    const outLen = useMemo(
        () => (text ? Array.from(convert(text).output).length : 0),
        [text],
    );

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2000);
    };

    const handleAddChar = () => {
        const chars = Array.from(newChar.trim());
        const ch = chars[0];
        if (!ch) return;
        if (chars.length > 1) {
            showToast('1 文字だけ入力してください');
            return;
        }
        if (charWidth(ch) !== 1.0) {
            showToast('全角幅（1.0）の文字のみ使えます');
            return;
        }
        addPaletteChar(ch);
        setBrush(ch);
        setNewChar('');
    };

    // タッチドラッグ塗り: 座標からセルを特定する
    const paintFromPoint = (clientX: number, clientY: number) => {
        const el = document.elementFromPoint(clientX, clientY);
        const cell = el?.closest('[data-cell]');
        if (!cell) return;
        const [r, c] = (cell as HTMLElement).dataset.cell!.split(',').map(Number);
        paint(r, c);
    };

    return (
        <div>
            <section className="card-inputs">
                <div className="section-title">パレット</div>
                <div className="dot-palette">
                    <button
                        className={`dot-palette-btn ${brush === '' ? 'active' : ''}`}
                        onClick={() => setBrush('')}
                    >
                        消
                    </button>
                    {palette.map((ch) => (
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
                        value={newChar}
                        onChange={(e) => setNewChar(e.target.value)}
                        placeholder="追加する全角文字"
                        maxLength={2}
                    />
                    <button className="bulk-btn" onClick={handleAddChar}>パレットに追加</button>
                </div>
            </section>

            <section className="card-inputs">
                <div className="section-title">キャンバス（{GRID_COLS} 列 × {grid.length} 行）</div>
                <div
                    className="dot-grid"
                    onPointerDown={(e) => {
                        paintingRef.current = true;
                        paintFromPoint(e.clientX, e.clientY);
                        // タッチの暗黙キャプチャを解除してドラッグ塗りを elementFromPoint で追う。
                        // キャプチャが無い場合（マウス等）は NotFoundError になるため握りつぶす
                        try {
                            (e.target as Element).releasePointerCapture(e.pointerId);
                        } catch {
                            /* キャプチャ未設定なら何もしない */
                        }
                    }}
                    onPointerMove={(e) => {
                        if (paintingRef.current) paintFromPoint(e.clientX, e.clientY);
                    }}
                    onPointerUp={() => { paintingRef.current = false; }}
                    onPointerLeave={() => { paintingRef.current = false; }}
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
                    <button className="bulk-btn" onClick={addRow}>行を追加</button>
                    <button className="bulk-btn" onClick={removeRow}>行を削除</button>
                    <button className="bulk-btn" onClick={clearAll}>全消去</button>
                </div>
                <div className={`char-count ${outLen > MAX_MESSAGE_CHARS ? 'over' : ''}`}>
                    変換後 {outLen} / {MAX_MESSAGE_CHARS} 文字
                    {outLen > MAX_MESSAGE_CHARS && ' — 上限超過。行数や右側の余白を減らしてください'}
                </div>
            </section>

            <button
                className="primary-btn"
                onClick={() => {
                    if (!text) {
                        showToast('キャンバスが空です');
                        return;
                    }
                    onSendToConverter(text);
                }}
            >
                AA 変換へ送る
            </button>

            <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
        </div>
    );
};
