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

describe.each(['generic', 'top-layer', 'mixed'] as const)('shared reference anchors (%s)', (mode) => {
    let reference: HTMLElement
    let panels: HTMLElement[]
    let anchor: typeof import('../src/position/anchor')
    let positioning: typeof import('../src/position')
    const sheet = () => (document.getElementById('inertiaui-anchor-styles') as HTMLStyleElement).sheet!
    const position = (index: number, target = reference, numeric = false) => {
        const topLayer = mode === 'top-layer' || (mode === 'mixed' && index === 1)
        const fn = topLayer ? positioning.positionTopLayerPopover : positioning.computePosition
        fn(target, panels[index], { placement: 'bottom-start', flip: false, anchorPositioning: !numeric })
        return anchor.findAnchorClass(panels[index])!
    }
    const names = () =>
        reference.style
            .getPropertyValue('anchor-name')
            .split(',')
            .map((name) => name.trim())

    beforeEach(async () => {
        vi.resetModules()
        vi.stubGlobal('CSS', { supports: (property: string) => property !== '-webkit-backdrop-filter' })
        anchor = await import('../src/position/anchor')
        positioning = await import('../src/position')
        reference = document.createElement('button')
        panels = [document.createElement('div'), document.createElement('div')]
        document.body.append(reference, ...panels)
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        document.body.innerHTML = ''
        document.getElementById('inertiaui-anchor-styles')?.remove()
    })

    it.each([0, 1])('keeps both panels and consumer names through cleanup order %s', (first) => {
        reference.style.setProperty('anchor-name', '--consumer, --other', 'important')
        const classes = [position(0), position(1)]
        expect(names()).toEqual(['--consumer', '--other', ...classes.map((name) => `--${name}`)])
        expect(reference.style.getPropertyPriority('anchor-name')).toBe('important')
        const rules = Array.from(sheet().cssRules)
        const observer = new MutationObserver(() => {})
        observer.observe(reference, { attributes: true })
        observer.observe(panels[0], { attributes: true })
        observer.observe(panels[1], { attributes: true })
        for (let i = 0; i < 3; i++) {
            expect(position(0)).toBe(classes[0])
            expect(position(1)).toBe(classes[1])
        }
        expect(observer.takeRecords()).toHaveLength(0)
        observer.disconnect()
        rules.forEach((rule, index) => expect(sheet().cssRules[index]).toBe(rule))
        anchor.cleanupAnchorPositioning(reference, panels[first], classes[first])
        expect(names()).toEqual(['--consumer', '--other', `--${classes[1 - first]}`])
        expect(sheet().cssRules[0]).toBe(rules[1 - first])
        expect(position(1 - first)).toBe(classes[1 - first])
        anchor.detachAnchorPositioning(reference, panels[1 - first])
        expect(reference.style.getPropertyValue('anchor-name')).toBe('--consumer, --other')
        expect(reference.style.getPropertyPriority('anchor-name')).toBe('important')
        expect(sheet().cssRules).toHaveLength(0)
    })

    it.each([false, true])('releases the actual old reference when switching references (numeric=%s)', (numeric) => {
        const classes = [position(0), position(1)]
        const replacement = document.createElement('button')
        replacement.style.setProperty('anchor-name', '--replacement', 'important')
        document.body.prepend(replacement)
        position(0, replacement, numeric)
        expect(names()).toEqual([`--${classes[1]}`])
        expect(replacement.style.getPropertyValue('anchor-name')).toContain('--replacement')
        expect(replacement.style.getPropertyPriority('anchor-name')).toBe('important')
        // Cleanup may still receive the reference captured by autoUpdate.
        anchor.detachAnchorPositioning(reference, panels[0])
        expect(replacement.style.getPropertyValue('anchor-name')).toBe('--replacement')
        expect(names()).toEqual([`--${classes[1]}`])
        position(1, reference, true)
        expect(reference.style.getPropertyValue('anchor-name')).toBe('')
    })

    it('leaves the other panel anchored during numeric fallback and repeated detach', () => {
        const classes = [position(0), position(1)]
        position(0, reference, true)
        anchor.detachAnchorPositioning(reference, panels[0])
        expect(names()).toEqual([`--${classes[1]}`])
        expect(position(1)).toBe(classes[1])
        position(1, reference, true)
        expect(reference.style.getPropertyValue('anchor-name')).toBe('')
        expect(sheet().cssRules).toHaveLength(0)
    })

    it('preserves consumer changes made while panels are anchored', () => {
        const classes = [position(0), position(1)]
        reference.style.setProperty('anchor-name', `${names().join(', ')}, --added`, 'important')
        position(0)
        anchor.detachAnchorPositioning(reference, panels[0])
        expect(names()).toEqual([`--${classes[1]}`, '--added'])
        anchor.detachAnchorPositioning(reference, panels[1])
        expect(reference.style.getPropertyValue('anchor-name')).toBe('--added')
        expect(reference.style.getPropertyPriority('anchor-name')).toBe('important')
    })

    it('restores an explicit none declaration and its priority', () => {
        reference.style.setProperty('anchor-name', 'none', 'important')
        position(0)
        position(1)
        anchor.detachAnchorPositioning(reference, panels[0])
        anchor.detachAnchorPositioning(reference, panels[1])
        expect(reference.style.getPropertyValue('anchor-name')).toBe('none')
        expect(reference.style.getPropertyPriority('anchor-name')).toBe('important')
    })
})
