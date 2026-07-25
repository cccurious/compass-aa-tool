import { useCallback } from 'react';
import { ConvertResult } from '../core/convert';
import { MESSAGE_UNIT_LIMIT, messageUnits, utf8ByteLength } from '../core/metrics';
import { trackCopy } from '../utils/analytics';

/**
 * 変換結果をクリップボードへコピーする（計測・通知込み）。
 * ドット打ちと AA 変換でまったく同じ手順なので 1 箇所に集約する
 * （分かれていた頃、トーストの表示時間や計測パラメータが黙ってずれた）。
 */
export function useCopyResult(
    source: 'dot' | 'aa',
    showToast: (msg: string) => void,
    onCopied: () => void,
) {
    return useCallback(
        async (result: ConvertResult) => {
            try {
                await navigator.clipboard.writeText(result.output);
                const bytes = utf8ByteLength(result.output);
                trackCopy({
                    source,
                    bytes,
                    lines: result.preview.length,
                    over_limit: messageUnits(result.output) > MESSAGE_UNIT_LIMIT,
                    had_removed_chars: result.removedLines.length > 0,
                    had_unknown_width: result.unknownWidthLines.length > 0,
                });
                showToast('コピーしました');
                onCopied();
            } catch {
                showToast('コピーできませんでした。もう一度お試しください');
            }
        },
        [source, showToast, onCopied],
    );
}
