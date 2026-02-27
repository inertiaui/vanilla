import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
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
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'InertiaUIVanilla',
            formats: ['es'],
            fileName: () => 'index.js',
        },
    },
})
