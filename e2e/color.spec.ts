import { test, expect } from './test'

test.describe('hexToHsl', () => {
    test('converts red', async ({ page }) => {
        await expect(page.locator('#hex-red')).toHaveText('0,100,50')
    })

    test('converts green', async ({ page }) => {
        await expect(page.locator('#hex-green')).toHaveText('120,100,50')
    })

    test('converts blue', async ({ page }) => {
        await expect(page.locator('#hex-blue')).toHaveText('240,100,50')
    })

    test('converts white', async ({ page }) => {
        await expect(page.locator('#hex-white')).toHaveText('0,0,100')
    })

    test('converts black', async ({ page }) => {
        await expect(page.locator('#hex-black')).toHaveText('0,0,0')
    })

    test('works without leading #', async ({ page }) => {
        await expect(page.locator('#hex-no-hash')).toHaveText('32,100,50')
    })

    test('returns fallback for invalid input', async ({ page }) => {
        await expect(page.locator('#hex-invalid')).toHaveText('0,100,50')
    })
})

test.describe('hslToHex', () => {
    test('converts red', async ({ page }) => {
        await expect(page.locator('#hsl-red')).toHaveText('#ff0000')
    })

    test('converts green', async ({ page }) => {
        await expect(page.locator('#hsl-green')).toHaveText('#00ff00')
    })

    test('converts blue', async ({ page }) => {
        await expect(page.locator('#hsl-blue')).toHaveText('#0000ff')
    })

    test('converts white', async ({ page }) => {
        await expect(page.locator('#hsl-white')).toHaveText('#ffffff')
    })

    test('converts black', async ({ page }) => {
        await expect(page.locator('#hsl-black')).toHaveText('#000000')
    })
})

test.describe('roundtrip', () => {
    test('hex → hsl → hex preserves orange', async ({ page }) => {
        await expect(page.locator('#roundtrip-orange')).toHaveText('#ff8800')
    })

    test('hex → hsl → hex preserves steel blue', async ({ page }) => {
        await expect(page.locator('#roundtrip-steel')).toHaveText('#336699')
    })
})
