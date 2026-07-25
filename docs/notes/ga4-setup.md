# GA4 の設定手引き（BM チェッカーとは別プロパティ）

同じ Google アナリティクスのアカウント内に、このツール専用のプロパティを作る。
BM チェッカーと分けるのは、指標（コピー数・使われる作り方）が全く別物のため。

## 1. プロパティを作る

1. https://analytics.google.com/ を開く。
2. 左下の歯車（管理）→ 「プロパティを作成」。
3. プロパティ名: `AAメーカー`（BM チェッカーと並べたとき区別できる名前）。
4. タイムゾーンと通貨: 日本。
5. 業種・規模は適当で可（後から変えられる）。

## 2. データストリームを作る

1. 作成直後の画面、または 管理 → データストリーム → 「ストリームを追加」→ ウェブ。
2. ウェブサイトの URL: 公開先（例 `https://<ユーザー名>.github.io/compass-aa-tool/`）。
3. ストリーム名: `AAメーカー（GitHub Pages）`。
4. 作成すると **測定 ID**（`G-` で始まる 10 桁程度の文字列）が表示される。これを使う。

## 3. ツールへ設定する

`index.html` の 2 箇所ある `G-XXXXXXXXXX` を、取得した測定 ID に置き換えるだけ。

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
...
gtag('config', 'G-XXXXXXXXXX', { send_page_view: false });
```

`send_page_view: false` は意図的。SPA なのでビュー切替を自動計測できず、
`src/utils/analytics.ts` の `trackView()` から手動で送っている。

## 4. 動作確認

1. `npm run dev` で開く（測定 ID を入れた状態で）。
2. GA4 の 管理 → DebugView、またはレポート → リアルタイム を開く。
3. ビューを切り替える・コピーするとイベントが流れてくる。
   （広告ブロッカーが有効だと送信されないので、確認時は無効化する）

## 送っているイベント

| イベント | 送信タイミング | パラメータ |
|---|---|---|
| `page_view` | ビュー切替（手動送信） | `page_title` = dot / aa / guide |
| `copy_aa` | コピー成功時（このツールの完了地点） | `source`（dot/aa）・`bytes`・`lines`・`over_limit` |
| `send_to_converter` | ドット打ちから AA 変換へ送ったとき | `lines` |
| `palette_add` | パレットへ文字を追加したとき | `added`・`skipped` |
| `blocked_chars` | 実機で消える文字・置換される並びを入力したとき | `kind`・`chars` |

`copy_aa` の `source` で「ドット打ちと貼り付け、どちらが使われているか」、
`over_limit` で「上限に引っかかる人がどれくらいいるか」が分かる。

## 注意

- 測定 ID は公開リポジトリに入っても問題ない（クライアント側で丸見えの前提の値）。
- 計測を止めたいときは `index.html` の gtag スニペット 2 つを消せばよい。
  `analytics.ts` は gtag が無ければ黙って何もしないので、コード側の変更は不要。
