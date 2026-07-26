import { createNativePopoverDisclosure } from '../src/nativePopover'

function rect(left: number, top: number, right: number, bottom: number): DOMRect {
    return { left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }
}

function createPopoverElements() {
    const reference = document.createElement('button')
    const popover = document.createElement('div')
    const showPopover = vi.fn()
    const hidePopover = vi.fn()

    Object.assign(popover, { showPopover, hidePopover })

    document.body.append(reference, popover)

    return {
        reference,
        popover,
        showPopover,
        hidePopover,
        cleanup: () => {
            reference.remove()
            popover.remove()
        },
    }
}

describe('createNativePopoverDisclosure', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        document.body.innerHTML = ''
    })

    it('opens, shows, closes, and hides the popover', () => {
        const elements = createPopoverElements()
        const onOpenChange = vi.fn()
        const onBeforeOpen = vi.fn()
        const onClose = vi.fn()
        const disclosure = createNativePopoverDisclosure({
            reference: () => elements.reference,
            popover: () => elements.popover,
            position: { placement: 'bottom-start' },
            onOpenChange,
        })

        disclosure.openPopover({ onBeforeOpen })
        disclosure.showPopover()

        expect(disclosure.isOpen).toBe(true)
        expect(onBeforeOpen).toHaveBeenCalledTimes(1)
        expect(onOpenChange).toHaveBeenLastCalledWith(true)
        expect(elements.showPopover).toHaveBeenCalledTimes(1)

        expect(disclosure.closePopover({ onClose })).toBe(true)

        expect(disclosure.isOpen).toBe(false)
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onOpenChange).toHaveBeenLastCalledWith(false)
        expect(elements.hidePopover).toHaveBeenCalledTimes(1)

        disclosure.cleanupPopover()
        elements.cleanup()
    })

    it('keeps the popover hidden until its first position is applied', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

        const elements = createPopoverElements()
        let visibilityWhenShown = ''
        elements.showPopover.mockImplementation(() => {
            visibilityWhenShown = elements.popover.style.visibility
        })
        const measurePopover = vi.fn(() => rect(0, 0, 200, 120))
        elements.reference.getBoundingClientRect = () => rect(80, 120, 300, 160)
        elements.popover.getBoundingClientRect = measurePopover
        elements.popover.style.visibility = 'visible'

        const disclosure = createNativePopoverDisclosure({
            reference: () => elements.reference,
            popover: () => elements.popover,
            position: { placement: 'bottom-start' },
        })

        disclosure.showPopover()

        expect(visibilityWhenShown).toBe('hidden')
        expect(elements.popover.style.visibility).toBe('visible')
        expect(measurePopover).toHaveBeenCalled()
        const positionAnchor =
            elements.popover.style.getPropertyValue('position-anchor') ||
            (elements.popover.style as CSSStyleDeclaration & { positionAnchor?: string }).positionAnchor ||
            ''
        expect(elements.popover.style.left === '80px' || positionAnchor.startsWith('--iui-anchor-')).toBe(true)

        disclosure.cleanupPopover()
    })

    it('does not hide when close is configured without native hiding', () => {
        const elements = createPopoverElements()
        const disclosure = createNativePopoverDisclosure({
            reference: () => elements.reference,
            popover: () => elements.popover,
            position: { placement: 'bottom-start' },
        })

        disclosure.openPopover()

        expect(disclosure.closePopover({ hide: false })).toBe(true)
        expect(elements.hidePopover).not.toHaveBeenCalled()

        disclosure.cleanupPopover()
        elements.cleanup()
    })

    it('syncs closed state from native toggle events', () => {
        const elements = createPopoverElements()
        const onClose = vi.fn()
        const disclosure = createNativePopoverDisclosure({
            reference: () => elements.reference,
            popover: () => elements.popover,
            position: { placement: 'bottom-start' },
        })

        disclosure.openPopover()

        expect(disclosure.handlePopoverToggle(new Event('toggle'))).toBe(false)
        expect(disclosure.isOpen).toBe(true)

        const event = new Event('toggle') as Event & { newState: 'closed' }
        event.newState = 'closed'

        expect(disclosure.handlePopoverToggle(event, { onClose })).toBe(true)
        expect(disclosure.isOpen).toBe(false)
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(elements.hidePopover).not.toHaveBeenCalled()

        disclosure.cleanupPopover()
        elements.cleanup()
    })

    it('delegates focus-out dismissal to the configured controller', () => {
        const elements = createPopoverElements()
        const container = document.createElement('div')
        container.append(elements.reference, elements.popover)
        document.body.append(container)
        const onDismiss = vi.fn()
        const disclosure = createNativePopoverDisclosure({
            reference: () => elements.reference,
            popover: () => elements.popover,
            position: { placement: 'bottom-start' },
            focusOut: {
                container: () => container,
                onDismiss,
                delay: 100,
            },
        })

        disclosure.openPopover()
        disclosure.handleFocusOut(new FocusEvent('focusout'))
        vi.advanceTimersByTime(100)

        expect(onDismiss).toHaveBeenCalledTimes(1)

        disclosure.cleanupPopover()
        container.remove()
    })
})
