import { RefObject, useEffect, useRef } from 'react';
import { useDotStore } from '../../../store/useDotStore';

/**
 * キャンバスの指さばき: 1 本指は描画、2 本指は横スクロール（パン）。
 * ブラウザ任せにすると 1 本指のドラッグがスクロールに取られて塗れなくなるため
 * 自前で捌く。返り値の onPointerDown / onPointerMove をグリッド要素に付ける。
 *
 * @param wrapRef 横スクロールコンテナ（パン対象）
 * @param updateThumb スクロール位置インジケータの更新（パン中は scroll イベント
 *   頼みにせず、動かした側が呼ぶ。プログラム的な scrollLeft 変更では発火
 *   タイミングが環境依存のため）
 */
export function useCanvasGestures(
    wrapRef: RefObject<HTMLDivElement>,
    updateThumb: () => void,
) {
    const { beginStroke, paint, endStroke, setCellValue } = useDotStore();
    const paintingRef = useRef(false);
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

    // ドラッグ塗り: 座標からセルを特定する
    const cellAt = (clientX: number, clientY: number): [number, number] | null => {
        const el = document.elementFromPoint(clientX, clientY);
        const cell = el?.closest('[data-cell]');
        if (!cell) return null;
        const [r, c] = (cell as HTMLElement).dataset.cell!.split(',').map(Number);
        return [r, c];
    };

    const onPointerDown = (e: React.PointerEvent) => {
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
    };

    const onPointerMove = (e: React.PointerEvent) => {
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
            updateThumb();
            return;
        }
        if (!paintingRef.current) return;
        const pos = cellAt(e.clientX, e.clientY);
        if (pos) paint(pos[0], pos[1]);
    };

    return { onPointerDown, onPointerMove };
}
