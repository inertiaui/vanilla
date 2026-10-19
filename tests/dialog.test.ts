import { createFocusTrap, lockScroll, markAriaHidden, markInert } from '../src/dialog'

describe('dialog accessibility state', () => {
    afterEach(() => {
        document.body.innerHTML = ''
        vi.restoreAllMocks()
    })

    it.each([null, 'false', 'true'])(
        'restores the original aria-hidden value %j after overlapping marks',
        (original) => {
            const first = document.createElement('div')
            const second = document.createElement('div')
            if (original !== null) first.setAttribute('aria-hidden', original)
            second.setAttribute('aria-hidden', 'false')
            first.id = 'marked-element'
            document.body.append(first, second)
            const releaseFirst = markAriaHidden(first)
            const releaseSecond = markAriaHidden(second)
            const releaseNested = markAriaHidden('#marked-element')
            releaseFirst()
            releaseFirst()
            expect(first.getAttribute('aria-hidden')).toBe('true')
            releaseSecond()
            expect(second.getAttribute('aria-hidden')).toBe('false')
            first.remove()
            releaseNested()
            expect(first.getAttribute('aria-hidden')).toBe(original)
            first.setAttribute('aria-hidden', 'changed')
            const releaseAgain = markAriaHidden(first)
            releaseNested()
            expect(first.getAttribute('aria-hidden')).toBe('true')
            releaseAgain()
            expect(first.getAttribute('aria-hidden')).toBe('changed')
        },
    )

    it.each([false, true])('restores native inert=%j independently for multiple elements', (original) => {
        const first = document.createElement('div')
        const second = document.createElement('div')
        first.inert = original
        first.setAttribute('aria-hidden', 'false')
        document.body.append(first, second)
        const releaseFirst = markInert(first)
        const releaseNested = markInert(first)
        const releaseSecond = markInert(second)
        expect(first.inert).toBe(true)
        expect(second.inert).toBe(true)
        expect(first.getAttribute('aria-hidden')).toBe('false')
        releaseNested()
        releaseNested()
        expect(first.inert).toBe(true)
        releaseSecond()
        expect(second.inert).toBe(false)
        first.remove()
        releaseFirst()
        expect(first.inert).toBe(original)
        expect(first.getAttribute('aria-hidden')).toBe('false')
        first.inert = !original
        const releaseAgain = markInert(first)
        releaseFirst()
        expect(first.inert).toBe(true)
        releaseAgain()
        expect(first.inert).toBe(!original)
    })

    it('reference-counts and restores aria-hidden when native inert is unavailable', () => {
        // Hide the native property through a proxy without changing global DOM prototypes.
        const element = document.createElement('div')
        element.setAttribute('aria-hidden', 'false')
        const fallback = new Proxy(element, {
            has(target, key) {
                return key === 'inert' ? false : Reflect.has(target, key)
            },
            get(target, key) {
                const value = Reflect.get(target, key, target)
                return typeof value === 'function' ? value.bind(target) : value
            },
        })
        const first = markInert(fallback)
        const second = markInert(fallback)
        expect(element.getAttribute('aria-hidden')).toBe('true')
        first()
        first()
        expect(element.getAttribute('aria-hidden')).toBe('true')
        second()
        expect(element.getAttribute('aria-hidden')).toBe('false')
    })

    it('allows repeated cleanup for missing selectors', () => {
        for (const mark of [markAriaHidden, markInert]) {
            const release = mark('#missing-element')
            release()
            release()
        }
    })

    describe.each([true, false])('overlapping marks with native inert=%s', (nativeInert) => {
        describe.each([true, false])('acquire aria-hidden first=%s', (ariaFirst) => {
            describe.each([true, false])('release aria-hidden first=%s', (releaseAriaFirst) => {
                it.each([null, 'false', 'true'])('restores original aria-hidden=%j', (original) => {
                    const target = document.createElement('div')
                    if (original !== null) target.setAttribute('aria-hidden', original)
                    const element = nativeInert
                        ? target
                        : new Proxy(target, {
                              has(target, key) {
                                  return key === 'inert' ? false : Reflect.has(target, key)
                              },
                              get(target, key) {
                                  const value = Reflect.get(target, key, target)
                                  return typeof value === 'function' ? value.bind(target) : value
                              },
                          })
                    expect('inert' in element).toBe(nativeInert)
                    const releaseFirst = (ariaFirst ? markAriaHidden : markInert)(element)
                    const releaseSecond = (ariaFirst ? markInert : markAriaHidden)(element)
                    const releaseAria = ariaFirst ? releaseFirst : releaseSecond
                    const releaseInert = ariaFirst ? releaseSecond : releaseFirst
                    const releaseNestedAria = markAriaHidden(element)
                    const releaseNestedInert = markInert(element)

                    releaseNestedAria()
                    releaseNestedAria()
                    releaseNestedInert()
                    releaseNestedInert()
                    expect.soft(target.getAttribute('aria-hidden')).toBe('true')
                    if (nativeInert) expect.soft(target.inert).toBe(true)

                    const releaseEarlier = releaseAriaFirst ? releaseAria : releaseInert
                    const releaseLater = releaseAriaFirst ? releaseInert : releaseAria
                    releaseEarlier()
                    releaseEarlier()
                    expect
                        .soft(target.getAttribute('aria-hidden'))
                        .toBe(releaseAriaFirst && nativeInert ? original : 'true')
                    if (nativeInert) expect.soft(target.inert).toBe(releaseAriaFirst)

                    releaseLater()
                    releaseLater()
                    expect.soft(target.getAttribute('aria-hidden')).toBe(original)
                    if (nativeInert) expect.soft(target.inert).toBe(false)
                })
            })
        })
    })
})

describe('focus trap recovery', () => {
    let cleanup: (() => void) | undefined
    afterEach(() => {
        cleanup?.()
        cleanup = undefined
        document.body.innerHTML = ''
        vi.restoreAllMocks()
    })

    it('finds the first eligible control without enumerating the remaining controls', () => {
        const container = document.createElement('div')
        container.innerHTML = '<input aria-hidden="true"><input disabled><button>First</button><input>'
        const outside = document.createElement('button')
        document.body.append(container, outside)
        cleanup = createFocusTrap(container, { initialFocus: false, returnFocus: false })
        const queries = vi.spyOn(container, 'querySelectorAll')
        outside.focus()
        expect(document.activeElement).toBe(container.children[2])
        expect(queries).not.toHaveBeenCalled()
    })

    it('uses current controls and attributes after the dialog changes', () => {
        const container = document.createElement('div')
        container.innerHTML = '<button>First</button><input><a href="#">Last</a>'
        const outside = document.createElement('button')
        document.body.append(container, outside)
        cleanup = createFocusTrap(container, { initialFocus: false, returnFocus: false })
        outside.focus()
        expect(document.activeElement).toBe(container.firstElementChild)
        container.firstElementChild!.setAttribute('aria-hidden', 'true')
        outside.focus()
        expect(document.activeElement).toBe(container.children[1])
        container.children[1].setAttribute('disabled', '')
        outside.focus()
        expect(document.activeElement).toBe(container.lastElementChild)
        container.lastElementChild!.remove()
        const replacement = document.createElement('textarea')
        container.prepend(replacement)
        outside.focus()
        expect(document.activeElement).toBe(replacement)
    })

    it.each([false, true])(
        'leaves interior navigation native without enumerating every control (backward=%s)',
        (shiftKey) => {
            const container = document.createElement('div')
            container.innerHTML = '<input><input><input>'
            document.body.append(container)
            cleanup = createFocusTrap(container, { initialFocus: false, returnFocus: false })
            const middle = container.children[1] as HTMLElement
            middle.focus()
            const queries = vi.spyOn(container, 'querySelectorAll')
            const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
            middle.dispatchEvent(event)
            expect(event.defaultPrevented).toBe(false)
            expect(document.activeElement).toBe(middle)
            expect(queries).not.toHaveBeenCalled()
            container.firstElementChild!.remove()
            middle.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
            )
            expect(document.activeElement).toBe(container.lastElementChild)
        },
    )

    it('enters a trap from outside without enumerating controls on forward Tab', () => {
        const container = document.createElement('div')
        container.innerHTML = '<input disabled><input><input>'
        document.body.append(container)
        cleanup = createFocusTrap(container, { initialFocus: false, returnFocus: false })
        const queries = vi.spyOn(container, 'querySelectorAll')
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        document.body.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(true)
        expect(document.activeElement).toBe(container.children[1])
        expect(queries).not.toHaveBeenCalled()
    })

    it.each([0, 80])('finds the last control in document order with %s trailing decorations', (tail) => {
        const container = document.createElement('div')
        container.tabIndex = 0
        container.innerHTML =
            '<input><section tabindex="0"><input><div><textarea></textarea><span>Label</span></div></section>' +
            '<aside><input disabled><input aria-hidden="true"></aside>' +
            '<footer>' +
            '<span>Decoration</span>'.repeat(tail) +
            '</footer>'
        document.body.append(container)
        cleanup = createFocusTrap(container, { initialFocus: false, returnFocus: false })
        const first = container.firstElementChild as HTMLElement
        const last = container.querySelector('textarea')!
        const tab = (shiftKey: boolean) => {
            const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
            document.activeElement!.dispatchEvent(event)
            expect(event.defaultPrevented).toBe(true)
        }
        first.focus()
        tab(true)
        expect(document.activeElement).toBe(last)
        tab(false)
        expect(document.activeElement).toBe(first)
        last.disabled = true
        tab(true)
        expect(document.activeElement).toBe(container.querySelector('section input'))
        container.querySelector('section input')!.remove()
        first.focus()
        tab(true)
        expect(document.activeElement).toBe(container.querySelector('section'))
        container.querySelector('section')!.remove()
        first.focus()
        tab(true)
        expect(document.activeElement).toBe(first)
    })

    it('does not include shadow-root controls or the container itself in trap boundaries', () => {
        const container = document.createElement('div')
        container.tabIndex = 0
        container.innerHTML = '<input><input><div></div>'
        const shadow = container.lastElementChild!.attachShadow({ mode: 'open' })
        shadow.innerHTML = '<input>'
        document.body.append(container)
        cleanup = createFocusTrap(container, { initialFocus: false, returnFocus: false })
        const first = container.children[0] as HTMLElement
        const last = container.children[1] as HTMLElement
        first.focus()
        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
        expect(document.activeElement).toBe(last)
        first.remove()
        last.remove()
        container.focus()
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        container.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(false)
    })

    it.each([false, true])('leaves Tab untouched when a trap has no controls (backward=%s)', (shiftKey) => {
        const container = document.createElement('div')
        document.body.append(container)
        cleanup = createFocusTrap(container, { initialFocus: false, returnFocus: false })
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
        document.body.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(false)
    })

    it('wraps Tab across the current non-hidden controls', () => {
        const container = document.createElement('div')
        container.innerHTML =
            '<button aria-hidden="true">Hidden</button><input><textarea></textarea><button aria-hidden="true">Hidden</button>'
        document.body.append(container)
        cleanup = createFocusTrap(container, { initialFocus: false, returnFocus: false })
        const first = container.children[1] as HTMLElement
        const last = container.children[2] as HTMLElement
        last.focus()
        const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        last.dispatchEvent(forward)
        expect(forward.defaultPrevented).toBe(true)
        expect(document.activeElement).toBe(first)
        first.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
        )
        expect(document.activeElement).toBe(last)
    })
})

describe('deferred focus recovery ownership', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        document.body.innerHTML = ''
    })

    it('does not recover focus after the trap has been cleaned up', async () => {
        const container = document.createElement('div')
        const inside = document.createElement('button')
        const outside = document.createElement('button')
        container.append(inside)
        document.body.append(container, outside)
        const release = createFocusTrap(container, { initialFocus: false, returnFocus: false })
        try {
            inside.focus()
            inside.blur()
            release()
            outside.focus()
            await Promise.resolve()
            expect(document.activeElement).toBe(outside)
        } finally {
            release()
        }
    })

    it('does not run deferred initial focus after a newer trap takes ownership', () => {
        const frames: FrameRequestCallback[] = []
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
            frames.push(callback)
            return frames.length
        })
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
        const outer = document.createElement('div')
        const first = document.createElement('button')
        const inner = document.createElement('div')
        inner.append(document.createElement('button'))
        const outside = document.createElement('button')
        outer.append(first, inner)
        document.body.append(outer, outside)
        outside.focus()
        const releaseOuter = createFocusTrap(outer, { returnFocus: false })
        const releaseInner = createFocusTrap(inner, { initialFocus: false, returnFocus: false })
        try {
            frames[0](0)
            expect(document.activeElement).toBe(outside)
        } finally {
            releaseInner()
            releaseOuter()
        }
    })

    it('does not recover focus when a newer trap owns it', async () => {
        const outer = document.createElement('div')
        const first = document.createElement('button')
        const inner = document.createElement('div')
        inner.append(document.createElement('button'))
        outer.append(first, inner)
        document.body.append(outer)
        const releaseOuter = createFocusTrap(outer, { initialFocus: false, returnFocus: false })
        first.focus()
        first.blur()
        const refocus = vi.spyOn(first, 'focus')
        const releaseInner = createFocusTrap(inner, { initialFocus: false, returnFocus: false })
        try {
            await Promise.resolve()
            expect(refocus).not.toHaveBeenCalled()
        } finally {
            releaseInner()
            releaseOuter()
        }
    })
})

describe('scroll lock measurement', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('does not measure scrollbar width when native gutter reservation is available', () => {
        vi.stubGlobal('CSS', { supports: () => true })
        const width = vi.spyOn(document.documentElement, 'clientWidth', 'get')
        const release = lockScroll()
        try {
            expect(document.body.style.overflow).toBe('hidden')
            expect(width).not.toHaveBeenCalled()
        } finally {
            release()
        }
    })

    it('measures the fallback width before locking and restores existing padding', () => {
        vi.stubGlobal('CSS', { supports: () => false })
        const originalPadding = document.body.style.paddingRight
        document.body.style.paddingRight = '7px'
        const width = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockImplementation(() => {
            expect(document.body.style.overflow).not.toBe('hidden')
            return window.innerWidth - 20
        })
        const release = lockScroll()
        try {
            expect(document.body.style.paddingRight).toBe('20px')
            expect(width).toHaveBeenCalledTimes(1)
        } finally {
            release()
            expect(document.body.style.paddingRight).toBe('7px')
            document.body.style.paddingRight = originalPadding
        }
    })
})

describe('focus trap stack cleanup', () => {
    it('preserves ownership after removing a middle trap followed by the top trap', () => {
        const containers = Array.from({ length: 3 }, () => {
            const element = document.createElement('div')
            element.append(document.createElement('button'))
            document.body.append(element)
            return element
        })
        const outside = document.createElement('button')
        document.body.append(outside)
        const release = containers.map((element) =>
            createFocusTrap(element, { initialFocus: false, returnFocus: false }),
        )
        try {
            release[1]()
            outside.focus()
            expect(document.activeElement).toBe(containers[2].firstElementChild)
            release[2]()
            outside.focus()
            expect(document.activeElement).toBe(containers[0].firstElementChild)
            release[1]()
            release[0]()
            outside.focus()
            expect(document.activeElement).toBe(outside)
        } finally {
            release.forEach((cleanup) => cleanup())
            containers.forEach((element) => element.remove())
            outside.remove()
        }
    })
})

describe('dialog controller stack cleanup', () => {
    it('supports middle, top and repeated cleanup while preserving scroll ownership', async () => {
        const { createDialogController } = await import('../src/modalDialog')
        const originalOverflow = document.body.style.overflow
        const released: number[] = []
        const elements = Array.from({ length: 3 }, () => {
            const dialog = document.createElement('dialog')
            const panel = document.createElement('div')
            dialog.append(panel)
            document.body.append(dialog)
            return { dialog, panel }
        })
        const controllers = elements.map(({ dialog, panel }, index) =>
            createDialogController({
                dialog: () => dialog,
                panel: () => panel,
                onMount: () => () => released.push(index),
            }),
        )
        try {
            controllers.forEach((controller) => {
                controller.open()
                controller.mount()
            })
            await controllers[1].close()
            expect(document.body.style.overflow).toBe('hidden')
            await controllers[2].close()
            expect(document.body.style.overflow).toBe('hidden')
            controllers[1].cleanup()
            await controllers[0].close()
            expect(released).toEqual([1, 2, 0])
            expect(document.body.style.overflow).toBe(originalOverflow)
        } finally {
            controllers.forEach((controller) => controller.cleanup())
            elements.forEach(({ dialog }) => dialog.remove())
        }
    })
})
