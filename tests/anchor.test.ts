import { cleanupAnchorPositioning, setupTopLayerAnchorPositioning } from '../src/position/anchor'
import type { Placement } from '../src/position/types'

describe('computePosition anchor rules', () => {
    let reference: HTMLElement
    let floating: HTMLElement
    let computePosition: typeof import('../src/position').computePosition
    const sheet = () => (document.getElementById('inertiaui-anchor-styles') as HTMLStyleElement).sheet!
    const defaults = { placement: 'bottom-start' as Placement, offset: 4, flip: true }

    beforeEach(async () => {
        vi.resetModules()
        vi.stubGlobal('CSS', { supports: () => true })
        ;({ computePosition } = await import('../src/position'))
        reference = document.createElement('button')
        floating = document.createElement('div')
        document.body.append(reference, floating)
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        document.body.innerHTML = ''
        document.getElementById('inertiaui-anchor-styles')?.remove()
    })

    it.each([
        [{ placement: 'top-end' as Placement, offset: 20 }, 'margin-bottom: 20px'],
        [{ offset: 20 }, 'margin-top: 20px'],
        [{ flip: false }, ''],
    ])('updates changed options and reuses the updated rule: %j', (options, expected) => {
        computePosition(reference, floating, defaults)
        const original = sheet().cssRules[0]
        const result = computePosition(reference, floating, { ...defaults, ...options })
        expect(result.placement).toBe(options.placement ?? defaults.placement)
        expect(sheet().cssRules).toHaveLength(1)
        expect(sheet().cssRules[0]).not.toBe(original)
        expect(sheet().cssRules[0].cssText).toContain(expected)
        if (options.flip === false) expect(sheet().cssRules[0].cssText).not.toContain('position-try')
        const changed = sheet().cssRules[0]
        const insert = vi.spyOn(sheet(), 'insertRule')
        const remove = vi.spyOn(sheet(), 'deleteRule')
        computePosition(reference, floating, { ...defaults, ...options })
        expect(sheet().cssRules[0]).toBe(changed)
        expect(insert).not.toHaveBeenCalled()
        expect(remove).not.toHaveBeenCalled()
    })

    it('updates when the reference direction changes', () => {
        computePosition(reference, floating, defaults)
        const insert = vi.spyOn(sheet(), 'insertRule')
        reference.style.direction = 'rtl'
        computePosition(reference, floating, defaults)
        // Happy DOM drops anchor() values from CSSOM, so inspect the inserted source.
        expect(insert).toHaveBeenCalledWith(expect.stringContaining('right: anchor(right)'), 0)
    })

    it('moves the anchor to a replacement reference and cleans up for numeric positioning', () => {
        computePosition(reference, floating, defaults)
        const replacement = document.createElement('button')
        document.body.insertBefore(replacement, floating)
        computePosition(replacement, floating, defaults)
        expect(reference.style.getPropertyValue('anchor-name')).toBe('')
        expect(replacement.style.getPropertyValue('anchor-name')).toBe(
            floating.style.getPropertyValue('position-anchor'),
        )
        expect(sheet().cssRules).toHaveLength(1)
        computePosition(replacement, floating, { ...defaults, anchorPositioning: false })
        expect(sheet().cssRules).toHaveLength(0)
        expect(replacement.style.getPropertyValue('anchor-name')).toBe('')
        computePosition(replacement, floating, defaults)
        expect(sheet().cssRules).toHaveLength(1)
    })

    it('does not rewrite unchanged rules or attributes', () => {
        computePosition(reference, floating, defaults)
        const insert = vi.spyOn(sheet(), 'insertRule')
        const remove = vi.spyOn(sheet(), 'deleteRule')
        const observer = new MutationObserver(() => {})
        observer.observe(reference, { attributes: true })
        observer.observe(floating, { attributes: true })
        for (let i = 0; i < 10; i++) computePosition(reference, floating, defaults)
        const mutations = observer.takeRecords()
        observer.disconnect()
        expect(insert).not.toHaveBeenCalled()
        expect(remove).not.toHaveBeenCalled()
        expect(mutations).toHaveLength(0)
    })

    it('repairs edited, removed and replaced stylesheet rules', () => {
        computePosition(reference, floating, defaults)
        const original = sheet().cssRules[0].cssText
        ;(sheet().cssRules[0] as CSSStyleRule).style.setProperty('margin-top', '999px')
        computePosition(reference, floating, defaults)
        expect(sheet().cssRules[0].cssText).toBe(original)
        sheet().deleteRule(0)
        computePosition(reference, floating, defaults)
        expect(sheet().cssRules[0].cssText).toBe(original)
        document.getElementById('inertiaui-anchor-styles')!.remove()
        computePosition(reference, floating, defaults)
        expect(sheet().cssRules[0].cssText).toBe(original)
    })
})

describe('top-layer anchor rules', () => {
    let reference: HTMLElement
    let floating: HTMLElement
    const defaults = {
        placement: 'bottom-start' as Placement,
        offset: 4,
        flip: true,
        matchWidth: true,
        maxWidth: 600,
        margin: 8,
        stretch: true,
    }
    const position = (options: Partial<typeof defaults> = {}) => {
        const settings = { ...defaults, ...options }
        return setupTopLayerAnchorPositioning(
            reference,
            floating,
            settings.placement,
            settings.offset,
            settings.flip,
            settings.matchWidth,
            settings.maxWidth,
            settings.margin,
            settings.stretch,
        )
    }
    const sheet = () => (document.getElementById('inertiaui-anchor-styles') as HTMLStyleElement).sheet!

    beforeEach(() => {
        reference = document.createElement('button')
        floating = document.createElement('div')
        document.body.append(reference, floating)
    })
    afterEach(() => {
        vi.restoreAllMocks()
        document.body.innerHTML = ''
        document.getElementById('inertiaui-anchor-styles')?.remove()
    })

    it('does not rewrite unchanged anchor rules or attributes', () => {
        const name = position({ matchWidth: false })
        const original = sheet().cssRules[0]
        const insert = vi.spyOn(sheet(), 'insertRule')
        const remove = vi.spyOn(sheet(), 'deleteRule')
        const observer = new MutationObserver(() => {})
        observer.observe(reference, { attributes: true })
        observer.observe(floating, { attributes: true })
        for (let i = 0; i < 10; i++) expect(position({ matchWidth: false })).toBe(name)
        const mutations = observer.takeRecords()
        observer.disconnect()
        expect(sheet().cssRules[0]).toBe(original)
        expect(insert).not.toHaveBeenCalled()
        expect(remove).not.toHaveBeenCalled()
        expect(mutations).toHaveLength(0)
    })

    it.each([
        { placement: 'top-end' as Placement },
        { offset: 12 },
        { flip: false },
        { matchWidth: false },
        { maxWidth: 300 },
        { margin: 20 },
        { stretch: false },
    ])('rebuilds the rule when its options change: %j', (options) => {
        const name = position()
        const original = sheet().cssRules[0]
        expect(position(options)).toBe(name)
        expect(sheet().cssRules).toHaveLength(1)
        expect(sheet().cssRules[0]).not.toBe(original)
        const changed = sheet().cssRules[0]
        position(options)
        expect(sheet().cssRules[0]).toBe(changed)
    })

    it('repairs an externally edited or removed rule and a replaced stylesheet', () => {
        const name = position()
        const originalText = sheet().cssRules[0].cssText
        ;(sheet().cssRules[0] as CSSStyleRule).style.setProperty('margin-top', '999px')
        position()
        expect(sheet().cssRules[0].cssText).toBe(originalText)
        sheet().deleteRule(0)
        expect(position()).toBe(name)
        expect(sheet().cssRules[0].cssText).toBe(originalText)
        document.getElementById('inertiaui-anchor-styles')!.remove()
        expect(position()).toBe(name)
        expect(sheet().cssRules[0].cssText).toBe(originalText)
    })

    it('keeps another popover rule reusable when cleanup changes its index', () => {
        const firstReference = reference
        const firstFloating = floating
        const firstName = position()
        reference = document.createElement('button')
        floating = document.createElement('div')
        document.body.append(reference, floating)
        const secondName = position()
        const secondRule = sheet().cssRules[1]
        cleanupAnchorPositioning(firstReference, firstFloating, firstName)
        expect(position()).toBe(secondName)
        expect(sheet().cssRules).toHaveLength(1)
        expect(sheet().cssRules[0]).toBe(secondRule)
        cleanupAnchorPositioning(reference, floating, secondName)
        expect(sheet().cssRules).toHaveLength(0)
        expect(reference.style.getPropertyValue('anchor-name')).toBe('')
        expect(floating.style.getPropertyValue('position-anchor')).toBe('')
        expect(position()).not.toBe(secondName)
        expect(sheet().cssRules).toHaveLength(1)
    })
})
