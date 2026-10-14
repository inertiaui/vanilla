import * as debounce from '../src/debounce'
import * as nativePopover from '../src/nativePopover'
import { createTooltipController, type TooltipControllerOptions } from '../src/tooltip'

describe('tooltip controller lifecycle', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
        vi.restoreAllMocks()
        document.body.innerHTML = ''
    })

    it('does not allocate disclosure or scheduler state for unused tooltips', async () => {
        const disclosure = vi.spyOn(nativePopover, 'createNativePopoverDisclosure')
        const scheduler = vi.spyOn(debounce, 'createDebouncer')
        const controller = createTooltipController({ reference: () => null, tooltip: () => null })
        expect(controller.isOpen).toBe(false)
        expect(typeof controller.native).toBe('boolean')
        controller.mount()
        controller.cleanup()
        await controller.hide()
        controller.cleanup()
        expect(disclosure).not.toHaveBeenCalled()
        expect(scheduler).not.toHaveBeenCalled()
    })

    it('allocates once after intent and preserves delayed opening and cleanup reuse', async () => {
        const disclosure = vi.spyOn(nativePopover, 'createNativePopoverDisclosure')
        const scheduler = vi.spyOn(debounce, 'createDebouncer')
        const onOpenChange = vi.fn()
        const controller = createTooltipController({
            reference: () => null,
            tooltip: () => null,
            delay: 50,
            onOpenChange,
        })
        controller.onMouseEnter()
        expect(scheduler).toHaveBeenCalledTimes(1)
        expect(disclosure).not.toHaveBeenCalled()
        vi.advanceTimersByTime(49)
        expect(controller.isOpen).toBe(false)
        vi.advanceTimersByTime(1)
        expect(controller.isOpen).toBe(true)
        expect(onOpenChange).toHaveBeenCalledWith(true)
        expect(disclosure).toHaveBeenCalledTimes(1)
        await controller.hide()
        expect(controller.isOpen).toBe(false)
        expect(onOpenChange).toHaveBeenLastCalledWith(false)
        controller.cleanup()
        controller.onFocusIn()
        vi.advanceTimersByTime(50)
        expect(controller.isOpen).toBe(true)
        expect(disclosure).toHaveBeenCalledTimes(1)
        expect(scheduler).toHaveBeenCalledTimes(1)
        await controller.hide()
    })

    it('reads dynamic delays at schedule time and cancels stale intent', () => {
        let delay = 100
        let enabled = true
        const onOpenChange = vi.fn()
        const controller = createTooltipController({
            reference: () => null,
            tooltip: () => null,
            enabled: () => enabled,
            delay: () => delay,
            onOpenChange,
        })
        controller.onMouseEnter()
        vi.advanceTimersByTime(50)
        controller.onMouseLeave()
        vi.advanceTimersByTime(100)
        expect(onOpenChange).not.toHaveBeenCalled()
        delay = 20
        controller.onMouseEnter()
        enabled = false
        vi.advanceTimersByTime(20)
        expect(controller.isOpen).toBe(false)
        enabled = true
        controller.onMouseEnter()
        vi.advanceTimersByTime(19)
        expect(controller.isOpen).toBe(false)
        vi.advanceTimersByTime(1)
        expect(controller.isOpen).toBe(true)
        controller.cleanup()
    })

    it('keeps the construction-time delay and open callback when options are reassigned', () => {
        const original = vi.fn()
        const replacement = vi.fn()
        const options: TooltipControllerOptions = {
            reference: () => null,
            tooltip: () => null,
            delay: 30,
            onOpenChange: original,
        }
        const controller = createTooltipController(options)
        options.delay = 0
        options.onOpenChange = replacement
        controller.onFocusIn()
        vi.advanceTimersByTime(29)
        expect(controller.isOpen).toBe(false)
        vi.advanceTimersByTime(1)
        expect(original).toHaveBeenCalledWith(true)
        expect(replacement).not.toHaveBeenCalled()
        controller.cleanup()
    })

    it('does not hide while either hover or focus still requests the tooltip', async () => {
        const reference = document.createElement('div')
        const child = document.createElement('button')
        reference.append(child)
        const controller = createTooltipController({ reference: () => reference, tooltip: () => null, delay: 0 })
        controller.onMouseEnter()
        controller.onFocusIn()
        vi.runAllTimers()
        controller.onMouseLeave()
        await Promise.resolve()
        expect(controller.isOpen).toBe(true)
        controller.onFocusOut(new FocusEvent('focusout', { relatedTarget: child }))
        await Promise.resolve()
        expect(controller.isOpen).toBe(true)
        controller.onFocusOut(new FocusEvent('focusout'))
        await Promise.resolve()
        expect(controller.isOpen).toBe(false)
    })

    it('cancels a stale closing transition when intent returns', async () => {
        let finish: () => void = () => {}
        const closing = new Promise<void>((resolve) => {
            finish = resolve
        })
        const transition = vi.fn((visible: boolean) => (visible ? undefined : closing))
        const onOpenChange = vi.fn()
        const controller = createTooltipController({
            reference: () => null,
            tooltip: () => null,
            delay: 0,
            transition,
            onOpenChange,
        })
        controller.onMouseEnter()
        vi.runAllTimers()
        const hiding = controller.hide()
        controller.onMouseEnter()
        expect(transition).toHaveBeenLastCalledWith(true)
        finish()
        await hiding
        expect(controller.isOpen).toBe(true)
        expect(onOpenChange).toHaveBeenCalledTimes(1)
        controller.cleanup()
    })

    it('cancels scheduled work on cleanup and supports later reuse', () => {
        const onOpenChange = vi.fn()
        const controller = createTooltipController({
            reference: () => null,
            tooltip: () => null,
            delay: 10,
            onOpenChange,
        })
        controller.onFocusIn()
        controller.cleanup()
        vi.runAllTimers()
        expect(onOpenChange).not.toHaveBeenCalled()
        controller.onFocusIn()
        vi.advanceTimersByTime(10)
        expect(controller.isOpen).toBe(true)
        controller.cleanup()
    })
})
