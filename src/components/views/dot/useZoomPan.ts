import { useRef, useState } from 'react';

/**
 * キャンバスの 2 倍表示とスクロール位置インジケータ。
 * 拡大表示はスマホでマスが小さく狙いにくいための機能で、等倍が既定なので
 * PC は従来どおり。wrapRef を横スクロールコンテナに、thumbRef をインジケータの
 * つまみに割り当てて使う。
 */
export function useZoomPan() {
    const [zoomed, setZoomed] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
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

    return { zoomed, toggleZoom, wrapRef, thumbRef, updateThumb };
}
