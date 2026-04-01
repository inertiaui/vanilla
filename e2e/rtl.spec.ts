import { test, expect } from './test'

test.describe('isRtl', () => {
    test('returns false for LTR document', async ({ page }) => {
        await expect(page.locator('#rtl-initial')).toHaveText('false')
    })

    test('returns true after switching to RTL', async ({ page }) => {
        await page.click('#switch-to-rtl')
        await expect(page.locator('#rtl-after-switch')).toHaveText('true')
    })
})

test.describe('onRtlChange', () => {
    test('fires callback when direction changes', async ({ page }) => {
        await page.click('#switch-to-rtl')
        await expect(page.locator('#rtl-callback-value')).toHaveText('true')
    })

    test('stops observing after cleanup', async ({ page }) => {
        await page.click('#cleanup-and-switch')
        await expect(page.locator('#rtl-cleanup')).toHaveText('0')
    })
})
