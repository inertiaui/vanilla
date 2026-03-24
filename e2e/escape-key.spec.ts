import { test, expect } from './test'

test.describe('onEscapeKey', () => {
    test('fires callback on Escape', async ({ page }) => {
        await page.click('#register-btn')
        await page.keyboard.press('Escape')
        await expect(page.locator('#escape-count')).toHaveText('1')
    })

    test('does not fire on other keys', async ({ page }) => {
        await page.click('#register-btn')
        await page.keyboard.press('Enter')
        await page.keyboard.press('a')
        await page.keyboard.press('Tab')
        await expect(page.locator('#escape-count')).toHaveText('0')
    })

    test('cleanup removes listener', async ({ page }) => {
        await page.click('#register-btn')
        await page.keyboard.press('Escape')
        await expect(page.locator('#escape-count')).toHaveText('1')

        await page.click('#unregister-btn')
        await page.keyboard.press('Escape')
        await expect(page.locator('#escape-count')).toHaveText('1')
    })

    test('fires multiple times', async ({ page }) => {
        await page.click('#register-btn')
        await page.keyboard.press('Escape')
        await page.keyboard.press('Escape')
        await page.keyboard.press('Escape')
        await expect(page.locator('#escape-count')).toHaveText('3')
    })

    test('stopPropagation option works', async ({ page }) => {
        await page.click('#register-stop-btn')
        await page.keyboard.press('Escape')

        // Callback fires normally with stopPropagation enabled
        await expect(page.locator('#escape-count')).toHaveText('1')

        // The window listener should NOT see the event because stopPropagation
        // prevents it from reaching window (document → window propagation stopped)
        await expect(page.locator('#propagation-log')).toHaveText('none')
    })
})
