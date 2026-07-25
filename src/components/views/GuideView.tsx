import { MAX_MESSAGE_BYTES } from '../../core/metrics';
import { GRID_COLS } from '../../core/grid';
import { MAX_ROWS } from '../../store/useDotStore';

/**
 * 使い方と、このツール特有の仕様の説明。
 * 実機の制約（消える文字・バイト上限・半角スペースの扱い）は知らないと必ず詰まるので、
 * 警告文だけに頼らずここへ集約する。
 */
export const GuideView = () => (
    <div>
        <section className="card-inputs">
            <div className="section-title">使い方</div>
            <ol className="guide-list">
                <li>
                    <b>ドット打ちエディタ</b>でマス目をタップして絵を描く。
                    すでに AA がある場合は <b>AA変換</b>にそのまま貼り付ける。
                </li>
                <li>下のプレビューで、ゲーム内での見え方を確認する。</li>
                <li><b>変換テキストをコピー</b>を押す。</li>
                <li>ゲームのチャット欄に貼り付けて送信する。</li>
            </ol>
            <p className="guide-note">
                ゲームのチャットは改行が使えません。このツールは「行の終わりで自動的に
                折り返させる」ための見えない調整を入れることで、複数行に見せています。
            </p>
        </section>

        <section className="card-inputs">
            <div className="section-title">知っておきたい制限</div>
            <dl className="guide-dl">
                <dt>1 メッセージは {MAX_MESSAGE_BYTES} バイトまで</dt>
                <dd>
                    文字数ではなくバイト数の制限です（全角は 3・半角は 1）。
                    そのため全角だけなら約 170 文字、半角を多く含むならもっと入ります。
                    残量はコピーボタンの上に表示しています。
                </dd>

                <dt>1 行は全角 20 文字まで</dt>
                <dd>
                    これを超えると勝手に折り返されて形が崩れます。
                    キャンバスが {GRID_COLS} 列なのはこのためです。
                    行数は最大 {MAX_ROWS} 行ですが、絵の密度によっては
                    途中でバイト上限に達します。
                </dd>

                <dt>ゲーム内で消える文字がある</dt>
                <dd>
                    <code>⇑ ⇓ ✕</code> は送信すると消えます。入力しても自動で取り除き、
                    警告を出します。また <code>ΞΠ</code> と並べると別の文字に置き換わります。
                </dd>

                <dt>字下げには全角スペースを使う</dt>
                <dd>
                    行頭の半角スペースはゲーム内で消えてしまいます。
                    左に余白を作りたいときは全角スペースを使ってください
                    （ドット打ちエディタなら自動でそうなります）。
                </dd>

                <dt>幅が未確認の文字</dt>
                <dd>
                    警告が出た文字は、実機での幅が確認できていないため形が崩れる可能性が
                    あります。パレットの文字と罫線・ブロック・図形類は確認済みです。
                </dd>
            </dl>
        </section>

        <section className="card-inputs">
            <div className="section-title">ドット打ちのコツ</div>
            <ul className="guide-list">
                <li>
                    <b>4分割</b>の文字（<code>▘▝▖▗▚▞▛▜▙▟</code>）を使うと、
                    1 マスを 2×2 の点として扱えるので、実質的な解像度が 2 倍になります。
                </li>
                <li>
                    <b>三角</b>（<code>◤◥◣◢</code>）はマスの角から角まで塗るので、
                    斜めの輪郭が隣のマスと繋がります。
                </li>
                <li>同じ文字のマスをもう一度なぞると消しゴムになります。</li>
                <li>
                    文章を貼り付けて<b>パレットに追加</b>すると、その中の全角文字を
                    パレットに取り込めます（半角は対象外）。
                </li>
            </ul>
        </section>
    </div>
);
