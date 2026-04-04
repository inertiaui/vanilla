import { resolve } from 'path'
import { defineConfig } from 'vite-plus'
import dts from 'vite-plugin-dts'

export default defineConfig({
    staged: {
        '*': 'vp check --fix',
    },
    lint: {
        plugins: ['oxc', 'typescript', 'unicorn'],
        categories: {
            correctness: 'warn',
        },
        env: {
            builtin: true,
        },
        ignorePatterns: ['dist/**/*', 'node_modules/**/*'],
        overrides: [
            {
                files: ['src/**/*.ts'],
                rules: {
                    'no-array-constructor': 'error',
                    'no-unused-expressions': 'error',
                    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
                    'typescript/ban-ts-comment': 'error',
                    'typescript/no-duplicate-enum-values': 'error',
                    'typescript/no-empty-object-type': 'error',
                    'typescript/no-explicit-any': 'warn',
                    'typescript/no-extra-non-null-assertion': 'error',
                    'typescript/no-misused-new': 'error',
                    'typescript/no-namespace': 'error',
                    'typescript/no-non-null-asserted-optional-chain': 'error',
                    'typescript/no-require-imports': 'error',
                    'typescript/no-this-alias': 'error',
                    'typescript/no-unnecessary-type-constraint': 'error',
                    'typescript/no-unsafe-declaration-merging': 'error',
                    'typescript/no-unsafe-function-type': 'error',
                    'typescript/no-wrapper-object-types': 'error',
                    'typescript/prefer-as-const': 'error',
                    'typescript/prefer-namespace-keyword': 'error',
                    'typescript/triple-slash-reference': 'error',
                    'typescript/explicit-function-return-type': 'off',
                },
            },
        ],
        options: {
            typeAware: true,
            typeCheck: true,
        },
    },
    fmt: {
        tabWidth: 4,
        useTabs: false,
        semi: false,
        singleQuote: true,
        trailingComma: 'all',
        printWidth: 120,
        sortPackageJson: false,
    },
    test: {
        globals: true,
        environment: 'happy-dom',
    },
    plugins: [
        dts({
            insertTypesEntry: true,
            rollupTypes: true,
            include: ['src/**/*.ts'],
        }),
    ],
    build: {
        minify: false,
        lib: {
            entry: resolve(import.meta.dirname, 'src/index.ts'),
            name: 'InertiaUIVanilla',
            formats: ['es'],
            fileName: () => 'index.js',
        },
    },
})
