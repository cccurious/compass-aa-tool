import { useEffect, useRef, useState } from 'react';
import { trackSupportAction } from '../../utils/analytics';

/**
 * ゲーム内の「応援」機能の応援コードを案内するバナー。
 * BM チェッカーと同じ機構をそのまま使う（文言・コード・3 秒ごとの入れ替え・
 * 「コピー / 閉じる」で永久に閉じる）。変えるとツール間で挙動が食い違うため、
 * 見た目と手順は流用元に合わせること。
 */
const SUPPORT_CODE = 'C-VtNQ';

interface SupportBannerProps {
    visible: boolean;
    onClosePermanently: () => void;
}

export const SupportBanner = ({ visible, onClosePermanently }: SupportBannerProps) => {
    const [toastVisible, setToastVisible] = useState(false);
    const [showingMsg, setShowingMsg] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (visible) setShowingMsg(true);
    }, [visible]);

    // 表示中だけ 3 秒ごとに文言とコードを入れ替える
    useEffect(() => {
        if (!visible) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }
        intervalRef.current = setInterval(() => setShowingMsg((prev) => !prev), 3000);
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [visible]);

    const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        e.preventDefault();
        trackSupportAction({ action_type: 'copy_code' });
        navigator.clipboard
            .writeText(SUPPORT_CODE)
            .then(() => {
                setToastVisible(true);
                setTimeout(() => setToastVisible(false), 2000);
                onClosePermanently();
            })
            .catch(() => {
                onClosePermanently();
            });
    };

    return (
        <>
            <div className={`support-banner ${visible ? 'show' : ''}`}>
                <div className="banner-content">
                    <div className="banner-text-wrapper">
                        <span
                            className={`code-text msg-text ${showingMsg ? 'slide-in' : 'slide-out'}`}
                        >
                            応援枠が余っていれば是非！
                        </span>
                        <span
                            className={`code-text target-text ${!showingMsg ? 'slide-in' : 'slide-out'}`}
                        >
                            応援コード {SUPPORT_CODE}
                        </span>
                    </div>
                    <button className="copy-btn" onClick={handleCopy}>
                        コピー / 閉じる
                    </button>
                </div>
            </div>

            <div className={`toast ${toastVisible ? 'show' : 'hidden'}`}>Thank you!</div>
        </>
    );
};
