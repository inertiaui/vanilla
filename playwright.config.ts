import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    use: {
        baseURL: 'http://localhost:3333',
    },
    webServer: {
        command: 'vp dev --port 3333',
        port: 3333,
        reuseExistingServer: !process.env.CI,
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
})
