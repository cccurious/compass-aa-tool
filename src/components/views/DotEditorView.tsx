import { useEffect, useMemo, useRef, useState } from 'react';
import {
    useDotStore,
    PALETTE_CATEGORIES,
    PRESET_PALETTE,
    SUGGEST_CHARS,
    MAX_ROWS,
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
        setCellValue, addPaletteChars, clearCustom, addRow, removeRow, clearAll,
    } = useDotStore();
    const [charInput, setCharInput] = useState('');
    const [showSuggest, setShowSuggest] = useState(false);
    const [toast, setToast] = useState('');
    const [category, setCategory] = useState(PALETTE_CATEGORIES[0].id);
    // 拡大表示（スマホでマスが小さく狙いにくいため）。等倍が既定なので PC は従来どおり
    const [zoomed, setZoomed] = useState(false);
    const thumbRef = useRef<HTMLDivElement>(null);

    // スクロール位置インジケータ（iOS はスクロールバーを隠すため自前で描く）。
    // 2 本指パン中に毎フレーム発火するので、再レンダーせず DOM を直接更新する
    const updateThumb = () => {
        const w = wrapRef.current;
        const t = thumbRef.current;
        if (!w || !t) return;
        const ratioW = w.clientWidth / w.scrollWidth;
        t.style.width = `${ratioW * 100}%`;
        t.style.left = `${(w.scrollLeft / w.scrollWidth) * 100}%`;
    };

    const toggleZoom = () => {
        const w = wrapRef.current;
        // いま見ている場所（中心）の比率を保ったまま拡大縮小する
        const center = w && w.scrollWidth > 0 ? (w.scrollLeft + w.clientWidth / 2) / w.scrollWidth : 0.5;
        setZoomed((v) => !v);
        // 幅アニメーションの間も毎フレーム追従させる。アニメ後にまとめて合わせると
        // 「別の場所で拡大 → 中央へ跳ぶ」ように見える（実機フィードバック）
        const start = performance.now();
        const step = (now: number) => {
            const w2 = wrapRef.current;
            if (w2) {
                w2.scrollLeft = center * w2.scrollWidth - w2.clientWidth / 2;
                updateThumb();
            }
            if (now - start < 350) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        // rAF はタブが背面にあると止まるため、最終位置は setTimeout でも保証する
        window.setTimeout(() => {
            const w2 = wrapRef.current;
            if (w2) w2.scrollLeft = center * w2.scrollWidth - w2.clientWidth / 2;
            updateThumb();
        }, 400);
    };
    const paintingRef = useRef(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    // 2 本指はスクロール、1 本指は描画。ブラウザ任せにすると
    // 1 本指のドラッグがスクロールに取られて塗れなくなるため自前で捌く
    const pointersRef = useRef(new Map<number, { x: number; y: number }>());
    const panRef = useRef<{ x: number; scrollLeft: number } | null>(null);
    // ストローク開始セルの元の値。2 本指パンの 1 本目が塗ってしまったぶんを戻すため
    const strokeStartRef = useRef<{ row: number; col: number; prev: string; at: number } | null>(null);

    // 指の記録の掃除は window で行う（グリッド上のハンドラだけだと、指がグリッドの
    // 外で離れたときに pointerup を取りこぼして記録が残留し、以後ずっと 2 本指と
    // 誤判定される＝ドット打ち不能になる。実機で発生した事故）
    useEffect(() => {
        const release = (e: PointerEvent) => {
            pointersRef.current.delete(e.pointerId);
            if (pointersRef.current.size < 2) panRef.current = null;
            if (pointersRef.current.size === 0) {
                paintingRef.current = false;
                endStroke();
            }
        };
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        return () => {
            window.removeEventListener('pointerup', release);
            window.removeEventListener('pointercancel', release);
        };
    }, [endStroke]);

    // 最近使った文字を先頭に。「追加分」は空でも常に出す
    // （タブを開くと追加用の UI が現れる、という入口を兼ねるため）
    const tabs = [
        ...(recentChars.length > 0
            ? [{ id: 'recent', label: '最近', chars: recentChars }]
            : []),
        ...PALETTE_CATEGORIES,
        { id: 'custom', label: '追加分', chars: customPalette },
    ];
    const shown = tabs.find((t) => t.id === category) ?? tabs[0];

    // 追加候補: ゲーム内での幅 1.0 が確認済みで、まだパレットに無い文字
    const suggestions = useMemo(
        () =>
            SUGGEST_CHARS.filter(
                (ch) => !PRESET_PALETTE.includes(ch) && !customPalette.includes(ch),
            ),
        [customPalette],
    );

    const text = useMemo(() => gridToText(grid), [grid]);
    const result = useMemo(() => (text ? convert(text) : null), [text]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2600);
    };

    const handleAddChars = () => {
        if (!charInput.trim()) return;
        const { added, skipped, evicted } = addPaletteChars(charInput);
        trackPaletteAdd({ added: added.length, skipped: skipped.length });
        const parts: string[] = [];
        if (added.length > 0) parts.push(`${added.join('')} を追加`);
        if (skipped.length > 0) parts.push(`マス目に置けない ${skipped.length} 字は除外`);
        if (evicted.length > 0) parts.push(`古い ${evicted.join('')} と入れ替え`);
        showToast(parts.length > 0 ? parts.join(' ／ ') : '追加できる文字が見つかりませんでした');
        if (added.length > 0) setCharInput('');
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
                had_removed_chars: result.removedLines.length > 0,
                had_unknown_width: result.unknownWidthLines.length > 0,
            });
            showToast('コピーしました');
            onCopied();
        } catch {
            showToast('コピーできませんでした。もう一度お試しください');
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
                <h3 className="section-title">
                    パレット
                    <HelpTooltip text="マス目に置く文字を選びます。「4分割」を使うと1マスを2×2の点として扱えるので細かい絵が描けます。一度使った文字は「最近」タブに残るので、そこから選び直せます。" />
                </h3>
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
                    {shown.id === 'custom' && shown.chars.length === 0 && (
                        <span className="dot-suggest-empty">
                            まだありません。下の欄か「候補から選ぶ」で追加できます。
                        </span>
                    )}
                </div>
                {shown.id === 'custom' && (
                <div className="dot-add">
                    {/* 説明はラベルとして常に見える位置に置く。placeholder に入れると
                        狭い画面で見切れて何を入れる欄か分からなくなる */}
                    <label className="dot-add-label" htmlFor="palette-add">
                        パレットに新しい文字を追加
                    </label>
                    <input
                        id="palette-add"
                        className="dot-add-input"
                        value={charInput}
                        onChange={(e) => setCharInput(e.target.value)}
                        placeholder="文字を入力して「追加」を押す（文章でも可）"
                    />
                    <div className="dot-add-actions">
                        <button className="bulk-btn" onClick={handleAddChars}>追加</button>
                        <button className="bulk-btn" onClick={() => setShowSuggest((v) => !v)}>
                            {showSuggest ? '候補を閉じる' : '候補から選ぶ'}
                        </button>
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
                    {showSuggest && (
                        <div className="dot-palette dot-suggest">
                            {suggestions.map((ch) => (
                                <button
                                    key={ch}
                                    className="dot-palette-btn"
                                    onClick={() => {
                                        addPaletteChars(ch);
                                        showToast(`${ch} を追加しました`);
                                    }}
                                >
                                    {ch}
                                </button>
                            ))}
                            {suggestions.length === 0 && (
                                <span className="dot-suggest-empty">候補は全て追加済みです</span>
                            )}
                        </div>
                    )}
                </div>
                )}
            </section>

            <section className="card-inputs">
                <h3 className="section-title">
                    キャンバス（{GRID_COLS} × {grid.length}）
                    {zoomed && <span className="zoom-badge">2倍表示中</span>}
                    <HelpTooltip
                        text={`横はチャット1行に収まる${GRID_COLS}マス固定です。縦は${MAX_ROWS}行まで増やせますが、絵が細かいと途中で長さの上限に達します。スマホでマスが小さいときは「拡大」を押してください（拡大中は2本指で横スクロールできます）。`}
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
                    onPointerDown={(e) => {
                        // キャプチャは解除しない。塗りは座標（elementFromPoint）で追うので
                        // キャプチャがあっても動き、あれば up/cancel が必ずこの要素へ届く。
                        // 以前ここで解除していたせいで、グリッド外で離した指の up を
                        // 取りこぼし「以後ずっと 2 本指扱い」の事故が起きた
                        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                        if (pointersRef.current.size >= 2) {
                            // 2 本目が触れた時点でスクロールへ切り替える
                            paintingRef.current = false;
                            endStroke();
                            // パンのつもりでも 1 本目がセルを塗ってしまっている。
                            // 直後（300ms 以内）ならその 1 マスを元に戻す
                            const s0 = strokeStartRef.current;
                            if (s0 && Date.now() - s0.at < 300) {
                                setCellValue(s0.row, s0.col, s0.prev);
                            }
                            strokeStartRef.current = null;
                            const xs = [...pointersRef.current.values()].map((p) => p.x);
                            panRef.current = {
                                x: xs.reduce((a, b) => a + b, 0) / xs.length,
                                scrollLeft: wrapRef.current?.scrollLeft ?? 0,
                            };
                            return;
                        }
                        const pos = cellAt(e.clientX, e.clientY);
                        if (!pos) return;
                        strokeStartRef.current = {
                            row: pos[0],
                            col: pos[1],
                            prev: useDotStore.getState().grid[pos[0]][pos[1]],
                            at: Date.now(),
                        };
                        paintingRef.current = true;
                        beginStroke(pos[0], pos[1]);
                    }}
                    onPointerMove={(e) => {
                        if (pointersRef.current.has(e.pointerId)) {
                            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                        }
                        if (panRef.current && pointersRef.current.size >= 2) {
                            const xs = [...pointersRef.current.values()].map((p) => p.x);
                            const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
                            if (wrapRef.current) {
                                wrapRef.current.scrollLeft =
                                    panRef.current.scrollLeft - (mid - panRef.current.x);
                            }
                            // scroll イベント頼みにしない（プログラム的な変更では
                            // 発火タイミングが環境依存のため、動かした側が更新する）
                            updateThumb();
                            return;
                        }
                        if (!paintingRef.current) return;
                        const pos = cellAt(e.clientX, e.clientY);
                        if (pos) paint(pos[0], pos[1]);
                    }}
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
                <div className="bulk-actions">
                    <button
                        className={`bulk-btn dot-zoom-btn ${zoomed ? 'active' : ''}`}
                        onClick={toggleZoom}
                    >
                        {zoomed ? '等倍にもどす' : '拡大'}
                    </button>
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
                <button
                    className="secondary-btn"
                    onClick={() => onSendToConverter(text)}
                >
                    テキストで細かく調整する
                </button>
            )}

            <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
        </div>
    );
};
