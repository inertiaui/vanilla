import { test, expect } from './test'

test.describe('debounce', () => {
    test('coalesces rapid calls into one per frame', async ({ page }) => {
        await expect(page.locator('#debounce-count')).toHaveText('1')
    })

    test('passes arguments through', async ({ page }) => {
        await expect(page.locator('#debounce-args')).toHaveText('["a","b","c"]')
    })
})

test.describe('detectFramerate', () => {
    test('returns a value in the 30-240 range', async ({ page }) => {
        await expect(page.locator('#framerate-value')).not.toHaveText('')
        const text = await page.locator('#framerate-value').textContent()
        const fps = Number(text)
        expect(fps).toBeGreaterThanOrEqual(30)
        expect(fps).toBeLessThanOrEqual(240)
    })
})
