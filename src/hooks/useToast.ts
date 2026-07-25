import { useCallback, useEffect, useRef, useState } from 'react';

/** トーストの表示時間。ビューごとに食い違わないようここで一元管理する */
const TOAST_DURATION_MS = 2400;

/**
 * 一時的な通知メッセージ。タイマー ID を保持して、連続表示のときに
 * 前のタイマーが後のトーストを早めに消してしまわないようにする。
 */
export function useToast() {
    const [toast, setToast] = useState('');
    const timerRef = useRef<number | null>(null);

    const showToast = useCallback((msg: string) => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        setToast(msg);
        timerRef.current = window.setTimeout(() => {
            setToast('');
            timerRef.current = null;
        }, TOAST_DURATION_MS);
    }, []);

    useEffect(
        () => () => {
            if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        },
        [],
    );

    return { toast, showToast };
}
