import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { AaConverterView } from './components/views/AaConverterView';
import { DotEditorView } from './components/views/DotEditorView';
import { GuideView } from './components/views/GuideView';
import { SupportBanner } from './components/common/SupportBanner';
import { trackView, trackSendToConverter } from './utils/analytics';
import './style.css';

export type ViewId = 'dot' | 'aa' | 'guide';

const VIEW_IDS: ViewId[] = ['dot', 'aa', 'guide'];

/** ?view= でビューを指定できる（共有・ブックマーク用） */
const viewFromUrl = (): ViewId => {
    const v = new URLSearchParams(window.location.search).get('view');
    return VIEW_IDS.includes(v as ViewId) ? (v as ViewId) : 'dot';
};

function App() {
    // ドット打ちがこのツールの目玉なので既定ビューにする
    const [currentView, setCurrentView] = useState<ViewId>(viewFromUrl);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // 変換ビューの入力（ドット打ちからの転送を受けるため App レベルで保持）
    const [aaInput, setAaInput] = useState('');
    // 応援バナーは一度コピーされたらそのセッション中は二度と出さない。
    // 保存はしない（再訪時にはまた出す）＝ BM チェッカーと同じ機構
    const [supportVisible, setSupportVisible] = useState(false);
    const [supportDone, setSupportDone] = useState(false);

    // 戻る/進むでビューが変わるようにする
    useEffect(() => {
        const onPop = () => setCurrentView(viewFromUrl());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    useEffect(() => {
        trackView(currentView);
    }, [currentView]);

    const handleViewChange = (viewId: ViewId) => {
        setCurrentView(viewId);
        setIsMenuOpen(false);
        const url = new URL(window.location.href);
        url.searchParams.set('view', viewId);
        window.history.pushState({}, '', url);
    };

    const handleSendToConverter = (text: string) => {
        setAaInput(text);
        trackSendToConverter({ lines: text.split('\n').length });
        handleViewChange('aa');
    };

    // コピー完了の知らせは各ビューのトーストに任せ、ここでは応援バナーだけ出す
    const handleCopied = () => {
        if (!supportDone) setSupportVisible(true);
    };

    const handleSupportClosed = () => {
        setSupportVisible(false);
        setSupportDone(true);
    };

    return (
        <>
            <header className="header">
                <div className="header-left">
                    <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="logo" />
                    <h1 className="header-title">#AAメーカー</h1>
                </div>
                <button
                    className={`menu-btn ${isMenuOpen ? 'open' : ''}`}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="メニュー"
                >
                    <span></span>
                    <span></span>
                </button>
            </header>

            <SupportBanner visible={supportVisible} onClosePermanently={handleSupportClosed} />

            <Sidebar
                currentView={currentView}
                isOpen={isMenuOpen}
                onViewChange={handleViewChange}
            />
            <div
                className={`menu-overlay ${isMenuOpen ? 'open' : ''}`}
                onClick={() => setIsMenuOpen(false)}
            />

            <main className="main-content">
                <div className={`view-section ${currentView === 'dot' ? 'active' : ''}`}>
                    <DotEditorView
                        onSendToConverter={handleSendToConverter}
                        onCopied={handleCopied}
                    />
                </div>
                <div className={`view-section ${currentView === 'aa' ? 'active' : ''}`}>
                    <AaConverterView
                        input={aaInput}
                        setInput={setAaInput}
                        onCopied={handleCopied}
                    />
                </div>
                <div className={`view-section ${currentView === 'guide' ? 'active' : ''}`}>
                    <GuideView />
                </div>
            </main>
        </>
    );
}

export default App;
