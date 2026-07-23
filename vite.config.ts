import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages のサブパス配信に対応するため相対 base
export default defineConfig({
  base: './',
  plugins: [react()],
})
