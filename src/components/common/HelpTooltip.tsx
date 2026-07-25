import { useEffect, useRef, useState } from 'react';

/**
 * 「?」アイコンを押すと補足を出す。画面外へはみ出さないよう位置を寄せる。
 * ツールの仕様（実機で消える文字・バイト上限など）は説明しないと詰まるため、
 * 各セクションの見出し横に置いて使う。
 */
export const HelpTooltip = ({ text }: { text: string }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLSpanElement>(null);
    const [shiftX, setShiftX] = useState(0);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [open]);

    useEffect(() => {
        if (!open || !wrapRef.current) return;
        const bubble = wrapRef.current.querySelector('.help-bubble');
        if (!bubble) return;
        const r = bubble.getBoundingClientRect();
        const margin = 8;
        if (r.left < margin) setShiftX(margin - r.left);
        else if (r.right > window.innerWidth - margin) setShiftX(window.innerWidth - margin - r.right);
    }, [open]);

    return (
        <span className="help-wrap" ref={wrapRef}>
            <button
                type="button"
                className="help-icon-btn"
                aria-label="説明"
                onClick={(e) => {
                    e.stopPropagation();
                    setShiftX(0);
                    setOpen((v) => !v);
                }}
            >
                ?
            </button>
            {open && (
                <span className="help-bubble" style={{ transform: `translateX(calc(-50% + ${shiftX}px))` }}>
                    {text}
                </span>
            )}
        </span>
    );
};
