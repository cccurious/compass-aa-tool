import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { AaConverterView } from './components/views/AaConverterView';
import { DotEditorView } from './components/views/DotEditorView';
import './style.css';

export type ViewId = 'aa' | 'dot';

function App() {
    const [currentView, setCurrentView] = useState<ViewId>('aa');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // 変換ビューの入力（ドット打ちからの転送を受けるため App レベルで保持）
    const [aaInput, setAaInput] = useState('');

    const handleViewChange = (viewId: ViewId) => {
        setCurrentView(viewId);
        setIsMenuOpen(false);
    };

    const handleSendToConverter = (text: string) => {
        setAaInput(text);
        setCurrentView('aa');
    };

    return (
        <>
            <header className="header">
                <div className="header-left">
                    <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="logo" />
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
                <div className={`view-section ${currentView === 'aa' ? 'active' : ''}`}>
                    <AaConverterView input={aaInput} setInput={setAaInput} />
                </div>
                <div className={`view-section ${currentView === 'dot' ? 'active' : ''}`}>
                    <DotEditorView onSendToConverter={handleSendToConverter} />
                </div>
            </main>
        </>
    );
}

export default App;
