import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['dist', 'scripts'] },
    {
        files: ['**/*.{ts,tsx}'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: {
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            // ビューは名前付き export で統一しているため（default export 不使用）
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            // 全角スペース（U+3000）はこのツールの主役データ。テストの期待値や
            // コメント内の作例に必ず出てくるため、文字列類とコメントでは許可する
            'no-irregular-whitespace': [
                'error',
                { skipStrings: true, skipTemplates: true, skipComments: true },
            ],
        },
    },
    {
        // BM チェッカーから機構ごと移植したファイル。挙動を変えない約束のため
        // リント都合の書き換えをしない（詳細は docs/notes/base-diff-audit.md）
        files: ['src/components/common/SupportBanner.tsx'],
        rules: {
            'react-hooks/set-state-in-effect': 'off',
        },
    },
);
