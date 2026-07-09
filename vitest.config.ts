import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
        exclude: [...configDefaults.exclude, 'e2e/**'],
    },
})
