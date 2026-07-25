import { useEffect, useRef, useState } from 'react';

/**
 * 「?」を押すと補足を出す。見出しバーの右上に置く前提で、吹き出しも右寄せにする
 * （左右中央だと画面端で切れるため）。外側を触れば閉じる。
 */
export const HelpTooltip = ({ text }: { text: string }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [open]);

    return (
        <span className="help-wrap" ref={wrapRef}>
            <button
                type="button"
                className="help-icon-btn"
                aria-label="説明"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
            >
                ?
            </button>
            {open && <span className="help-bubble">{text}</span>}
        </span>
    );
};
