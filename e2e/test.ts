import { test as base } from '@playwright/test'
import path from 'path'

// Custom fixture that navigates to the matching HTML page before each test.
// e2e/click-outside.spec.ts → /e2e/pages/click-outside.html
export const test = base.extend({
    page: async ({ page }, use, testInfo) => {
        const specName = path.basename(testInfo.file, '.spec.ts')
        await page.goto(`/e2e/pages/${specName}.html`)
        await use(page)
    },
})

export { expect } from '@playwright/test'
