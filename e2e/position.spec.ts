import { test, expect } from './test'

for (const mode of ['generic', 'top-layer', 'mixed']) {
    test(`shared anchors preserve both panels through fallback and cleanup (${mode})`, async ({ page }) => {
        const result = await page.evaluate(async (mode) => {
            const modulePath = '/src/index.ts'
            const {
                computePosition,
                positionTopLayerPopover,
                autoUpdate,
                autoUpdateTopLayerPopover,
                supportsTopLayerAnchorPositioning,
            } = await import(modulePath)
            if (!supportsTopLayerAnchorPositioning()) return null
            const reference = document.createElement('button')
            reference.style.cssText = 'position:fixed;top:300px;left:300px;width:150px;height:30px'
            reference.style.setProperty('anchor-name', '--consumer, --other', 'important')
            const panels = [document.createElement('div'), document.createElement('div')]
            panels.forEach((panel, i) => {
                panel.style.cssText = 'width:80px;height:40px;padding:0;border:0'
                if (mode === 'top-layer' || (mode === 'mixed' && i === 1)) {
                    panel.setAttribute('popover', 'manual')
                }
            })
            document.body.append(reference, ...panels)
            panels.forEach((panel) => {
                if (panel.hasAttribute('popover')) panel.showPopover()
            })
            const functions = panels.map((_, i) =>
                mode === 'top-layer' || (mode === 'mixed' && i === 1)
                    ? [positionTopLayerPopover, autoUpdateTopLayerPopover]
                    : [computePosition, autoUpdate],
            )
            const options = { placement: 'bottom-start', offset: 4, flip: false }
            const cleanups = panels.map((panel, i) => {
                functions[i][0](reference, panel, options)
                return functions[i][1](reference, panel, () => {})
            })
            const measure = () =>
                panels.map((panel) => {
                    const rect = panel.getBoundingClientRect()
                    const ref = reference.getBoundingClientRect()
                    return { gap: rect.top - ref.bottom, alignment: rect.left - ref.left }
                })
            const both = measure()
            const names = reference.style.getPropertyValue('anchor-name')
            functions[0][0](reference, panels[0], { ...options, anchorPositioning: false })
            const fallback = measure()
            cleanups[0]()
            reference.style.left = '350px'
            const remaining = measure()[1]
            cleanups[1]()
            return {
                both,
                fallback,
                remaining,
                names,
                restored: reference.style.getPropertyValue('anchor-name'),
                priority: reference.style.getPropertyPriority('anchor-name'),
            }
        }, mode)
        test.skip(!result, 'Top-layer CSS anchors are unavailable')
        for (const rect of [...result!.both, ...result!.fallback, result!.remaining]) {
            expect(rect.gap).toBeCloseTo(4, 0)
            expect(rect.alignment).toBeCloseTo(0, 0)
        }
        expect(result!.names).toContain('--consumer, --other')
        expect(result!.restored).toBe('--consumer, --other')
        expect(result!.priority).toBe('important')
    })
}

for (const change of ['placement and offset', 'flip', 'direction', 'reference']) {
    test(`anchored computePosition updates ${change} on the same element`, async ({ page }) => {
        const result = await page.evaluate(async (change) => {
            const modulePath = '/src/index.ts'
            const { computePosition, supportsAnchorPositioning } = await import(modulePath)
            if (!supportsAnchorPositioning() || !CSS.supports('position-try-fallbacks', 'flip-block')) return null
            const reference = document.createElement('button')
            const replacement = document.createElement('button')
            const floating = document.createElement('div')
            reference.style.cssText = 'position:fixed;top:300px;left:300px;width:150px;height:30px'
            replacement.style.cssText = 'position:fixed;top:400px;left:500px;width:150px;height:30px'
            floating.style.cssText = 'width:80px;height:40px'
            document.body.append(reference, replacement, floating)
            const options = { placement: 'bottom-start', offset: 4, flip: false }
            if (change === 'flip') reference.style.top = `${window.innerHeight - 40}px`
            computePosition(reference, floating, options)
            if (change === 'placement and offset') Object.assign(options, { placement: 'top-end', offset: 20 })
            if (change === 'flip') options.flip = true
            if (change === 'direction') reference.style.direction = 'rtl'
            const active = change === 'reference' ? replacement : reference
            computePosition(active, floating, options)
            // CSS position-try selection may settle on the next rendering frame.
            await new Promise(requestAnimationFrame)
            await new Promise(requestAnimationFrame)
            const rect = floating.getBoundingClientRect()
            const ref = active.getBoundingClientRect()
            const above = change === 'placement and offset' || change === 'flip'
            const alignRight = change === 'placement and offset' || change === 'direction'
            const sheet = (document.getElementById('inertiaui-anchor-styles') as HTMLStyleElement).sheet!
            const original = sheet.cssRules[0]
            for (let i = 0; i < 10; i++) computePosition(active, floating, options)
            return {
                verticalGap: above ? ref.top - rect.bottom : rect.top - ref.bottom,
                alignmentError: alignRight ? rect.right - ref.right : rect.left - ref.left,
                reused: sheet.cssRules.length === 1 && sheet.cssRules[0] === original,
            }
        }, change)
        test.skip(!result, 'CSS anchor positioning and flip are unavailable')
        expect(result!.verticalGap).toBeCloseTo(change === 'placement and offset' ? 20 : 4, 0)
        expect(result!.alignmentError).toBeCloseTo(0, 0)
        expect(result!.reused).toBe(true)
    })
}

for (const anchorPositioning of [false, true]) {
    test(`non-flipping top-layer sizing follows changed width and content (anchors=${anchorPositioning})`, async ({
        page,
    }) => {
        const results = await page.evaluate(async (anchorPositioning) => {
            const modulePath = '/src/index.ts'
            const { positionTopLayerPopover } = await import(modulePath)
            const reference = document.createElement('button')
            const floating = document.createElement('div')
            reference.style.cssText = 'position:fixed;left:100px;top:100px;width:180px;height:30px'
            floating.setAttribute('popover', 'manual')
            document.body.append(reference, floating)
            floating.showPopover()
            try {
                return [180, 260, 140].map((width, index) => {
                    reference.style.width = `${width}px`
                    floating.innerHTML = '<div>Menu content with several wrapping words.</div>'.repeat(index ? 100 : 3)
                    const result = positionTopLayerPopover(reference, floating, {
                        flip: false,
                        matchReferenceWidth: true,
                        anchorPositioning,
                    })
                    const rect = floating.getBoundingClientRect()
                    return {
                        placement: result.placement,
                        matchesWidth: Math.abs(rect.width - reference.getBoundingClientRect().width) < 1,
                        belowReference: Math.abs(rect.top - reference.getBoundingClientRect().bottom - 4) < 1,
                        bounded: rect.bottom <= window.innerHeight,
                        scrollsWhenTall: index === 0 || floating.scrollHeight > floating.clientHeight,
                    }
                })
            } finally {
                floating.hidePopover()
                reference.remove()
                floating.remove()
            }
        }, anchorPositioning)
        expect(results).toEqual(
            Array.from({ length: 3 }, () => ({
                placement: 'bottom-start',
                matchesWidth: true,
                belowReference: true,
                bounded: true,
                scrollsWhenTall: true,
            })),
        )
    })
}

test('reuses unchanged top-layer anchor rules and repairs changed or missing rules', async ({ page }) => {
    const supported = await page.evaluate(() => (window as any).supportsTopLayerAnchorPositioning())
    test.skip(!supported, 'CSS anchor positioning is unavailable')
    const result = await page.evaluate(async () => {
        const modulePath = '/src/index.ts'
        const { positionTopLayerPopover, autoUpdateTopLayerPopover } = await import(modulePath)
        const reference = document.createElement('button')
        reference.style.cssText = 'position:fixed;top:100px;left:100px;width:150px;height:30px'
        const floating = document.createElement('div')
        floating.textContent = 'Popover'
        floating.setAttribute('popover', 'manual')
        document.body.append(reference, floating)
        floating.showPopover()
        const options = { placement: 'bottom-start', offset: 4, matchReferenceWidth: true }
        positionTopLayerPopover(reference, floating, options)
        const sheet = () => (document.getElementById('inertiaui-anchor-styles') as HTMLStyleElement).sheet!
        const className = Array.from(floating.classList).find((name) => name.startsWith('iui-anchor-'))!
        const rule = () =>
            Array.from(sheet().cssRules).find(
                (rule) => (rule as CSSStyleRule).selectorText === `.${className}`,
            ) as CSSStyleRule
        const initial = rule()
        const text = initial.cssText
        const observed = new MutationObserver(() => {})
        observed.observe(reference, { attributes: true })
        observed.observe(floating, { attributes: true, attributeFilter: ['class'] })
        for (let i = 0; i < 10; i++) positionTopLayerPopover(reference, floating, options)
        const reused = rule() === initial
        const unchangedAttributes = observed.takeRecords().length === 0
        observed.disconnect()

        initial.style.setProperty('margin-top', '999px')
        positionTopLayerPopover(reference, floating, options)
        const repaired = rule().cssText === text
        const index = Array.from(sheet().cssRules).indexOf(rule())
        sheet().deleteRule(index)
        positionTopLayerPopover(reference, floating, options)
        const recreated = rule().cssText === text

        positionTopLayerPopover(reference, floating, { ...options, offset: 16 })
        const moved =
            Math.abs(floating.getBoundingClientRect().top - reference.getBoundingClientRect().bottom - 16) < 0.5
        const changedRule = rule() !== initial && rule().cssText !== text
        const cleanup = autoUpdateTopLayerPopover(reference, floating, () => {})
        cleanup()
        const cleaned =
            !rule() &&
            !reference.style.getPropertyValue('anchor-name') &&
            !floating.style.getPropertyValue('position-anchor')
        floating.hidePopover()
        floating.remove()
        reference.remove()
        return { reused, unchangedAttributes, repaired, recreated, moved, changedRule, cleaned }
    })
    expect(result).toEqual({
        reused: true,
        unchangedAttributes: true,
        repaired: true,
        recreated: true,
        moved: true,
        changedRule: true,
        cleaned: true,
    })
})

test.describe('computePosition', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
    })

    test('bottom-start placement positions below reference', async ({ page }) => {
        await page.click('#pos-bottom-start')

        await expect(page.locator('#floating')).toBeVisible()

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // Floating should be below reference and left-aligned
        expect(floatingBox!.y).toBeGreaterThanOrEqual(refBox!.y + refBox!.height - 2)
        expect(Math.abs(floatingBox!.x - refBox!.x)).toBeLessThan(5)
        await expect(page.locator('#result-placement')).toHaveText('bottom-start')
    })

    test('bottom (center) placement centers horizontally', async ({ page }) => {
        await page.click('#pos-bottom')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // Floating center should be close to reference center
        const refCenter = refBox!.x + refBox!.width / 2
        const floatingCenter = floatingBox!.x + floatingBox!.width / 2
        expect(Math.abs(floatingCenter - refCenter)).toBeLessThan(5)
    })

    test('bottom-end placement right-aligns', async ({ page }) => {
        await page.click('#pos-bottom-end')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // Floating right edge should align with reference right edge
        const refRight = refBox!.x + refBox!.width
        const floatingRight = floatingBox!.x + floatingBox!.width
        expect(Math.abs(floatingRight - refRight)).toBeLessThan(5)
    })

    test('top placement positions above reference', async ({ page }) => {
        await page.click('#pos-top')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // Floating bottom should be at or above reference top
        expect(floatingBox!.y + floatingBox!.height).toBeLessThanOrEqual(refBox!.y + 2)
        await expect(page.locator('#result-placement')).toHaveText('top')
    })

    test('top-start placement positions above and left-aligned', async ({ page }) => {
        await page.click('#pos-top-start')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        expect(floatingBox!.y + floatingBox!.height).toBeLessThanOrEqual(refBox!.y + 2)
        expect(Math.abs(floatingBox!.x - refBox!.x)).toBeLessThan(5)
    })

    test('right placement positions to the right', async ({ page }) => {
        await page.click('#pos-right')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // Floating left edge should be at or after reference right edge
        expect(floatingBox!.x).toBeGreaterThanOrEqual(refBox!.x + refBox!.width - 2)
    })

    test('applies offset', async ({ page }) => {
        await page.click('#pos-with-offset')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // With offset=8, the gap between reference bottom and floating top should be ~8px
        const gap = floatingBox!.y - (refBox!.y + refBox!.height)
        expect(gap).toBeGreaterThanOrEqual(6)
        expect(gap).toBeLessThanOrEqual(10)
    })

    test('flips when overflowing viewport', async ({ page }) => {
        await page.click('#pos-flip-btn')

        const refBox = await page.locator('#reference-bottom').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // The floating element should be ABOVE the reference (flipped from bottom to top)
        expect(floatingBox!.y + floatingBox!.height).toBeLessThanOrEqual(refBox!.y + 2)
    })

    test('does not flip when flip is disabled', async ({ page }) => {
        await page.click('#pos-no-flip')

        const refBox = await page.locator('#reference-bottom').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // The floating element should be BELOW the reference (not flipped)
        expect(floatingBox!.y).toBeGreaterThanOrEqual(refBox!.y + refBox!.height - 2)
        await expect(page.locator('#result-placement')).toHaveText('bottom-start')
    })

    test('floating element is visible and positioned', async ({ page }) => {
        await page.click('#pos-bottom-start')

        const floating = page.locator('#floating')
        await expect(floating).toBeVisible()

        // Should have fixed positioning
        const position = await floating.evaluate((el) => getComputedStyle(el).position)
        expect(position).toBe('fixed')
    })
})

test.describe('autoSize option', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
    })

    test('caps height to the space below the reference and adds a scrollbar', async ({ page }) => {
        await page.click('#pos-size-bottom')

        const floating = page.locator('#floating-tall')

        // Inline styles are applied
        const maxHeight = await floating.evaluate((el) => el.style.maxHeight)
        const overflowY = await floating.evaluate((el) => el.style.overflowY)
        expect(maxHeight).toContain('min(')
        expect(maxHeight).toContain('var(--iui-max-height, 100vh)')
        expect(overflowY).toBe('auto')

        // Reference top:300 height:40 → space below ≈ 768 - 340 - 8 = 420
        const { clientHeight, scrollHeight } = await floating.evaluate((el) => ({
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
        }))
        expect(clientHeight).toBeGreaterThan(400)
        expect(clientHeight).toBeLessThan(440)

        // Content (1500px) is taller than the cap → element scrolls
        expect(scrollHeight).toBeGreaterThan(clientHeight)

        // Element stays inside the viewport
        const box = await floating.boundingBox()
        expect(box!.y + box!.height).toBeLessThanOrEqual(768)
    })

    test('shrinks to the small space left below a near-bottom reference', async ({ page }) => {
        await page.click('#pos-size-top')

        const floating = page.locator('#floating-tall')

        const maxHeight = await floating.evaluate((el) => el.style.maxHeight)
        expect(maxHeight).toContain('min(')
        expect(await floating.evaluate((el) => el.style.overflowY)).toBe('auto')

        // Reference sits ~20px from the bottom, so the cap is a small sliver and
        // the tall content scrolls rather than overflowing the viewport.
        const { clientHeight, scrollHeight } = await floating.evaluate((el) => ({
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
        }))
        expect(clientHeight).toBeGreaterThan(0)
        expect(scrollHeight).toBeGreaterThan(clientHeight)

        const box = await floating.boundingBox()
        expect(box!.y + box!.height).toBeLessThanOrEqual(768 + 2)
    })

    test('respects the --iui-max-height CSS variable cap', async ({ page }) => {
        await page.click('#pos-size-cap')

        const floating = page.locator('#floating-tall')
        // var cap (120px) is smaller than the available space → it wins
        const clientHeight = await floating.evaluate((el) => el.clientHeight)
        expect(clientHeight).toBeGreaterThan(110)
        expect(clientHeight).toBeLessThan(130)
    })

    test('leaves height unconstrained when autoSize is not set', async ({ page }) => {
        await page.click('#pos-no-size')

        const floating = page.locator('#floating-tall')
        expect(await floating.evaluate((el) => el.style.maxHeight)).toBe('')
        expect(await floating.evaluate((el) => el.style.overflowY)).toBe('')

        // No clamp → full content height, not scrollable
        const { clientHeight, scrollHeight } = await floating.evaluate((el) => ({
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
        }))
        expect(scrollHeight).toBe(clientHeight)
        expect(clientHeight).toBeGreaterThan(1000)
    })
})

test.describe('autoUpdate', () => {
    test('calls update on scroll and stops after cleanup', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
        await page.click('#start-auto-btn')

        // Wait for initial RAF-batched updates to settle
        await page.waitForTimeout(100)
        const countAfterStart = Number(await page.locator('#auto-update-count').textContent())

        // Scroll to trigger update
        await page.evaluate(() => window.scrollBy(0, 100))
        await page.waitForTimeout(100)
        const countAfterScroll = Number(await page.locator('#auto-update-count').textContent())
        expect(countAfterScroll).toBeGreaterThan(countAfterStart)

        // Stop and scroll again
        await page.click('#stop-auto-btn')
        const countAfterStop = Number(await page.locator('#auto-update-count').textContent())
        await page.evaluate(() => window.scrollBy(0, 100))
        await page.waitForTimeout(100)
        const countAfterSecondScroll = Number(await page.locator('#auto-update-count').textContent())
        expect(countAfterSecondScroll).toBe(countAfterStop)
    })
})

test.describe('positionTopLayerPopover', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
    })

    test('positions a top-layer popover and matches reference width', async ({ page }) => {
        await page.click('#pos-top-layer')

        const refBox = await page.locator('#reference-wide').boundingBox()
        const floatingBox = await page.locator('#top-layer-popover').boundingBox()

        expect(floatingBox!.y).toBeGreaterThanOrEqual(refBox!.y + refBox!.height - 2)
        expect(Math.abs(floatingBox!.x - refBox!.x)).toBeLessThan(5)
        expect(Math.abs(floatingBox!.width - refBox!.width)).toBeLessThan(2)
        await expect(page.locator('#result-placement')).toHaveText('bottom-start')

        await expect(page.locator('#top-layer-popover')).toBeVisible()
        await expect(page.locator('#floating-style-pos')).toHaveText('fixed')
    })

    test('uses CSS anchor positioning for top-layer popovers when available', async ({ page }) => {
        const supported = await page.evaluate(() => (window as any).supportsTopLayerAnchorPositioning())

        test.skip(!supported, 'CSS Anchor Positioning is not available in this browser')

        await page.click('#pos-top-layer')

        const styles = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const reference = document.getElementById('reference-wide') as HTMLElement
            const anchorClass = Array.from(popover.classList).find((className) => className.startsWith('iui-anchor-'))
            const anchorRule = Array.from(document.styleSheets)
                .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
                .find((rule) => (rule as CSSStyleRule).selectorText === `.${anchorClass}`) as CSSStyleRule | undefined

            return {
                anchorName: reference.style.getPropertyValue('anchor-name'),
                positionAnchor: popover.style.getPropertyValue('position-anchor'),
                top: popover.style.top,
                left: popover.style.left,
                width: popover.style.width,
                hasAnchorClass: Boolean(anchorClass),
                anchorRuleText: anchorRule?.cssText ?? '',
            }
        })

        expect(styles.anchorName).toMatch(/^--iui-anchor-/)
        expect(styles.positionAnchor).toBe(styles.anchorName)
        expect(styles.top).toBe('')
        expect(styles.left).toBe('')
        expect(styles.width).toContain('anchor-size(width)')
        expect(styles.hasAnchorClass).toBe(true)
        expect(styles.anchorRuleText).toContain('position-try')
    })

    test('falls back to manual positioning when CSS anchor output still overflows the viewport', async ({ page }) => {
        const supported = await page.evaluate(() => (window as any).supportsTopLayerAnchorPositioning())

        test.skip(!supported, 'CSS Anchor Positioning is not available in this browser')

        await page.click('#pos-top-layer-anchor-overflow')

        const styles = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const reference = document.getElementById('reference-wide') as HTMLElement
            const rect = popover.getBoundingClientRect()

            return {
                anchorName: reference.style.getPropertyValue('anchor-name'),
                positionAnchor: popover.style.getPropertyValue('position-anchor'),
                top: popover.style.top,
                left: popover.style.left,
                transform: getComputedStyle(popover).transform,
                hasAnchorClass: Array.from(popover.classList).some((className) => className.startsWith('iui-anchor-')),
                rect: {
                    top: rect.top,
                    left: rect.left,
                    right: rect.right,
                    bottom: rect.bottom,
                },
            }
        })

        expect(styles.anchorName).toBe('')
        expect(styles.positionAnchor).toBe('')
        expect(styles.top).toMatch(/px$/)
        expect(styles.left).toMatch(/px$/)
        expect(styles.transform).toBe('none')
        expect(styles.hasAnchorClass).toBe(false)
        expect(styles.rect.top).toBeGreaterThanOrEqual(0)
        expect(styles.rect.left).toBeGreaterThanOrEqual(0)
        expect(styles.rect.right).toBeLessThanOrEqual(1024)
        expect(styles.rect.bottom).toBeLessThanOrEqual(768)
        await expect(page.locator('#result-placement')).toHaveText('bottom-start')
    })

    test('uses CSS stretch sizing for top-layer popovers when available', async ({ page }) => {
        const supported = await page.evaluate(
            () =>
                (window as any).supportsTopLayerAnchorPositioning() &&
                CSS.supports('height', 'max-content') &&
                CSS.supports('max-height', 'stretch'),
        )

        test.skip(!supported, 'CSS Anchor Positioning stretch sizing is not available in this browser')

        await page.click('#pos-top-layer')

        const before = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const rect = popover.getBoundingClientRect()

            return {
                height: rect.height,
                inlineMaxHeight: popover.style.maxHeight,
                clientHeight: popover.clientHeight,
                scrollHeight: popover.scrollHeight,
            }
        })

        await page.setViewportSize({ width: 1024, height: 540 })
        await page.waitForTimeout(100)

        const after = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const rect = popover.getBoundingClientRect()

            return {
                height: rect.height,
                inlineMaxHeight: popover.style.maxHeight,
                clientHeight: popover.clientHeight,
                scrollHeight: popover.scrollHeight,
            }
        })

        expect(before.inlineMaxHeight).toBe('')
        expect(after.inlineMaxHeight).toBe('')
        expect(before.scrollHeight).toBeGreaterThan(before.clientHeight)
        expect(after.scrollHeight).toBeGreaterThan(after.clientHeight)
        expect(after.height).toBeLessThan(before.height - 100)
    })

    test('keeps the CSS anchor identity stable across top-layer auto updates', async ({ page }) => {
        const supported = await page.evaluate(() => (window as any).supportsTopLayerAnchorPositioning())

        test.skip(!supported, 'CSS Anchor Positioning is not available in this browser')

        await page.click('#start-top-layer-auto-btn')
        await page.waitForTimeout(100)

        const before = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const reference = document.getElementById('reference-wide') as HTMLElement

            return {
                anchorName: reference.style.getPropertyValue('anchor-name'),
                positionAnchor: popover.style.getPropertyValue('position-anchor'),
                anchorClass: Array.from(popover.classList).find((className) => className.startsWith('iui-anchor-')),
            }
        })

        await page.evaluate(() => window.scrollBy(0, 25))
        await page.waitForTimeout(100)

        const after = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const reference = document.getElementById('reference-wide') as HTMLElement

            return {
                anchorName: reference.style.getPropertyValue('anchor-name'),
                positionAnchor: popover.style.getPropertyValue('position-anchor'),
                anchorClass: Array.from(popover.classList).find((className) => className.startsWith('iui-anchor-')),
            }
        })

        expect(after.anchorName).toBe(before.anchorName)
        expect(after.positionAnchor).toBe(before.positionAnchor)
        expect(after.anchorClass).toBe(before.anchorClass)
    })

    test('keeps the manual top-layer fallback available', async ({ page }) => {
        await page.click('#pos-top-layer-manual')

        const styles = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const reference = document.getElementById('reference-wide') as HTMLElement

            return {
                anchorName: reference.style.getPropertyValue('anchor-name'),
                positionAnchor: popover.style.getPropertyValue('position-anchor'),
                top: popover.style.top,
                left: popover.style.left,
                width: popover.style.width,
                maxHeight: popover.style.maxHeight,
                hasAnchorClass: Array.from(popover.classList).some((className) => className.startsWith('iui-anchor-')),
            }
        })

        expect(styles.anchorName).toBe('')
        expect(styles.positionAnchor).toBe('')
        expect(styles.top).toMatch(/px$/)
        expect(styles.left).toMatch(/px$/)
        expect(styles.width).toMatch(/px$/)
        expect(styles.maxHeight).toMatch(/px$/)
        expect(styles.hasAnchorClass).toBe(false)
    })

    test('applies top-layer offset without matching reference width', async ({ page }) => {
        await page.click('#pos-top-layer-offset')

        const refBox = await page.locator('#reference-wide').boundingBox()
        const floatingBox = await page.locator('#top-layer-popover').boundingBox()

        const gap = floatingBox!.y - (refBox!.y + refBox!.height)
        expect(gap).toBeGreaterThanOrEqual(10)
        expect(gap).toBeLessThanOrEqual(14)
        expect(Math.abs(floatingBox!.width - refBox!.width)).toBeGreaterThan(20)
        expect(floatingBox!.x).toBeGreaterThanOrEqual(16)
        await expect(page.locator('#result-placement')).toHaveText('bottom-start')
    })

    test('keeps a top-layer popover below the reference when flip is disabled', async ({ page }) => {
        await page.click('#pos-top-layer-no-flip')

        const refBox = await page.locator('#reference-bottom').boundingBox()
        const floatingBox = await page.locator('#top-layer-popover').boundingBox()
        const maxHeight = await page.locator('#top-layer-popover').evaluate((el) => (el as HTMLElement).style.maxHeight)

        expect(floatingBox!.y).toBeGreaterThanOrEqual(refBox!.y + refBox!.height - 2)
        expect(maxHeight).toMatch(/px$/)
        await expect(page.locator('#result-placement')).toHaveText('bottom-start')
    })

    test('flips a tall top-layer popover and constrains height to available space', async ({ page }) => {
        const usesStretchSizing = await page.evaluate(
            () =>
                (window as any).supportsTopLayerAnchorPositioning() &&
                CSS.supports('height', 'max-content') &&
                CSS.supports('max-height', 'stretch'),
        )

        await page.click('#pos-top-layer-flip')

        const refBox = await page.locator('#reference-bottom').boundingBox()
        const floatingBox = await page.locator('#top-layer-popover').boundingBox()

        expect(floatingBox!.y + floatingBox!.height).toBeLessThanOrEqual(refBox!.y + 2)
        await expect(page.locator('#result-placement')).toHaveText('top-start')

        const { clientHeight, scrollHeight, maxHeight } = await page.locator('#top-layer-popover').evaluate((el) => ({
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
            maxHeight: (el as HTMLElement).style.maxHeight,
        }))
        if (usesStretchSizing) {
            expect(maxHeight).toBe('')
        } else {
            expect(maxHeight).toContain('px')
        }
        expect(scrollHeight).toBeGreaterThan(clientHeight)
        expect(floatingBox!.y).toBeGreaterThanOrEqual(8)
    })

    test('lets CSS-anchored top-layer popovers follow scroll without JS scroll updates', async ({ page }) => {
        const usesCssAnchorPositioning = await page.evaluate(() => (window as any).supportsTopLayerAnchorPositioning())

        await page.click('#start-top-layer-auto-btn')

        await page.waitForTimeout(100)
        const countAfterStart = Number(await page.locator('#top-layer-auto-update-count').textContent())

        await page.evaluate(() => window.scrollBy(0, 100))
        await page.waitForTimeout(100)
        const countAfterScroll = Number(await page.locator('#top-layer-auto-update-count').textContent())
        if (usesCssAnchorPositioning) {
            expect(countAfterScroll).toBe(countAfterStart)
        } else {
            expect(countAfterScroll).toBeGreaterThan(countAfterStart)
        }

        await page.evaluate(() => document.getElementById('stop-top-layer-auto-btn')?.click())
        const countAfterStop = Number(await page.locator('#top-layer-auto-update-count').textContent())
        await page.evaluate(() => window.scrollBy(0, 100))
        await page.waitForTimeout(100)
        const countAfterSecondScroll = Number(await page.locator('#top-layer-auto-update-count').textContent())
        expect(countAfterSecondScroll).toBe(countAfterStop)
    })

    test('auto-updates manual top-layer fallback popovers and stops after cleanup', async ({ page }) => {
        await page.click('#start-top-layer-auto-manual-btn')

        await page.waitForTimeout(100)
        const countAfterStart = Number(await page.locator('#top-layer-auto-update-count').textContent())

        await page.evaluate(() => window.scrollBy(0, 100))
        await page.waitForTimeout(100)
        const countAfterScroll = Number(await page.locator('#top-layer-auto-update-count').textContent())
        expect(countAfterScroll).toBeGreaterThan(countAfterStart)

        await page.evaluate(() => document.getElementById('stop-top-layer-auto-btn')?.click())
        const countAfterStop = Number(await page.locator('#top-layer-auto-update-count').textContent())
        await page.evaluate(() => window.scrollBy(0, 100))
        await page.waitForTimeout(100)
        const countAfterSecondScroll = Number(await page.locator('#top-layer-auto-update-count').textContent())
        expect(countAfterSecondScroll).toBe(countAfterStop)
    })

    test('parks a CSS-anchored top-layer popover when the reference scrolls out of view', async ({ page }) => {
        const usesCssAnchorPositioning = await page.evaluate(() => (window as any).supportsTopLayerAnchorPositioning())

        test.skip(!usesCssAnchorPositioning, 'CSS Anchor Positioning is not available in this browser')

        await page.click('#start-top-layer-auto-btn')
        await page.waitForTimeout(100)
        const before = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const reference = document.getElementById('reference-wide') as HTMLElement

            return {
                anchorName: reference.style.getPropertyValue('anchor-name'),
                positionAnchor: popover.style.getPropertyValue('position-anchor'),
                hasAnchorClass: Array.from(popover.classList).some((className) => className.startsWith('iui-anchor-')),
            }
        })
        const countAfterStart = Number(await page.locator('#top-layer-auto-update-count').textContent())

        await page.evaluate(() => window.scrollBy(0, 700))
        await page.waitForTimeout(100)

        const refBox = await page.locator('#reference-wide').boundingBox()
        const parked = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const reference = document.getElementById('reference-wide') as HTMLElement

            return {
                anchorName: reference.style.getPropertyValue('anchor-name'),
                positionAnchor: popover.style.getPropertyValue('position-anchor'),
                visibility: popover.style.visibility,
                hasAnchorClass: Array.from(popover.classList).some((className) => className.startsWith('iui-anchor-')),
            }
        })
        const countAfterPark = Number(await page.locator('#top-layer-auto-update-count').textContent())

        expect(refBox!.y + refBox!.height).toBeLessThan(0)
        expect(before.anchorName).toMatch(/^--iui-anchor-/)
        expect(before.positionAnchor).toBe(before.anchorName)
        expect(before.hasAnchorClass).toBe(true)
        expect(parked.anchorName).toBe(before.anchorName)
        expect(parked.positionAnchor).toBe(before.positionAnchor)
        expect(parked.visibility).toBe('hidden')
        expect(parked.hasAnchorClass).toBe(true)
        expect(countAfterPark).toBe(countAfterStart)

        await page.evaluate(() => window.scrollBy(0, -700))
        await page.waitForTimeout(100)

        const restored = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const reference = document.getElementById('reference-wide') as HTMLElement

            return {
                anchorName: reference.style.getPropertyValue('anchor-name'),
                positionAnchor: popover.style.getPropertyValue('position-anchor'),
                visibility: popover.style.visibility,
                hasAnchorClass: Array.from(popover.classList).some((className) => className.startsWith('iui-anchor-')),
            }
        })
        const countAfterRestore = Number(await page.locator('#top-layer-auto-update-count').textContent())

        expect(restored.anchorName).toBe(before.anchorName)
        expect(restored.positionAnchor).toBe(before.positionAnchor)
        expect(restored.visibility).toBe('')
        expect(restored.hasAnchorClass).toBe(true)
        expect(countAfterRestore).toBeGreaterThanOrEqual(countAfterPark)
    })
})

test.describe('Safari top-layer popover positioning', () => {
    test.use({
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
    })

    test('uses the manual top-layer fallback for Safari user agents', async ({ page }) => {
        await page.addInitScript(() => {
            const originalSupports = CSS.supports.bind(CSS)

            Object.defineProperty(CSS, 'supports', {
                configurable: true,
                value: (property: string, value?: string) => {
                    if (property === '-webkit-backdrop-filter' && value === 'none') {
                        return true
                    }

                    return value === undefined ? originalSupports(property) : originalSupports(property, value)
                },
            })
        })
        await page.reload()
        await page.setViewportSize({ width: 1024, height: 768 })
        await page.click('#pos-top-layer')

        const styles = await page.locator('#top-layer-popover').evaluate((el) => {
            const popover = el as HTMLElement
            const reference = document.getElementById('reference-wide') as HTMLElement

            return {
                anchorName: reference.style.getPropertyValue('anchor-name'),
                positionAnchor: popover.style.getPropertyValue('position-anchor'),
                top: popover.style.top,
                left: popover.style.left,
                width: popover.style.width,
                hasAnchorClass: Array.from(popover.classList).some((className) => className.startsWith('iui-anchor-')),
            }
        })

        expect(styles.anchorName).toBe('')
        expect(styles.positionAnchor).toBe('')
        expect(styles.top).toMatch(/px$/)
        expect(styles.left).toMatch(/px$/)
        expect(styles.width).toMatch(/px$/)
        expect(styles.hasAnchorClass).toBe(false)
    })
})

for (const path of ['computePosition', 'top layer with anchors', 'top layer without anchors'] as const) {
    test(`aligns start and end to the reference's writing direction (${path})`, async ({ page }) => {
        const results = await page.evaluate(async (path) => {
            const modulePath = '/src/index.ts'
            const { computePosition, positionTopLayerPopover } = await import(modulePath)
            const results: Record<string, string> = {}

            for (const [documentDir, referenceDir] of [
                ['ltr', 'ltr'],
                ['ltr', 'rtl'],
                ['rtl', 'rtl'],
                ['rtl', 'ltr'],
            ]) {
                for (const placement of ['bottom-start', 'bottom-end'] as const) {
                    document.documentElement.dir = documentDir
                    const wrapper = document.createElement('div')
                    const reference = document.createElement('button')
                    const floating = document.createElement('div')
                    wrapper.dir = referenceDir
                    reference.style.cssText = 'position:fixed;left:300px;top:100px;width:200px;height:30px'
                    floating.style.cssText = 'width:80px;height:40px;margin:0;padding:0;border:0'
                    wrapper.append(reference)
                    document.body.append(wrapper, floating)

                    if (path === 'computePosition') {
                        computePosition(reference, floating, { placement })
                    } else {
                        floating.setAttribute('popover', 'manual')
                        floating.showPopover()
                        positionTopLayerPopover(reference, floating, {
                            placement,
                            anchorPositioning: path === 'top layer with anchors',
                        })
                    }

                    const panel = floating.getBoundingClientRect()
                    const anchor = reference.getBoundingClientRect()
                    results[`${documentDir} ${referenceDir} ${placement}`] =
                        Math.abs(panel.left - anchor.left) < 1
                            ? 'left'
                            : Math.abs(panel.right - anchor.right) < 1
                              ? 'right'
                              : `${panel.left}`
                    wrapper.remove()
                    floating.remove()
                }
            }
            document.documentElement.dir = ''

            return results
        }, path)

        expect(results).toEqual({
            'ltr ltr bottom-start': 'left',
            'ltr ltr bottom-end': 'right',
            'ltr rtl bottom-start': 'right',
            'ltr rtl bottom-end': 'left',
            'rtl rtl bottom-start': 'right',
            'rtl rtl bottom-end': 'left',
            'rtl ltr bottom-start': 'left',
            'rtl ltr bottom-end': 'right',
        })
    })
}

test('switches between CSS anchors and numeric positioning without retaining old styles', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const modulePath = '/src/index.ts'
        const { computePosition } = await import(modulePath)
        const reference = document.createElement('button')
        const floating = document.createElement('div')
        reference.style.cssText = 'position:fixed;left:400px;top:300px;width:100px;height:30px'
        floating.style.cssText = 'width:160px;height:40px;margin:0;padding:0;border:0'
        document.body.append(reference, floating)
        computePosition(reference, floating, { placement: 'top' })
        computePosition(reference, floating, { placement: 'top', anchorPositioning: false })
        const numeric = floating.getBoundingClientRect().toJSON()
        computePosition(reference, floating, { placement: 'top-start' })
        const anchored = floating.getBoundingClientRect().toJSON()
        reference.remove()
        floating.remove()
        return { numeric, anchored }
    })
    expect(result.numeric.x).toBeCloseTo(370, 0)
    expect(result.numeric.y).toBeCloseTo(260, 0)
    expect(result.anchored.x).toBeCloseTo(400, 0)
    expect(result.anchored.y).toBeCloseTo(260, 0)
})

for (const switchFromAnchors of [false, true]) {
    test(`measures auto-width content in fixed positioning (switch from anchors: ${switchFromAnchors})`, async ({
        page,
    }) => {
        const result = await page.evaluate(async (switchFromAnchors) => {
            const modulePath = '/src/index.ts'
            const { computePosition } = await import(modulePath)
            const reference = document.createElement('button')
            const floating = document.createElement('div')
            reference.style.cssText = 'position:fixed;left:400px;top:300px;width:100px;height:30px'
            floating.style.cssText = 'max-width:180px;margin:0;padding:8px;border:0;box-sizing:border-box'
            floating.textContent = 'Short tooltip'
            document.body.append(reference, floating)
            if (switchFromAnchors) {
                computePosition(reference, floating, { placement: 'top', flip: false })
            }
            computePosition(reference, floating, { placement: 'top', offset: 6, anchorPositioning: false })
            const rect = floating.getBoundingClientRect()
            const result = { center: rect.left + rect.width / 2, bottom: rect.bottom, width: rect.width }
            reference.remove()
            floating.remove()
            return result
        }, switchFromAnchors)
        expect(result.width).toBeLessThan(180)
        expect(result.center).toBeCloseTo(450, 0)
        expect(result.bottom).toBeCloseTo(294, 0)
    })
}

test('keeps numeric positioning stable while the floating element scales', async ({ page }) => {
    const positions = await page.evaluate(async () => {
        const modulePath = '/src/index.ts'
        const { computePosition } = await import(modulePath)
        const reference = document.createElement('button')
        const floating = document.createElement('div')
        reference.style.cssText = 'position:fixed;left:400px;top:300px;width:100px;height:30px'
        floating.style.cssText = 'width:164px;height:28px;margin:0;padding:0;border:0'
        document.body.append(reference, floating)
        const positions = [1, 0.95, 0.98, 1].map((scale) => {
            floating.style.transform = `scale(${scale})`
            computePosition(reference, floating, { placement: 'top', offset: 6, anchorPositioning: false })
            const rect = floating.getBoundingClientRect()
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        })
        reference.remove()
        floating.remove()
        return positions
    })
    for (const position of positions) {
        expect(position.x).toBeCloseTo(450, 1)
        expect(position.y).toBeCloseTo(280, 1)
    }
})
