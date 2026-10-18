import * as nativePopover from '../src/nativePopover'
import { createPopoverController, type PopoverControllerOptions } from '../src/popover'

describe('popover controller allocation and lifecycle', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
        vi.restoreAllMocks()
        document.body.innerHTML = ''
    })

    const options = (extra: Partial<PopoverControllerOptions> = {}): PopoverControllerOptions => ({
        reference: () => null,
        popover: () => null,
        position: {},
        ...extra,
    })

    it('keeps unused controllers lightweight through state reads and cleanup', () => {
        const disclosure = vi.spyOn(nativePopover, 'createNativePopoverDisclosure')
        const controller = createPopoverController(options())
        expect(controller.isOpen).toBe(false)
        expect(typeof controller.native).toBe('boolean')
        controller.onPointerDown()
        controller.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
        controller.onKeydown(new KeyboardEvent('keydown', { key: 'x' }))
        controller.mount()
        controller.close()
        controller.cleanup()
        controller.cleanup()
        expect(disclosure).not.toHaveBeenCalled()
    })

    it('initializes once for open, close, toggle and reuse', () => {
        const disclosure = vi.spyOn(nativePopover, 'createNativePopoverDisclosure')
        const onOpenChange = vi.fn()
        const onClosed = vi.fn()
        const controller = createPopoverController(options({ onOpenChange, onClosed }))
        controller.open()
        controller.open()
        expect(controller.isOpen).toBe(true)
        expect(onOpenChange.mock.calls).toEqual([[true]])
        controller.close(false)
        controller.close(false)
        expect(onClosed).toHaveBeenCalledTimes(1)
        expect(onOpenChange.mock.calls).toEqual([[true], [false]])
        controller.cleanup()
        controller.toggle()
        expect(controller.isOpen).toBe(true)
        controller.toggle()
        expect(controller.isOpen).toBe(false)
        expect(disclosure).toHaveBeenCalledTimes(1)
    })

    it('retains menu arrow and Escape handling', () => {
        const controller = createPopoverController(options({ menu: true }))
        const ignored = new KeyboardEvent('keydown', { key: 'Home', cancelable: true })
        controller.onKeydown(ignored)
        expect(ignored.defaultPrevented).toBe(false)
        expect(controller.isOpen).toBe(false)
        const open = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true })
        controller.onKeydown(open)
        expect(open.defaultPrevented).toBe(true)
        expect(controller.isOpen).toBe(true)
        const close = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
        controller.onKeydown(close)
        expect(close.defaultPrevented).toBe(true)
        expect(controller.isOpen).toBe(false)
        controller.cleanup()
    })

    it('does not reopen after pointerdown started while open', () => {
        const onOpenChange = vi.fn()
        const controller = createPopoverController(options({ onOpenChange }))
        controller.open()
        controller.onPointerDown()
        controller.close(false)
        controller.toggle(new MouseEvent('click', { detail: 1 }))
        expect(controller.isOpen).toBe(false)
        expect(onOpenChange.mock.calls).toEqual([[true], [false]])
        controller.toggle()
        expect(controller.isOpen).toBe(true)
        controller.cleanup()
    })

    it('preserves closed focus-out handling and cancels stale dismissal on open', () => {
        const reference = vi.fn(() => null)
        const controller = createPopoverController(options({ reference }))
        controller.onFocusOut(new FocusEvent('focusout'))
        expect(reference).toHaveBeenCalledTimes(1)
        controller.open()
        vi.advanceTimersByTime(150)
        expect(controller.isOpen).toBe(true)
        controller.onFocusOut(new FocusEvent('focusout'))
        vi.advanceTimersByTime(149)
        expect(controller.isOpen).toBe(true)
        vi.advanceTimersByTime(1)
        expect(controller.isOpen).toBe(false)
        controller.cleanup()
    })

    it('captures the original open callback and focus container before first interaction', () => {
        const original = vi.fn()
        const replacement = vi.fn()
        const reference = vi.fn(() => null)
        const nextReference = vi.fn(() => null)
        const settings = options({ onOpenChange: original, reference })
        const controller = createPopoverController(settings)
        settings.onOpenChange = replacement
        settings.reference = nextReference
        controller.open()
        controller.onFocusOut(new FocusEvent('focusout'))
        expect(original).toHaveBeenCalledWith(true)
        expect(replacement).not.toHaveBeenCalled()
        expect(reference).toHaveBeenCalledTimes(1)
        expect(nextReference).not.toHaveBeenCalled()
        controller.cleanup()
    })
})
