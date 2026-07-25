import React from 'react';
import { ViewId } from '../App';

interface SidebarProps {
    currentView: ViewId;
    isOpen: boolean;
    onViewChange: (viewId: ViewId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, isOpen, onViewChange }) => {
    return (
        <nav className={`side-menu ${isOpen ? 'open' : ''}`} id="side-menu">
            <div className="menu-header">ツール一覧</div>
            <ul>
                <li>
                    <button className={`menu-link ${currentView === 'dot' ? 'active' : ''}`} onClick={() => onViewChange('dot')}>
                        <span className="menu-link-main">ドット打ちエディタ</span>
                        <span className="menu-link-sub">マス目に文字を置いてAAを作る</span>
                    </button>
                </li>
                <li>
                    <button className={`menu-link ${currentView === 'aa' ? 'active' : ''}`} onClick={() => onViewChange('aa')}>
                        <span className="menu-link-main">AA変換</span>
                        <span className="menu-link-sub">貼り付けたAAをチャット用に自動調整</span>
                    </button>
                </li>
            </ul>
            <div className="menu-header" style={{ borderTop: '1px solid var(--border-color)' }}>その他</div>
            <ul>
                <li><a href="https://cccurious.com" className="menu-link" style={{ fontWeight: 'bold' }}>トップページへ戻る</a></li>
                <li><a href="https://x.com/o_0u0_b" className="menu-link" target="_blank" rel="noopener noreferrer">連絡先(X)</a></li>
            </ul>
        </nav>
    );
};
