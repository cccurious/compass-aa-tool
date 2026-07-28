/**
 * 「端末差の疑いリスト」の生成（確定ロジックの層 2 を 1 ファイルに統合）。
 *
 * 入力:
 *   docs/notes/noto-scan.json … Android 予測（Noto Sans CJK ファイル直読み）
 *   docs/notes/ios-scan.json  … iOS 予測（calibrate-scan.html の実機ブラウザ走査）
 * 出力:
 *   src/core/device-risk.json … どちらかの予測で全角 1.0 に出なかった文字の集合
 *
 * 使い方: node scripts/gen-device-risk.mjs
 *
 * このリストは**確定値ではなく疑い**。層 1（実測テーブル）に載っている文字は
 * 実測が優先されるので、リスト側に混ざっていても無害（metrics.ts 側で除外）。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const noto = JSON.parse(readFileSync('docs/notes/noto-scan.json', 'utf8'));
const ios = JSON.parse(readFileSync('docs/notes/ios-scan.json', 'utf8'));

const android = new Set([
    ...Object.values(noto.deviant).flatMap((s) => Array.from(s)),
    ...Array.from(noto.missing),
]);
const iosSet = new Set(Object.values(ios.deviant).flatMap((s) => Array.from(s)));

const union = [...new Set([...android, ...iosSet])].sort();
const both = union.filter((c) => android.has(c) && iosSet.has(c));

writeFileSync(
    'src/core/device-risk.json',
    JSON.stringify(
        {
            note: '層 2 の予測（疑い）。生成は scripts/gen-device-risk.mjs。実測(層 1)が常に優先',
            sources: { android: 'noto-scan.json', ios: ios.ua },
            chars: union.join(''),
        },
        null,
        1,
    ),
);
console.log(
    `Android 疑い ${android.size} / iOS 疑い ${iosSet.size} / 和集合 ${union.length}（両方 ${both.length}）`,
);
console.log('→ src/core/device-risk.json');
