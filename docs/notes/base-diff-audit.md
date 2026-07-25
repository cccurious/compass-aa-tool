# ベース（draw-need-bm-react）との差分監査（2026-07-25）

BM チェッカーを土台に UI を流用したが、以後 AA ツールとして独自に育ったため、
**ベースにあって当ツールに無いもの**を洗い出した。分類は
A（今の形だと実害あり）/ B（あった方がよい）/ C（意図的に入れない）。

## A. 今の形だといけない部分

| # | 項目 | 実害 |
|---|---|---|
| A1 | **apple-touch-icon が SVG** | iOS はホーム画面追加時に SVG を読まない。スマホ優先ツールなのにアイコンが出ない。PNG（180px）が必要 |
| A2 | **OGP / Twitter カードが無い** | X や Discord に URL を貼っても題名も画像も出ない。ベースは og:* と twitter:* を完備し ogp.png を用意 |
| A3 | **favicon.ico が無い** | SVG favicon 非対応環境でタブアイコンが出ない |
| A4 | **canonical / JSON-LD が無い** | 検索での取り扱いが弱くなる（ベースは両方あり） |
| A5 | **title / description が「AA自動変換ツール」のまま** | 実態はドット打ちが主役。今の説明は貼り付け変換しか言っていない |
| A6 | **サイドバーがベースの流用のまま** | 「トップページへ戻る」「連絡先(X)」だけで、**使い方への導線が無い**。実機で消える文字・512 バイト上限・コピー手順など、知らないと詰まる仕様がある |

## B. 追加していない部分（あった方がよい）

| # | 項目 | 価値 |
|---|---|---|
| B1 | アナリティクス（GA4 + SPA の手動 page_view + イベント） | どの機能が使われているか分かる。ベースは `utils/analytics.ts` で計測を集約 |
| B2 | 共有画像生成（html-to-image + ShareCardRenderer + ShareModal） | 作った AA を画像で共有できる。AA ツールとの相性は良い |
| B3 | SupportBanner（note 誘導バナー） | ベースにある認知・支援導線 |
| B4 | HelpTooltip（? アイコン） | 用語や仕様の補足。今は警告文だけで説明している |
| B5 | BottomSheet / AlertModal / Accordion | 「使い方」表示などに使える既製部品 |
| B6 | UIContext（トースト・モーダルの共通管理） | 現在は各ビューが独自に toast state を持ち重複している |
| B7 | ESLint 設定 | ベースにはある。品質ゲートとして有効 |
| B8 | `?view=` の URL パラメータ | ビューを URL で指定でき、共有・ブックマークができる（当ツールでは削除済み） |

## C. 意図的に入れないもの

- `jimp` / `sharp` / `html2canvas` とビルド用スクリプト（`gendot.cjs` 等）
- ガチャ計算ロジック（`utils/luck.ts` `simulation.ts` `format.ts`）と関連 UI
  （ColorModal・FormulaModal・CardGridSection・カード画像アセット）
- `contexts` 以下のガチャ専用状態（`useGachaStore` `useCollabStore`）

## 対応順の提案

1. **A1〜A5**（公開前に必須）: アイコン PNG 生成・OGP 一式・文言更新。
   PNG 生成には `sharp` を devDependency で入れて `scripts/` から SVG → PNG 変換するのが最短。
2. **A6 ＋ B4/B5**: 「使い方」画面（実機で消える文字・512 バイト上限・コピー手順・
   ドット打ちの使い方）。ツールの仕様が独特なので、ここが最も効く。
3. **B1**（計測）→ **B8**（URL パラメータ）→ **B2**（共有画像）の順で余力に応じて。
