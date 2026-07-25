# #AAメーカー — #コンパス チャットAA自動変換ツール

『#コンパス』のゲーム内チャット（改行不可・自動折り返しのみ）で崩れない
アスキーアートを作るためのツール。作りたい形の AA を貼り付けると、
自動改行で形が再現されるようスペーサーを自動挿入した 1 行テキストを生成する。

- 公開: https://cccurious.com/compass-aa-tool/ （GitHub Pages・main へ push で自動デプロイ）
- 技術: Vite + React 18 + TypeScript（完全静的）

## 開発

```
npm install
npm run dev
npm test
```

仕様と開発ルールは `CLAUDE.md` / `docs/spec.md` を参照。
