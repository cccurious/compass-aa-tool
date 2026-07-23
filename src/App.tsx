import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { AaConverterView } from './components/views/AaConverterView';
import './style.css';

export type ViewId = 'aa';

const getViewFromUrl = (): ViewId => {
    return 'aa';
};

function App() {
    const [currentView, setCurrentView] = useState<ViewId>(getViewFromUrl());
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleViewChange = (viewId: ViewId) => {
        setCurrentView(viewId);
        setIsMenuOpen(false);
    };

    return (
        <>
            <header className="header">
                <div className="header-left">
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
                    <AaConverterView />
                </div>
            </main>
        </>
    );
}

export default App;
