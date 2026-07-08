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

    test('uses native scrollbar gutter when supported', async ({ page }) => {
        const supportsScrollbarGutter = await page.evaluate(() => CSS.supports('scrollbar-gutter: stable'))

        await page.click('#lock-btn')

        if (supportsScrollbarGutter) {
            await expect(page.locator('#scrollbar-gutter-value')).toHaveText('stable')
        } else {
            await expect(page.locator('#scrollbar-gutter-value')).toHaveText('')
        }

        await page.click('#unlock-btn')
        await expect(page.locator('#scrollbar-gutter-value')).toHaveText('')
    })

    test('restores original scrollbar gutter value', async ({ page }) => {
        test.skip(
            !(await page.evaluate(() => CSS.supports('scrollbar-gutter: stable both-edges'))),
            'scrollbar-gutter both-edges is not supported',
        )

        await page.click('#set-scrollbar-gutter')
        await expect(page.locator('#scrollbar-gutter-value')).toHaveText('stable both-edges')

        await page.click('#lock-btn')
        await expect(page.locator('#scrollbar-gutter-value')).toHaveText('stable')

        await page.click('#unlock-btn')
        await expect(page.locator('#scrollbar-gutter-value')).toHaveText('stable both-edges')
    })
})
