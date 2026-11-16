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

test.describe('isRightToLeft', () => {
    test('follows a dir attribute on an ancestor, not only the document', async ({ page }) => {
        await expect(page.locator('#element-rtl')).toHaveText('true false')
        await expect(page.locator('#element-ltr')).toHaveText('false')
    })
})

test.describe('followReferenceDirection', () => {
    test('gives the panel the reference direction until cleanup', async ({ page }) => {
        await expect(page.locator('#follow-direction')).toHaveText('rtl null')
    })

    test('keeps a direction the panel already has', async ({ page }) => {
        await expect(page.locator('#follow-own-direction')).toHaveText('ltr ltr')
    })

    test('adds nothing when the panel already runs in the reference direction', async ({ page }) => {
        await expect(page.locator('#follow-same-direction')).toHaveText('null null')
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
