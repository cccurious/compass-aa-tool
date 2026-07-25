// 実機測定値（j≈0.39・´=1.0 等）と候補フォントの Advance Width を照合し、
// ゲームフォントを特定する。使い方: node scripts/identify-font.mjs
import * as fontkit from 'fontkit';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const CANDIDATES = [
  'noto-sans-jp',
  'm-plus-1p',
  'm-plus-rounded-1c',
  'kosugi',
  'kosugi-maru',
  'zen-maru-gothic',
  'zen-kaku-gothic-new',
  'biz-udpgothic',
  'biz-udgothic',
  'ibm-plex-sans-jp',
  'm-plus-2',
  'sawarabi-gothic',
];

// 実機実測（2026-07-25 R5 プローブ）: 全角=1.0 単位
const MEASURED = { j: 0.39, '´': 1.0 };
// 参考表示用（未実測だが螢幕に頻出）
const SHOW = ['j', '´', 'r', 'y', 'O', "'", 'a', '1', '.', ',', ' ', '|', '_'];

for (const pkg of CANDIDATES) {
  const dir = `node_modules/@fontsource/${pkg}/files`;
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.includes('-400-normal') && f.endsWith('.woff2'));
  } catch {
    console.log(pkg, ': not installed');
    continue;
  }
  const fonts = files.map((f) => fontkit.openSync(path.join(dir, f)));
  const adv = (ch) => {
    const cp = ch.codePointAt(0);
    for (const font of fonts) {
      if (font.hasGlyphForCodePoint(cp)) {
        return font.glyphForCodePoint(cp).advanceWidth / font.unitsPerEm;
      }
    }
    return null;
  };
  const base = adv('あ');
  if (!base) { console.log(pkg, ': no あ'); continue; }
  const widths = {};
  for (const ch of SHOW) {
    const a = adv(ch);
    widths[ch] = a === null ? 'MISS' : Math.round((a / base) * 1000) / 1000;
  }
  // 照合スコア: 実測との差の合計
  let score = 0;
  for (const [ch, m] of Object.entries(MEASURED)) {
    const w = widths[ch];
    score += typeof w === 'number' ? Math.abs(w - m) : 9;
  }
  console.log(pkg.padEnd(22), 'score', score.toFixed(3), JSON.stringify(widths));
}
