import { LINE_LIMIT, SPACERS, textWidth, charWidth } from './metrics';
import { simulateWrap, SimLine } from './wrap';

/**
 * 複数行 AA → スペーサー付き 1 行テキスト変換（v0 貪欲法）。
 *
 * 各行の末尾へスペーサーを詰め、次行の先頭文字が幅しきい値を超えて
 * 自動改行されるところまで埋める。詰め込んだスペーサーのうち
 * しきい値を超えた分は次行の行頭インデント（キャリーオーバー）になる。
 *
 * v0 の制約（校正フェーズ後に精密化）:
 * - スペーサーは全角/半角スペースのみ（狭幅記号は入力可否未検証のため不使用）
 * - キャリーオーバーの目標値は「最小」固定（行頭インデント制御は未対応)
 */
export interface ConvertResultLine {
  /** 元の入力行 */
  source: string;
  /** 付与したスペーサー文字列 */
  padding: string;
  /** この行が次行へ持ち越す幅（行頭インデント量） */
  carryOut: number;
  /** スペーサーで埋めきれず折り返し保証ができなかった場合 true */
  underflow: boolean;
}

export interface ConvertResult {
  /** ゲームチャットへ貼る 1 行テキスト */
  output: string;
  lines: ConvertResultLine[];
  /** 出力を折り返しシミュレータへ通した結果（プレビュー用） */
  preview: SimLine[];
  /** 入力行のうち単体でしきい値を超えている行番号（0 始まり） */
  overflowLines: number[];
}

export function convert(input: string, limit: number = LINE_LIMIT): ConvertResult {
  const srcLines = input.replace(/\r\n/g, '\n').split('\n');
  const lines: ConvertResultLine[] = [];
  const overflowLines: number[] = [];

  let carry = 0; // 前行から持ち越された行頭幅
  let output = '';

  srcLines.forEach((src, i) => {
    const isLast = i === srcLines.length - 1;
    const contentW = textWidth(src);
    if (contentW > limit) overflowLines.push(i);

    let padding = '';
    let carryOut = 0;
    let underflow = false;

    if (!isLast) {
      // 次行の先頭文字が入らなくなるまでスペーサーを詰める
      const nextFirst = Array.from(srcLines[i + 1] ?? '')[0];
      const nextW = nextFirst !== undefined ? charWidth(nextFirst) : 1.0;
      let used = carry + contentW;
      // 全角スペース優先で埋め、半角スペースで「次行先頭が入らない」まで詰める
      const [full, half] = SPACERS;
      while (used + full.width + nextW <= limit) {
        padding += full.char;
        used += full.width;
      }
      while (used + nextW <= limit) {
        padding += half.char;
        used += half.width;
      }
      if (used + nextW <= limit) underflow = true;
      carryOut = used > limit ? used - limit : 0;
    }

    lines.push({ source: src, padding, carryOut, underflow });
    output += src + padding;
    carry = carryOut;
  });

  return {
    output,
    lines,
    preview: simulateWrap(output, limit),
    overflowLines,
  };
}
