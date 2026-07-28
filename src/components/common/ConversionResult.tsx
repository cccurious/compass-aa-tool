import { ConvertResult } from '../../core/convert';
import { LINE_LIMIT, charWidth } from '../../core/metrics';
import {
    LIMIT_CHARS,
    LIMIT_WIDTH,
    isOverLimit,
    messageCost,
    overBy,
    remainingFullWidth,
} from '../../core/limit';
import { HelpTooltip } from './HelpTooltip';

/**
 * 幅テーブル駆動の 1 行レンダリング。
 * 各文字を実機の実測幅のボックスに入れて並べるため、ブラウザ側のフォントが
 * 何であっても文字の累積位置＝実機表示と一致する（フォント差によるずれを排除）。
 */
const ChatLine = ({ text }: { text: string }) => (
    <div className="chat-line">
        {Array.from(text).map((ch, i) => (
            <span key={i} className="chat-ch" style={{ width: `${charWidth(ch)}em` }}>
                {ch}
            </span>
        ))}
        {text === '' && ' '}
    </div>
);

interface ConversionResultProps {
    result: ConvertResult;
    onCopy: () => void;
    /** 見出し（既定「チャット表示プレビュー」） */
    title?: string;
    /** 「正しく表示できない文字」警告の直下に出す操作（置き換えボタン等） */
    substituteActions?: React.ReactNode;
}

/** 表示幅は実測値の合計なので端数が出る。表示は小数第 1 位まで */
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 変換結果の総合判定。警告が 1 つも出ないとき「問題なし」を明示するのが主目的
 * （無言では、安心してよいのか判断材料が無いままコピーさせることになる）。
 * 文言は「開発環境の実機で確認した」という事実ベースに留め、
 * あらゆる端末での見え方は保証しない（フォントは端末・OS 版に依存するため）。
 */
const verdictOf = (result: ConvertResult) => {
    const errors =
        result.removedLines.length +
        result.deviceVariantLines.length +
        result.filteredSequenceLines.length +
        result.overflowLines.length +
        result.leadingSpaceLines.length;
    if (errors > 0) {
        return {
            cls: 'error',
            icon: '❌',
            text: 'そのままでは崩れる箇所があります（下の警告を確認してください）',
        };
    }
    const cautions =
        result.unknownRiskLines.length +
        result.unknownWidthLines.length +
        result.deviceWrapRiskLines.length;
    if (cautions > 0) {
        return {
            cls: 'caution',
            icon: '⚠️',
            text: '実機で未確認の文字が含まれています（下の警告を確認してください）',
        };
    }
    return {
        cls: 'ok',
        icon: '✅',
        text: '実機で表示を確認できた文字だけでできています',
    };
};

/** プレビュー・警告・文字数カウンタ・コピーボタン（貼り付け／ドット打ち共通） */
export const ConversionResult = ({
    result,
    onCopy,
    title,
    substituteActions,
}: ConversionResultProps) => {
    // 実機の上限は 3 本立て（core/limit.ts の v6 モデル）:
    //   A: 長さ 196（改行を起こす半角スペースだけ 6.75）／ B: 幅換算 184 ／ C: 文字数 196
    const cost = messageCost(result.output);
    const over = isOverLimit(cost);
    const remain = remainingFullWidth(cost);
    // 超過時は「どの上限に当たったか」を添える（何を減らせばよいか分かるように）
    const overHint = !over
        ? ''
        : cost.chars > LIMIT_CHARS
          ? `（文字数 ${cost.chars} / ${LIMIT_CHARS}）`
          : cost.width > LIMIT_WIDTH
            ? `（表示幅 ${round1(cost.width)} / ${LIMIT_WIDTH}）`
            : cost.breakSpaces > 0
              ? `（行の折り返し ${cost.breakSpaces} か所で全角 ${cost.breakSpaces * 6} 文字ぶんを消費）`
              : '';
    return (
        <>
            <section className="card-inputs">
                <h3 className="section-title">
                    {title ?? 'チャット表示プレビュー'}
                    <HelpTooltip text="ゲーム内での見え方を再現しています。緑の枠がチャット1行ぶんの幅（全角20文字）で、ここを超えると自動で折り返されます。" />
                </h3>
                <div className="chat-bubble">
                    {/* 実機 1 行ぶんの幅（全角 20.5 字）を持つ枠。これを中央に置くことで
                        吹き出し内の左右位置まで実機と同じ見え方になる */}
                    <div className="chat-canvas">
                        {result.preview.map((line, i) => (
                            <ChatLine key={i} text={line.text} />
                        ))}
                    </div>
                </div>
                {(() => {
                    const v = verdictOf(result);
                    return (
                        <div className={`verdict-note ${v.cls}`}>
                            {v.icon} {v.text}
                            {v.cls === 'ok' && (
                                <HelpTooltip text="開発環境の iPhone / Android の実機で 1 文字ずつ表示を確認した文字だけで構成されています。端末や OS のバージョンによってフォントが変わる可能性までは保証できませんが、既知の崩れる要因はありません。" />
                            )}
                        </div>
                    );
                })()}
                {result.overflowLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ {result.overflowLines.map((n) => n + 1).join(', ')} 行目が 1 行の上限
                        （全角約 {Math.floor(LINE_LIMIT)}{' '}
                        文字）を超えています。行を短くしてください。
                    </div>
                )}
                {result.removedLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ ゲーム内で消えてしまう文字を取り除きました（
                        {result.removedLines
                            .map((u) => `${u.line + 1}行目: ${u.chars.join(' ')}`)
                            .join(' ／ ')}
                        ）。別の文字に置き換えてください。
                    </div>
                )}
                {result.filteredSequenceLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ ゲーム内で別の文字に変わってしまう並びがあります（
                        {result.filteredSequenceLines
                            .map((u) => `${u.line + 1}行目: ${u.sequences.join(' ')}`)
                            .join(' ／ ')}
                        ）。間に別の文字を挟むか、並び順を変えてください。
                    </div>
                )}
                {result.deviceVariantLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ ゲーム内で正しく表示できない文字が含まれています（
                        {result.deviceVariantLines
                            .map((u) => `${u.line + 1}行目: ${u.chars.join(' ')}`)
                            .join(' ／ ')}
                        ）。半分の幅になる・表示されないなどの理由で形が崩れます。 iOS と Android
                        で結果が違うものもあるため、
                        自分の端末で正常に見えても相手の端末では崩れることがあります。
                        {substituteActions}
                    </div>
                )}
                {result.deviceWrapRiskLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ {result.deviceWrapRiskLines.map((n) => n + 1).join(', ')} 行目は
                        半角文字が多く幅が上限ぎりぎりです。半角文字の幅は端末によって
                        わずかに違うため、別の端末では折り返されて形が崩れることがあります。
                        少し短くすると安全です。
                    </div>
                )}
                {result.unknownRiskLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ 端末によって幅が違う疑いのある文字が含まれています（
                        {result.unknownRiskLines
                            .map((u) => `${u.line + 1}行目: ${u.chars.join(' ')}`)
                            .join(' ／ ')}
                        ）。実機での確認は取れていませんが、フォントの調査では iOS と Android
                        で違う幅になる兆候が出ており、形が崩れる可能性が高めです。
                    </div>
                )}
                {result.unknownWidthLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ ゲーム内での幅が未確認の文字が含まれています（
                        {result.unknownWidthLines
                            .map((u) => `${u.line + 1}行目: ${u.chars.join(' ')}`)
                            .join(' ／ ')}
                        ）。端末差の兆候は出ていませんが、実機では未確認のため
                        形が崩れる可能性があります。
                    </div>
                )}
                {result.leadingSpaceLines.length > 0 && (
                    <div className="warn-note">
                        ⚠️ {result.leadingSpaceLines.map((n) => n + 1).join(', ')} 行目の行頭に
                        半角スペースがあります。ゲーム内では消えてしまうので、
                        字下げには全角スペースを使ってください。
                    </div>
                )}
            </section>

            <div className={`char-count ${over ? 'over' : ''}`}>
                {over
                    ? `上限超過 — 全角 ${overBy(cost)} 文字ぶん減らしてください${overHint}`
                    : `残り 全角 ${remain} 文字ぶん（表示幅 ${round1(cost.width)} / ${LIMIT_WIDTH}）`}
                <HelpTooltip
                    text={`ゲーム側の上限は 3 つあります。①全角換算 ${LIMIT_WIDTH} 文字ぶん ②文字数 196 字 ③長さ 196 文字ぶん（行の折り返しが 1 回起きるたびに全角 6 文字ぶん余分にかかります）。どれかを超えると送信時に末尾が切り捨てられます。カウンタの残りは一番厳しい上限の値です。`}
                />
            </div>
            <button className="primary-btn" onClick={onCopy}>
                ゲーム用のテキストをコピー
            </button>
        </>
    );
};
