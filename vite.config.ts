import { defineConfig, lazyPlugins } from 'vite-plus';

const ignorePatterns = [
    '**/build/**',
    '**/coverage/**',
    '**/dist/**',
    '**/snap/**',
    '**/vite.config.*.timestamp-*.*',
    'drizzle/**',
    'src/routeTree.gen.ts',
];

export default defineConfig(({ mode }) => ({
    resolve: {
        tsconfigPaths: true,
    },
    fmt: {
        semi: true,
        singleQuote: true,
        printWidth: 80,
        tabWidth: 4,
        ignorePatterns,
    },
    lint: {
        plugins: ['import', 'typescript'],
        categories: { correctness: 'off' },
        env: { builtin: true },
        ignorePatterns,
        rules: {
            'vite-plus/prefer-vite-plus-imports': 'error',
        },
        overrides: [
            {
                files: ['**/*.{js,ts,tsx}'],
                rules: {
                    'for-direction': 'error',
                    'no-async-promise-executor': 'error',
                    'no-case-declarations': 'error',
                    'no-class-assign': 'error',
                    'no-compare-neg-zero': 'error',
                    'no-cond-assign': 'error',
                    'no-constant-binary-expression': 'error',
                    'no-constant-condition': 'error',
                    'no-control-regex': 'error',
                    'no-debugger': 'error',
                    'no-delete-var': 'error',
                    'no-dupe-else-if': 'error',
                    'no-duplicate-case': 'error',
                    'no-empty-character-class': 'error',
                    'no-empty-pattern': 'error',
                    'no-empty-static-block': 'error',
                    'no-ex-assign': 'error',
                    'no-extra-boolean-cast': 'error',
                    'no-fallthrough': 'error',
                    'no-global-assign': 'error',
                    'no-invalid-regexp': 'error',
                    'no-irregular-whitespace': 'error',
                    'no-loss-of-precision': 'error',
                    'no-misleading-character-class': 'error',
                    'no-nonoctal-decimal-escape': 'error',
                    'no-regex-spaces': 'error',
                    'no-self-assign': 'error',
                    'no-shadow': 'warn',
                    'no-shadow-restricted-names': 'error',
                    'no-sparse-arrays': 'error',
                    'no-unsafe-finally': 'error',
                    'no-unsafe-optional-chaining': 'error',
                    'no-unused-labels': 'error',
                    'no-unused-private-class-members': 'error',
                    'no-useless-backreference': 'error',
                    'no-useless-catch': 'error',
                    'no-useless-escape': 'error',
                    'no-var': 'error',
                    'no-with': 'error',
                    'prefer-const': 'error',
                    'require-yield': 'error',
                    'use-isnan': 'error',
                    'valid-typeof': 'error',
                    'import/consistent-type-specifier-style': [
                        'error',
                        'prefer-top-level',
                    ],
                    'import/first': 'error',
                    'import/no-commonjs': 'error',
                    'import/no-duplicates': 'error',
                },
                env: { es2020: true, browser: true },
            },
        ],
        options: {
            typeAware: true,
            typeCheck: true,
        },
        jsPlugins: [
            { name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' },
        ],
    },
    plugins: lazyPlugins(async () => {
        if (mode === 'test') return [];
        return await Promise.all([
            import('@tanstack/devtools-vite').then((v) => v.devtools()),
            import('@tanstack/react-start/plugin/vite').then((v) =>
                v.tanstackStart(),
            ),
            import('@vitejs/plugin-react').then((v) => v.default()),
            import('@tailwindcss/vite').then((v) => v.default()),
            import('nitro/vite').then((v) => v.nitro()),
        ]);
    }),
}));
