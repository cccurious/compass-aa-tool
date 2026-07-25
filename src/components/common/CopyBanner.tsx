/**
 * コピー直後に画面上部から降りてくる案内。
 * コピーしただけでは終わりではなく「ゲームのチャット欄に貼って送る」まであるので、
 * 次の一手をここで示す。
 */
export const CopyBanner = ({ show, onClose }: { show: boolean; onClose: () => void }) => (
    <div className={`copy-banner ${show ? 'show' : ''}`}>
        <div className="copy-banner-body">
            <span className="copy-banner-text">
                コピーしました。ゲームのチャット欄に貼り付けて送信してください
            </span>
            <button className="copy-banner-close" onClick={onClose} aria-label="閉じる">
                ×
            </button>
        </div>
    </div>
);
