// Noto Sans JP (400) の Advance Width を抽出し、全角=1.0 単位の幅テーブル JSON を生成する。
// 使い方: node scripts/extract-metrics.mjs
// 出力: src/core/noto-widths.json（幅 1.0 でない文字の例外マップ＋グリフ欠落リスト）
import * as fontkit from 'fontkit';
import { readdirSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const FILES_DIR = 'node_modules/@fontsource/noto-sans-jp/files';
const WEIGHT = '400';

// 対象文字集合: AA・スペーサー候補に関係する範囲
const RANGES = [
  [0x0020, 0x007e], // ASCII
  [0x00a1, 0x00ff], // Latin-1 記号・欧文
  [0x0370, 0x03ff], // ギリシャ（ω 等 AA 頻出）
  [0x0400, 0x045f], // キリル（Д 等 AA 頻出）
  [0x2000, 0x206f], // 各種スペース・句読記号
  [0x2080, 0x2089], // 下付き数字（仕様書の ₁ など）
  [0x2100, 0x23ff], // 技術記号（⌒ U+2312 等）
  [0x2460, 0x25ff], // 囲み数字・罫線・図形
  [0x2600, 0x27bf], // その他記号
  [0x3000, 0x303f], // CJK 記号・句読点（全角スペース含む）
  [0xfe30, 0xfe4f], // CJK 互換形
  [0xff01, 0xff60], // 全角英数記号
  [0xff61, 0xff9f], // 半角カタカナ
];
const EXTRA = 'あいう永愛鬱骨アグ直入（）＜＞∪ω＾';

const targets = new Set();
for (const [lo, hi] of RANGES) {
  for (let cp = lo; cp <= hi; cp++) targets.add(cp);
}
for (const ch of EXTRA) targets.add(ch.codePointAt(0));

// 400 ウェイトの全サブセットを開く（woff2 が読めなければ woff へフォールバック）
const allFiles = readdirSync(FILES_DIR).filter(
  (f) => f.includes(`-${WEIGHT}-normal`),
);
const pick = (ext) => allFiles.filter((f) => f.endsWith(ext));
let fontFiles = pick('.woff2');
let fonts = [];
try {
  fonts = fontFiles.map((f) => fontkit.openSync(path.join(FILES_DIR, f)));
} catch {
  fontFiles = pick('.woff');
  fonts = fontFiles.map((f) => fontkit.openSync(path.join(FILES_DIR, f)));
}
console.log(`loaded ${fonts.length} subset fonts (${fontFiles[0]?.slice(-5)})`);

function advanceEm(cp) {
  for (const font of fonts) {
    if (font.hasGlyphForCodePoint(cp)) {
      const glyph = font.glyphForCodePoint(cp);
      return glyph.advanceWidth / font.unitsPerEm;
    }
  }
  return null;
}

// 正規化基準: 'あ' の幅を 1.0 とする
const base = advanceEm('あ'.codePointAt(0));
if (base === null) throw new Error("base glyph 'あ' not found");
console.log(`base 'あ' = ${base} em`);

const widths = {};
const missing = [];
for (const cp of [...targets].sort((a, b) => a - b)) {
  const em = advanceEm(cp);
  const ch = String.fromCodePoint(cp);
  if (em === null) {
    missing.push(ch);
    continue;
  }
  const w = Math.round((em / base) * 10000) / 10000;
  if (w !== 1.0) widths[ch] = w;
}

const out = {
  font: `Noto Sans JP ${WEIGHT} (fontsource ${fontFiles.length} subsets)`,
  note: '幅は全角(あ)=1.0 単位。widths に無いが ranges 内かつ missing 外の文字は 1.0 実測。missing はグリフ欠落＝フォールバック要注意',
  baseEm: base,
  ranges: RANGES,
  extra: EXTRA,
  widths,
  missing,
};
writeFileSync('src/core/noto-widths.json', JSON.stringify(out, null, 1));
console.log(
  `written: ${Object.keys(widths).length} exceptions, ${missing.length} missing`,
);
// 主要スペーサー候補の幅を表示
for (const ch of [' ', '　', ',', ';', '\\', '.', '|', ' ', ' ']) {
  const cp = ch.codePointAt(0);
  const em = advanceEm(cp);
  console.log(
    `U+${cp.toString(16).padStart(4, '0')} ${JSON.stringify(ch)} -> ${em === null ? 'MISSING' : Math.round((em / base) * 10000) / 10000}`,
  );
}
