import { test, expect } from './test'

test.describe('blank', () => {
    test('null is blank', async ({ page }) => {
        await expect(page.locator('#blank-null')).toHaveText('true')
    })

    test('undefined is blank', async ({ page }) => {
        await expect(page.locator('#blank-undefined')).toHaveText('true')
    })

    test('empty string is blank', async ({ page }) => {
        await expect(page.locator('#blank-empty-string')).toHaveText('true')
    })

    test('whitespace-only string is blank', async ({ page }) => {
        await expect(page.locator('#blank-whitespace')).toHaveText('true')
    })

    test('non-empty string is not blank', async ({ page }) => {
        await expect(page.locator('#blank-string')).toHaveText('false')
    })

    test('zero is not blank', async ({ page }) => {
        await expect(page.locator('#blank-zero')).toHaveText('false')
    })

    test('false is not blank', async ({ page }) => {
        await expect(page.locator('#blank-false')).toHaveText('false')
    })

    test('empty array is blank', async ({ page }) => {
        await expect(page.locator('#blank-empty-array')).toHaveText('true')
    })

    test('non-empty array is not blank', async ({ page }) => {
        await expect(page.locator('#blank-array')).toHaveText('false')
    })

    test('empty object is not blank (matches Laravel behavior)', async ({ page }) => {
        await expect(page.locator('#blank-empty-object')).toHaveText('false')
    })

    test('non-empty object is not blank', async ({ page }) => {
        await expect(page.locator('#blank-object')).toHaveText('false')
    })
})
