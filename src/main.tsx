import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// プレビューの見た目を実機フォント仮説（Noto Sans JP）に合わせる
import '@fontsource/noto-sans-jp/400.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
