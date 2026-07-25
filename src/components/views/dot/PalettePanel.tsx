import { useMemo, useState } from 'react';
import { useDotStore } from '../../../store/useDotStore';
import { PALETTE_CATEGORIES, PRESET_PALETTE, SUGGEST_CHARS } from '../../../core/palette';
import { HelpTooltip } from '../../common/HelpTooltip';
import { trackPaletteAdd } from '../../../utils/analytics';

interface PalettePanelProps {
    /** トースト表示は親が 1 か所で持つ（コピー通知と同じ場所に出すため） */
    showToast: (msg: string) => void;
}

/** パレット一式: カテゴリタブ・文字ボタン・「追加分」への文字追加 UI */
export const PalettePanel = ({ showToast }: PalettePanelProps) => {
    const { customPalette, recentChars, brush, setBrush, addPaletteChars, clearCustom } =
        useDotStore();
    const [charInput, setCharInput] = useState('');
    const [showSuggest, setShowSuggest] = useState(false);
    const [category, setCategory] = useState(PALETTE_CATEGORIES[0].id);

    // 最近使った文字を先頭に。「追加分」は空でも常に出す
    // （タブを開くと追加用の UI が現れる、という入口を兼ねるため）
    const tabs = [
        ...(recentChars.length > 0 ? [{ id: 'recent', label: '最近', chars: recentChars }] : []),
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

    return (
        <section className="card-inputs">
            <h3 className="section-title">
                パレット
                <HelpTooltip text="マス目に置く文字を選びます。三角（◤◥◣◢）はマスの角から角まで塗るので斜めの輪郭が隣と繋がります。一度使った文字は「最近」タブに残るので、そこから選び直せます。" />
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
                        <button className="bulk-btn" onClick={handleAddChars}>
                            追加
                        </button>
                        <button className="bulk-btn" onClick={() => setShowSuggest((v) => !v)}>
                            {showSuggest ? '候補を閉じる' : '候補から選ぶ'}
                        </button>
                        {customPalette.length > 0 && (
                            <button className="bulk-btn" onClick={clearCustom}>
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
    );
};
