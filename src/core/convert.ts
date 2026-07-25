import { LIMIT_SAFE, LIMIT_FORCE, textWidth, charWidth } from './metrics';
import { simulateWrap, SimLine } from './wrap';

/**
 * 複数行 AA → スペーサー付き 1 行テキスト変換（v1・実機検証済みモデル）。
 *
 * 実機規則（2026-07-25 ラウンド 2 で確定）:
 * - 折り返し点の半角スペースは行末・次行頭とも消える（痕跡ゼロ）
 * - 全角スペースはキャリーされる＝行頭の字下げは各行の先頭に書けばよい
 *
 * よって各行末に半角スペースを「確実に折れる幅（LIMIT_FORCE）」まで詰めるだけで
 * よく、キャリーオーバー計算は不要。余ったスペースは実機側が消してくれる。
 *
 * 保証条件: 各行のコンテンツ幅が LIMIT_SAFE 以下であること
 * （超えると未確定帯 [SAFE, FORCE) で実機の折り返しが予測不能）。
 */
export interface ConvertResultLine {
  /** 元の入力行 */
  source: string;
  /** 付与したスペーサー文字列 */
  padding: string;
}

export interface ConvertResult {
  /** ゲームチャットへ貼る 1 行テキスト */
  output: string;
  lines: ConvertResultLine[];
  /** 出力を折り返しシミュレータへ通した結果（プレビュー用） */
  preview: SimLine[];
  /** 幅が LIMIT_SAFE を超え、表示保証ができない入力行番号（0 始まり） */
  overflowLines: number[];
  /** 行頭が半角スペースの入力行番号（実機では消えて字下げにならない） */
  leadingSpaceLines: number[];
}

const HALF_SPACE_W = charWidth(' ');

export function convert(input: string): ConvertResult {
  const srcLines = input.replace(/\r\n/g, '\n').split('\n');
  const lines: ConvertResultLine[] = [];
  const overflowLines: number[] = [];
  const leadingSpaceLines: number[] = [];
  let output = '';

  srcLines.forEach((raw, i) => {
    const isLast = i === srcLines.length - 1;
    // 半角スペースのみ（または空）の行は折り返し点で丸ごと消えるため、
    // 全角スペース 1 個の「見た目空行」に置き換えて行を存続させる
    const src = /^ *$/.test(raw) ? '　' : raw;
    if (/^ /.test(src)) leadingSpaceLines.push(i);
    const contentW = textWidth(src);
    if (contentW > LIMIT_SAFE) overflowLines.push(i);

    let padding = '';
    if (!isLast) {
      // 確実に折れる幅（LIMIT_FORCE）に到達するまで半角スペースを詰める。
      // 折り返し点のスペースは実機側で消えるため、詰めすぎの害はない
      const need = Math.max(0, LIMIT_FORCE - contentW);
      const count = Math.ceil(need / HALF_SPACE_W) + 1; // +1 は端数の安全マージン
      padding = ' '.repeat(count);
    }

    lines.push({ source: src, padding });
    output += src + padding;
  });

  return {
    output,
    lines,
    preview: simulateWrap(output),
    overflowLines,
    leadingSpaceLines,
  };
}
