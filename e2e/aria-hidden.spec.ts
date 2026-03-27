import { test, expect } from './test'

test.describe('markAriaHidden', () => {
    test('marks element as aria-hidden', async ({ page }) => {
        await page.click('#mark-btn')
        await expect(page.locator('#aria-value')).toHaveText('true')
    })

    test('accepts CSS selector', async ({ page }) => {
        await page.click('#mark-by-selector-btn')
        await expect(page.locator('#aria-value')).toHaveText('true')
    })

    test('cleanup removes aria-hidden', async ({ page }) => {
        await page.click('#mark-btn')
        await expect(page.locator('#aria-value')).toHaveText('true')

        await page.click('#unmark-btn')
        await expect(page.locator('#aria-value')).toHaveText('null')
    })

    test('restores original aria-hidden value', async ({ page }) => {
        await expect(page.locator('#aria-value-existing')).toHaveText('false')

        await page.click('#mark-existing-btn')
        await expect(page.locator('#aria-value-existing')).toHaveText('true')

        await page.click('#unmark-existing-btn')
        await expect(page.locator('#aria-value-existing')).toHaveText('false')
    })

    test('reference counting with nested marks', async ({ page }) => {
        await page.click('#mark-btn')
        await page.click('#mark-btn')
        await expect(page.locator('#aria-value')).toHaveText('true')

        await page.click('#unmark-btn')
        await expect(page.locator('#aria-value')).toHaveText('true')

        await page.click('#unmark-btn')
        await expect(page.locator('#aria-value')).toHaveText('null')
    })

    test('noop for non-existent selector', async ({ page }) => {
        await page.click('#mark-nonexistent-btn')
        await page.click('#unmark-nonexistent-btn')
        // No error, page still functional
        await expect(page.locator('#aria-value')).toHaveText('null')
    })

    test('idempotent cleanup', async ({ page }) => {
        await page.click('#mark-btn')
        await page.click('#mark-btn')
        await page.click('#unmark-btn')
        await page.click('#unmark-btn')
        await page.click('#unmark-btn') // extra call, should be safe
        await expect(page.locator('#aria-value')).toHaveText('null')
    })
})
