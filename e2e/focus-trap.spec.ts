import { test, expect } from './test'

test.describe('createFocusTrap', () => {
    test('auto-focuses first focusable element on open', async ({ page }) => {
        await page.click('#open-dialog-btn')
        await expect(page.locator('#d1-first')).toBeFocused()
    })

    test('Tab wraps from last to first', async ({ page }) => {
        await page.click('#open-dialog-btn')
        await expect(page.locator('#d1-first')).toBeFocused()

        // Tab to last element
        await page.locator('#d1-last').focus()
        await expect(page.locator('#d1-last')).toBeFocused()

        // One more Tab should skip close-dialog-btn (it's after d1-last but still in container)
        // Actually, close-dialog-btn IS focusable. Let's focus close-dialog-btn then Tab
        await page.locator('#close-dialog-btn').focus()
        await page.keyboard.press('Tab')
        await expect(page.locator('#d1-first')).toBeFocused()
    })

    test('Shift+Tab wraps from first to last', async ({ page }) => {
        await page.click('#open-dialog-btn')
        await expect(page.locator('#d1-first')).toBeFocused()

        await page.keyboard.press('Shift+Tab')
        await expect(page.locator('#close-dialog-btn')).toBeFocused()
    })

    test('focus escaping container is redirected back', async ({ page }) => {
        await page.click('#open-dialog-btn')
        await expect(page.locator('#d1-first')).toBeFocused()

        // Try to focus an element outside the dialog
        await page.locator('#outside-btn').focus()
        // Focus should be redirected back into the dialog
        await expect(page.locator('#d1-first')).toBeFocused()
    })

    test('nested trap: only topmost is active', async ({ page }) => {
        await page.click('#open-dialog-btn')
        await expect(page.locator('#d1-first')).toBeFocused()

        await page.click('#open-nested-btn')
        await expect(page.locator('#d2-first')).toBeFocused()

        // Tab should wrap within dialog-2
        await page.locator('#close-nested-btn').focus()
        await page.keyboard.press('Tab')
        await expect(page.locator('#d2-first')).toBeFocused()
    })

    test('nested trap: closing inner restores outer', async ({ page }) => {
        await page.click('#open-dialog-btn')
        await page.click('#open-nested-btn')
        await expect(page.locator('#d2-first')).toBeFocused()

        await page.click('#close-nested-btn')

        // Focus should be in dialog-1 now, Tab should wrap within dialog-1
        await page.locator('#close-dialog-btn').focus()
        await page.keyboard.press('Tab')
        await expect(page.locator('#d1-first')).toBeFocused()
    })

    test('returnFocus restores focus on cleanup', async ({ page }) => {
        // Focus outside-btn, then open dialog via keyboard to preserve focus context
        await page.locator('#outside-btn').focus()
        await expect(page.locator('#outside-btn')).toBeFocused()

        // Use Tab to reach open-dialog-btn, then Enter to open
        await page.keyboard.press('Tab')
        await expect(page.locator('#open-dialog-btn')).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.locator('#d1-first')).toBeFocused()

        await page.click('#close-dialog-btn')
        // Focus should return to open-dialog-btn (the element focused before the trap)
        await expect(page.locator('#open-dialog-btn')).toBeFocused()
    })

    test('returnFocus=false does not restore focus', async ({ page }) => {
        await page.locator('#outside-btn').focus()
        await page.click('#open-no-return-btn')
        await expect(page.locator('#d1-first')).toBeFocused()

        await page.click('#close-dialog-btn')
        // Focus should NOT be on outside-btn
        await expect(page.locator('#outside-btn')).not.toBeFocused()
    })

    test('initialFocusElement option', async ({ page }) => {
        await page.click('#open-custom-focus-btn')
        await expect(page.locator('#d1-input')).toBeFocused()
    })

    test('focusout with null relatedTarget recaptures focus', async ({ page }) => {
        await page.click('#open-dialog-btn')
        await expect(page.locator('#d1-first')).toBeFocused()

        // Move focus to a known element inside the dialog
        await page.locator('#d1-last').focus()
        await expect(page.locator('#d1-last')).toBeFocused()

        // Simulate focus escaping to void (relatedTarget=null)
        await page.evaluate(() => {
            ;(window as any).simulateFocusEscape()
        })

        // Focus should be recaptured into the dialog
        await page.waitForTimeout(50) // queueMicrotask
        const activeId = await page.evaluate(() => document.activeElement?.id)
        const dialog = page.locator('#dialog-1')
        const isInDialog = await dialog.evaluate((el) => el.contains(document.activeElement))
        expect(isInDialog).toBe(true)
    })

    test('returnFocus skips disconnected elements', async ({ page }) => {
        // Open dialog after focusing a button, then remove that button
        await page.click('#open-then-remove-btn')
        await expect(page.locator('#d1-first')).toBeFocused()
        await expect(page.locator('#return-connected-status')).toHaveText('removed')

        // Close dialog — returnFocus should NOT throw, and should not try to focus removed element
        await page.evaluate(() => {
            ;(window as any).closeAndCheckReturn()
        })

        // The page should still be functional (no error thrown)
        // The focused element should be something other than the removed button
        const focusedId = await page.evaluate(() => document.activeElement?.id)
        expect(focusedId).not.toBe('removable-btn')
    })

    test('idempotent cleanup', async ({ page }) => {
        await page.click('#open-dialog-btn')
        await expect(page.locator('#d1-first')).toBeFocused()

        // Close twice via exposed function
        await page.evaluate(() => {
            ;(window as any).closeDialog()
            ;(window as any).closeDialog()
        })

        // Page should still be functional
        await page.click('#open-dialog-btn')
        await expect(page.locator('#d1-first')).toBeFocused()
    })
})
