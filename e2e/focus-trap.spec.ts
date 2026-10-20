import { test, expect } from './test'

for (const tail of [0, 80]) {
    test(`hidden inputs are skipped for focus and keyboard boundaries with ${tail} decorative nodes`, async ({
        page,
    }) => {
        await page.evaluate(async (tail) => {
            const modulePath = '/src/index.ts'
            const { createFocusTrap } = await import(modulePath)
            const container = document.createElement('div')
            container.innerHTML =
                '<input type="hidden"><input type="HIDDEN" tabindex="0">' +
                '<button id="hidden-trap-first">First</button><button id="hidden-trap-last">Last</button>' +
                '<input type="hidden"><input type="HIDDEN" tabindex="0">' +
                '<span>Decoration</span>'.repeat(tail)
            document.body.append(container)
            ;(window as any).releaseHiddenInputTrap = createFocusTrap(container, { returnFocus: false })
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        }, tail)
        try {
            const first = page.locator('#hidden-trap-first')
            const last = page.locator('#hidden-trap-last')
            await expect.soft(first).toBeFocused()

            await last.focus()
            await page.keyboard.press('Tab')
            await expect.soft(first).toBeFocused()

            await first.focus()
            await page.keyboard.press('Shift+Tab')
            await expect.soft(last).toBeFocused()

            await page.locator('#outside-btn').focus()
            await expect.soft(first).toBeFocused()

            await last.focus()
            await last.evaluate((element: HTMLElement) => element.blur())
            await expect.soft(first).toBeFocused()
        } finally {
            await page.evaluate(() => (window as any).releaseHiddenInputTrap())
        }
    })
}

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
        // Establish focus explicitly; macOS keyboard settings can skip buttons on Tab.
        await page.locator('#open-dialog-btn').focus()
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

    test('recaptures focus on later blur even after a prior pointerdown inside the container', async ({ page }) => {
        await page.click('#open-scrollable-btn')
        await expect(page.locator('#ds-first')).toBeFocused()

        // Real pointer click on a focusable element inside the dialog. This sets
        // the internal lastPointerDownTarget to an element inside the container.
        await page.locator('#ds-mid-input').click()
        await expect(page.locator('#ds-mid-input')).toBeFocused()

        // Wait long enough for the pointerdown microtask to clear the tracked target.
        await page.waitForTimeout(20)

        // Programmatically blur the active element. This fires focusout with
        // relatedTarget=null and is not driven by a pointerdown. If the stale
        // pointer target were still set, recapture would be wrongly skipped.
        await page.evaluate(() => {
            ;(document.activeElement as HTMLElement | null)?.blur()
        })

        await page.waitForTimeout(50)

        // Focus should be recaptured back into the dialog.
        const isInDialog = await page
            .locator('#dialog-scrollable')
            .evaluate((el) => el.contains(document.activeElement))
        expect(isInDialog).toBe(true)
    })

    test('clicking a non-focusable element inside a scrolled container does not recapture focus or reset scroll', async ({
        page,
    }) => {
        await page.click('#open-scrollable-btn')
        await expect(page.locator('#ds-first')).toBeFocused()

        // Scroll the dialog down so the label is in view but the first input is not.
        await page.locator('#dialog-scrollable').evaluate((el) => {
            el.scrollTop = 100
        })
        const scrollTopBefore = await page.locator('#dialog-scrollable').evaluate((el) => el.scrollTop)
        expect(scrollTopBefore).toBe(100)

        // Move focus to the middle input so there's an active element to "lose" on
        // pointerdown. Use focus() with preventScroll so we don't disturb scrollTop.
        await page.locator('#ds-mid-input').evaluate((el: HTMLInputElement) => {
            el.focus({ preventScroll: true })
        })
        await expect(page.locator('#ds-mid-input')).toBeFocused()

        // Click a non-focusable element (plain <p>) inside the dialog with a real
        // pointer event. Before the fix this fired focusout with relatedTarget=null,
        // which yanked focus to #ds-first and auto-scrolled the dialog back to the
        // top.
        await page.locator('#ds-label').click()

        // Wait for queueMicrotask in handleFocusOut to settle.
        await page.waitForTimeout(50)

        // Scroll position should be preserved.
        const scrollTopAfter = await page.locator('#dialog-scrollable').evaluate((el) => el.scrollTop)
        expect(scrollTopAfter).toBe(scrollTopBefore)

        // Focus should NOT have been pulled back to the first input.
        await expect(page.locator('#ds-first')).not.toBeFocused()
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

test('initial focus and recovery follow changed controls in a large dialog', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const modulePath = '/src/index.ts'
        const { createFocusTrap } = await import(modulePath)
        const container = document.createElement('section')
        container.innerHTML =
            '<button aria-hidden="true">Hidden</button><button disabled>Disabled</button><a href="#">First</a>' +
            Array.from({ length: 1000 }, (_, index) => `<input data-index="${index}">`).join('')
        const outside = document.createElement('button')
        document.body.append(container, outside)
        const release = createFocusTrap(container, { returnFocus: false })
        try {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            const initial = document.activeElement === container.children[2]
            container.children[2].setAttribute('aria-hidden', 'true')
            outside.focus()
            const recovered = document.activeElement === container.children[3]
            container.children[3].setAttribute('disabled', '')
            outside.focus()
            const changed = document.activeElement === container.children[4]
            const replacement = document.createElement('textarea')
            container.prepend(replacement)
            outside.focus()
            const inserted = document.activeElement === replacement
            replacement.blur()
            await Promise.resolve()
            const recapturedAfterBlur = document.activeElement === replacement
            replacement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
            const wrapped = document.activeElement === container.lastElementChild
            return { initial, recovered, changed, inserted, recapturedAfterBlur, wrapped }
        } finally {
            release()
            container.remove()
            outside.remove()
        }
    })
    expect(result).toEqual({
        initial: true,
        recovered: true,
        changed: true,
        inserted: true,
        recapturedAfterBlur: true,
        wrapped: true,
    })
})

for (const transfer of ['cleanup', 'new-trap']) {
    test(`queued focus recovery respects ${transfer}`, async ({ page }) => {
        const result = await page.evaluate(async (transfer) => {
            const modulePath = '/src/index.ts'
            const { createFocusTrap } = await import(modulePath)
            const outer = document.createElement('div')
            const first = document.createElement('button')
            const inner = document.createElement('div')
            inner.append(document.createElement('button'))
            const outside = document.createElement('button')
            outer.append(first, inner)
            document.body.append(outer, outside)
            const release = createFocusTrap(outer, { initialFocus: false, returnFocus: false })
            let releaseInner = () => {}
            try {
                first.focus()
                first.blur()
                let staleFocuses = 0
                first.addEventListener('focus', () => staleFocuses++)
                if (transfer === 'cleanup') {
                    release()
                    outside.focus()
                } else {
                    releaseInner = createFocusTrap(inner, { initialFocus: false, returnFocus: false })
                }
                await Promise.resolve()
                return {
                    staleFocuses,
                    outsideRetained: transfer !== 'cleanup' || document.activeElement === outside,
                }
            } finally {
                releaseInner()
                release()
                outer.remove()
                outside.remove()
            }
        }, transfer)
        expect(result).toEqual({ staleFocuses: 0, outsideRetained: true })
    })
}

test('an older trap cannot apply initial focus after a newer trap opts out', async ({ page }) => {
    const retained = await page.evaluate(async () => {
        const modulePath = '/src/index.ts'
        const { createFocusTrap } = await import(modulePath)
        const outside = document.createElement('button')
        const outer = document.createElement('div')
        const inner = document.createElement('div')
        inner.append(document.createElement('button'))
        outer.append(document.createElement('button'), inner)
        document.body.append(outside, outer)
        outside.focus()
        const releaseOuter = createFocusTrap(outer, { returnFocus: false })
        const releaseInner = createFocusTrap(inner, { initialFocus: false, returnFocus: false })
        try {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            return document.activeElement === outside
        } finally {
            releaseInner()
            releaseOuter()
            outer.remove()
            outside.remove()
        }
    })
    expect(retained).toBe(true)
})

test('leaves interior backward Tab native and follows changed trap boundaries', async ({ page }) => {
    await page.evaluate(async () => {
        const modulePath = '/src/index.ts'
        const { createFocusTrap } = await import(modulePath)
        const container = document.createElement('div')
        container.innerHTML = '<input id="inside-first"><input id="inside-middle"><input id="inside-last">'
        document.body.append(container)
        ;(window as any).releaseInteriorTrap = createFocusTrap(container, { initialFocus: false, returnFocus: false })
    })
    try {
        await page.locator('#inside-middle').focus()
        await page.keyboard.press('Shift+Tab')
        await expect(page.locator('#inside-first')).toBeFocused()
        await page.locator('#inside-first').evaluate((element) => element.setAttribute('disabled', ''))
        await page.locator('#inside-middle').focus()
        await page.keyboard.press('Shift+Tab')
        await expect(page.locator('#inside-last')).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(page.locator('#inside-middle')).toBeFocused()
    } finally {
        await page.evaluate(() => (window as any).releaseInteriorTrap())
    }
})

for (const tail of [0, 80]) {
    test(`forward Tab and wrapping follow nested, changing controls with ${tail} decorative nodes`, async ({
        page,
    }) => {
        await page.evaluate(async (tail) => {
            const modulePath = '/src/index.ts'
            const { createFocusTrap } = await import(modulePath)
            const container = document.createElement('div')
            container.id = 'dynamic-trap'
            container.innerHTML =
                '<input id="dynamic-first"><section tabindex="0" id="dynamic-parent">' +
                '<input id="dynamic-middle"><div><input id="dynamic-last"><span>Label</span></div></section>' +
                '<input disabled><input aria-hidden="true" tabindex="-1"><footer>' +
                '<span>Decoration</span>'.repeat(tail) +
                '</footer>'
            document.body.append(container)
            ;(window as any).releaseDynamicTrap = createFocusTrap(container, {
                initialFocus: false,
                returnFocus: false,
            })
        }, tail)
        try {
            await page.locator('#dynamic-middle').focus()
            await page.keyboard.press('Tab')
            await expect(page.locator('#dynamic-last')).toBeFocused()
            await page.keyboard.press('Tab')
            await expect(page.locator('#dynamic-first')).toBeFocused()
            await page.keyboard.press('Shift+Tab')
            await expect(page.locator('#dynamic-last')).toBeFocused()
            await page.locator('#dynamic-last').evaluate((element) => element.setAttribute('disabled', ''))
            await page.locator('#dynamic-middle').focus()
            await page.keyboard.press('Tab')
            await expect(page.locator('#dynamic-first')).toBeFocused()
            await page.locator('#dynamic-middle').evaluate((element) => element.remove())
            await page.keyboard.press('Shift+Tab')
            await expect(page.locator('#dynamic-parent')).toBeFocused()
            await page.locator('#dynamic-trap').evaluate((element) => {
                const input = document.createElement('input')
                input.id = 'dynamic-inserted'
                element.append(input)
            })
            await page.locator('#dynamic-first').focus()
            await page.keyboard.press('Shift+Tab')
            await expect(page.locator('#dynamic-inserted')).toBeFocused()
        } finally {
            await page.evaluate(() => (window as any).releaseDynamicTrap())
        }
    })
}
