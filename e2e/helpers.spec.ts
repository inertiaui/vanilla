import { test, expect } from './test'

test.describe('generateId', () => {
    test('returns string with default prefix', async ({ page }) => {
        await expect(page.locator('#generateId-result1')).toHaveText(/^inertiaui_/)
    })

    test('supports custom prefix', async ({ page }) => {
        await expect(page.locator('#generateId-custom')).toHaveText(/^test_/)
    })

    test('produces unique values', async ({ page }) => {
        const id1 = await page.locator('#generateId-result1').textContent()
        const id2 = await page.locator('#generateId-result2').textContent()
        expect(id1).not.toBe(id2)
    })
})

test.describe('except', () => {
    test('filters object keys', async ({ page }) => {
        await expect(page.locator('#except-obj')).toHaveText('{"a":1,"c":3}')
    })

    test('filters array elements', async ({ page }) => {
        await expect(page.locator('#except-arr')).toHaveText('["a","c"]')
    })

    test('case insensitive matching', async ({ page }) => {
        await expect(page.locator('#except-case')).toHaveText('{"city":3}')
    })
})

test.describe('only', () => {
    test('keeps specified object keys', async ({ page }) => {
        await expect(page.locator('#only-obj')).toHaveText('{"a":1,"c":3}')
    })

    test('keeps specified array elements', async ({ page }) => {
        await expect(page.locator('#only-arr')).toHaveText('["b","d"]')
    })

    test('case insensitive matching', async ({ page }) => {
        await expect(page.locator('#only-case')).toHaveText('{"Name":1,"city":3}')
    })
})

test.describe('rejectNullValues', () => {
    test('removes null from object', async ({ page }) => {
        await expect(page.locator('#reject-obj')).toHaveText('{"a":1,"c":3}')
    })

    test('removes null from array', async ({ page }) => {
        await expect(page.locator('#reject-arr')).toHaveText('[1,3,5]')
    })

    test('preserves undefined values', async ({ page }) => {
        // undefined is not serialized by JSON.stringify, so key c is omitted
        const text = await page.locator('#reject-undefined').textContent()
        const parsed = JSON.parse(text!)
        expect(parsed).toHaveProperty('a', 1)
        expect(parsed).not.toHaveProperty('b')
        expect(parsed).toHaveProperty('d', 3)
    })
})

test.describe('kebabCase', () => {
    test('converts camelCase', async ({ page }) => {
        await expect(page.locator('#kebab-camel')).toHaveText('camel-case')
    })

    test('converts PascalCase', async ({ page }) => {
        await expect(page.locator('#kebab-pascal')).toHaveText('pascal-case')
    })

    test('converts acronyms', async ({ page }) => {
        await expect(page.locator('#kebab-acronym')).toHaveText('html-element')
    })

    test('converts spaces', async ({ page }) => {
        await expect(page.locator('#kebab-spaces')).toHaveText('hello-world')
    })

    test('handles empty string', async ({ page }) => {
        await expect(page.locator('#kebab-empty')).toHaveText('(empty)')
    })

    test('converts snake_case', async ({ page }) => {
        await expect(page.locator('#kebab-snake')).toHaveText('snake-case')
    })
})

test.describe('isStandardDomEvent', () => {
    test('recognizes standard events', async ({ page }) => {
        await expect(page.locator('#isEvent-click')).toHaveText('true')
    })

    test('rejects custom events', async ({ page }) => {
        await expect(page.locator('#isEvent-custom')).toHaveText('false')
    })

    test('is case insensitive', async ({ page }) => {
        await expect(page.locator('#isEvent-case')).toHaveText('true')
    })
})

test.describe('onceChildrenRendered', () => {
    test('calls callback immediately when children already exist', async ({ page }) => {
        await expect(page.locator('#once-has-children')).toHaveText('called')
    })

    test('calls callback when children are added later', async ({ page }) => {
        await expect(page.locator('#once-no-children')).toHaveText('called')
    })

    test('disconnects observer after first callback', async ({ page }) => {
        await expect(page.locator('#once-disconnect')).toHaveText('1')
    })
})

test.describe('sameUrlPath', () => {
    test('matches identical paths', async ({ page }) => {
        await expect(page.locator('#sameUrl-same')).toHaveText('true')
    })

    test('ignores query strings', async ({ page }) => {
        await expect(page.locator('#sameUrl-query')).toHaveText('true')
    })

    test('rejects different paths', async ({ page }) => {
        await expect(page.locator('#sameUrl-diff')).toHaveText('false')
    })

    test('returns false for null', async ({ page }) => {
        await expect(page.locator('#sameUrl-null')).toHaveText('false')
    })
})
