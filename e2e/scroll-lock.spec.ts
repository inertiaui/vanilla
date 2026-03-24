import { test, expect } from './test'

test.describe('lockScroll', () => {
    test('locks body scroll', async ({ page }) => {
        await page.click('#lock-btn')
        await expect(page.locator('#overflow-value')).toHaveText('hidden')
    })

    test('unlocks body scroll', async ({ page }) => {
        await page.click('#lock-btn')
        await expect(page.locator('#overflow-value')).toHaveText('hidden')

        await page.click('#unlock-btn')
        await expect(page.locator('#overflow-value')).toHaveText('')
    })

    test('reference counting with multiple locks', async ({ page }) => {
        await page.click('#lock-btn')
        await page.click('#lock-btn')
        await expect(page.locator('#lock-count')).toHaveText('2')
        await expect(page.locator('#overflow-value')).toHaveText('hidden')

        await page.click('#unlock-btn')
        await expect(page.locator('#overflow-value')).toHaveText('hidden')

        await page.click('#unlock-btn')
        await expect(page.locator('#overflow-value')).toHaveText('')
    })

    test('idempotent cleanup', async ({ page }) => {
        await page.click('#lock-btn')
        await page.click('#lock-btn')

        // Unlock 3 times (third has no cleanup to call)
        await page.click('#unlock-btn')
        await page.click('#unlock-btn')
        await page.click('#unlock-btn')

        await expect(page.locator('#overflow-value')).toHaveText('')
    })

    test('restores original overflow value', async ({ page }) => {
        await page.click('#set-overflow-auto')
        await expect(page.locator('#overflow-value')).toHaveText('auto')

        await page.click('#lock-btn')
        await expect(page.locator('#overflow-value')).toHaveText('hidden')

        await page.click('#unlock-btn')
        await expect(page.locator('#overflow-value')).toHaveText('auto')
    })

    test('manages scrollbar padding', async ({ page }) => {
        await page.click('#lock-btn')
        const padding = await page.locator('#padding-value').textContent()
        // In headless, there may be no scrollbar so padding could be "" or "Npx"
        expect(padding).toMatch(/^(\d+px)?$/)

        await page.click('#unlock-btn')
        await expect(page.locator('#padding-value')).toHaveText('')
    })
})
