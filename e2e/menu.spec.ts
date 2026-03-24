import { test, expect } from './test'

test.describe('createMenuNavigation', () => {
    test.describe('vertical navigation', () => {
        test('initializes roving tabindex', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await expect(page.locator('#v-item-0')).toHaveAttribute('tabindex', '0')
            await expect(page.locator('#v-item-1')).toHaveAttribute('tabindex', '-1')
            await expect(page.locator('#v-item-4')).toHaveAttribute('tabindex', '-1')
        })

        test('auto-focuses first item', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await expect(page.locator('#v-item-0')).toBeFocused()
        })

        test('ArrowDown moves focus to next item', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await expect(page.locator('#v-item-0')).toBeFocused()

            await page.keyboard.press('ArrowDown')
            await expect(page.locator('#v-item-1')).toBeFocused()
        })

        test('ArrowDown skips disabled and aria-disabled items', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await expect(page.locator('#v-item-0')).toBeFocused()

            // Navigate to v-item-1 first
            await page.keyboard.press('ArrowDown')
            await expect(page.locator('#v-item-1')).toBeFocused()

            // v-item-2 is disabled, v-item-3 is aria-disabled, should land on v-item-4
            await page.keyboard.press('ArrowDown')
            await expect(page.locator('#v-item-4')).toBeFocused()
        })

        test('ArrowUp moves focus to previous item', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await page.locator('#v-item-4').focus()

            await page.keyboard.press('ArrowUp')
            // Skips v-item-3 (aria-disabled) and v-item-2 (disabled)
            await expect(page.locator('#v-item-1')).toBeFocused()
        })

        test('loops from last to first', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await page.locator('#v-item-4').focus()

            await page.keyboard.press('ArrowDown')
            await expect(page.locator('#v-item-0')).toBeFocused()
        })

        test('loops from first to last', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await expect(page.locator('#v-item-0')).toBeFocused()

            await page.keyboard.press('ArrowUp')
            await expect(page.locator('#v-item-4')).toBeFocused()
        })

        test('Home focuses first item', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await page.locator('#v-item-4').focus()

            await page.keyboard.press('Home')
            await expect(page.locator('#v-item-0')).toBeFocused()
        })

        test('End focuses last item', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await expect(page.locator('#v-item-0')).toBeFocused()

            await page.keyboard.press('End')
            await expect(page.locator('#v-item-4')).toBeFocused()
        })
    })

    test.describe('activation', () => {
        test('Enter activates focused item', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await page.locator('#v-item-1').focus()

            await page.keyboard.press('Enter')
            await expect(page.locator('#activate-log')).toHaveText('banana')
        })

        test('Space activates focused item', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await page.locator('#v-item-0').focus()

            await page.keyboard.press(' ')
            await expect(page.locator('#activate-log')).toHaveText('apple')
        })
    })

    test.describe('type-ahead', () => {
        test('finds matching item by character', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await expect(page.locator('#v-item-0')).toBeFocused()

            await page.keyboard.press('e')
            await expect(page.locator('#v-item-4')).toBeFocused()
        })

        test('buffer clears after 350ms', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await expect(page.locator('#v-item-0')).toBeFocused()

            await page.keyboard.press('b')
            await expect(page.locator('#v-item-1')).toBeFocused() // Banana

            // Wait for buffer to clear (350ms timeout + margin)
            await page.waitForTimeout(500)

            await page.keyboard.press('a')
            await expect(page.locator('#v-item-0')).toBeFocused() // Apple
        })

        test('disabled when typeAhead is false', async ({ page }) => {
            await page.click('#open-no-typeahead-btn')
            await expect(page.locator('#nt-item-0')).toBeFocused()

            await page.keyboard.press('b')
            // Should still be on first item
            await expect(page.locator('#nt-item-0')).toBeFocused()
        })
    })

    test.describe('horizontal orientation', () => {
        test('ArrowRight/ArrowLeft navigate', async ({ page }) => {
            await page.click('#open-horizontal-btn')
            await expect(page.locator('#h-item-0')).toBeFocused()

            await page.keyboard.press('ArrowRight')
            await expect(page.locator('#h-item-1')).toBeFocused()

            await page.keyboard.press('ArrowRight')
            await expect(page.locator('#h-item-2')).toBeFocused()

            await page.keyboard.press('ArrowLeft')
            await expect(page.locator('#h-item-1')).toBeFocused()
        })
    })

    test.describe('no-loop', () => {
        test('clamps at boundaries', async ({ page }) => {
            await page.click('#open-noloop-btn')
            await expect(page.locator('#nl-item-0')).toBeFocused()

            // ArrowUp at first item should stay
            await page.keyboard.press('ArrowUp')
            await expect(page.locator('#nl-item-0')).toBeFocused()

            // Navigate to last
            await page.locator('#nl-item-2').focus()

            // ArrowDown at last item should stay
            await page.keyboard.press('ArrowDown')
            await expect(page.locator('#nl-item-2')).toBeFocused()
        })
    })

    test.describe('roving tabindex', () => {
        test('updates tabindex on navigation', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await expect(page.locator('#v-item-0')).toBeFocused()
            await expect(page.locator('#v-item-0')).toHaveAttribute('tabindex', '0')

            await page.keyboard.press('ArrowDown')
            await expect(page.locator('#v-item-1')).toBeFocused()
            await expect(page.locator('#v-item-0')).toHaveAttribute('tabindex', '-1')
            await expect(page.locator('#v-item-1')).toHaveAttribute('tabindex', '0')
        })
    })

    test.describe('custom selector', () => {
        test('works with custom item selector', async ({ page }) => {
            await page.click('#open-custom-btn')
            await expect(page.locator('#c-item-0')).toBeFocused()

            await page.keyboard.press('ArrowDown')
            await expect(page.locator('#c-item-1')).toBeFocused()

            await page.keyboard.press('Enter')
            await expect(page.locator('#activate-log')).toHaveText('Nav Two')
        })
    })

    test.describe('cleanup', () => {
        test('removes keyboard listener', async ({ page }) => {
            await page.click('#open-vertical-btn')
            await expect(page.locator('#v-item-0')).toBeFocused()

            await page.click('#close-btn')

            // Focus an item manually and try arrow key
            await page.locator('#v-item-0').focus()
            await page.keyboard.press('ArrowDown')
            // Without the listener, focus should not have moved via menu logic
            // (browser default behavior may vary, but tabindex won't update)
            await expect(page.locator('#v-item-0')).toHaveAttribute('tabindex', '0')
        })
    })
})
