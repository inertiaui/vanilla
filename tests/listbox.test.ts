import { createFocusOutDismiss, findEnabledListboxIndex, resolveListboxNavigation } from '../src/listbox'

describe('findEnabledListboxIndex', () => {
    const items = [{ label: 'Alpha' }, { label: 'Beta', disabled: true }, { label: 'Gamma' }]

    const disabled = (item: (typeof items)[number]) => item.disabled === true

    it('finds the next enabled item in the requested direction', () => {
        expect(findEnabledListboxIndex({ items, startIndex: 0, direction: 1, isItemDisabled: disabled })).toBe(0)
        expect(findEnabledListboxIndex({ items, startIndex: 1, direction: 1, isItemDisabled: disabled })).toBe(2)
        expect(findEnabledListboxIndex({ items, startIndex: 1, direction: -1, isItemDisabled: disabled })).toBe(0)
    })

    it('returns the fallback when no enabled item is reachable', () => {
        expect(
            findEnabledListboxIndex({
                items: items.map((item) => ({ ...item, disabled: true })),
                startIndex: 0,
                direction: 1,
                isItemDisabled: disabled,
                fallbackIndex: 7,
            }),
        ).toBe(7)
    })
})

describe('resolveListboxNavigation', () => {
    const items = [{ label: 'Alpha' }, { label: 'Beta', disabled: true }, { label: 'Gamma' }]

    const disabled = (item: (typeof items)[number]) => item.disabled === true

    it('resolves arrow, home, and end keys', () => {
        expect(
            resolveListboxNavigation({ items, currentIndex: 0, key: 'ArrowDown', isItemDisabled: disabled }),
        ).toEqual({
            handled: true,
            index: 2,
        })
        expect(resolveListboxNavigation({ items, currentIndex: 2, key: 'ArrowUp', isItemDisabled: disabled })).toEqual({
            handled: true,
            index: 0,
        })
        expect(resolveListboxNavigation({ items, currentIndex: 2, key: 'Home', isItemDisabled: disabled })).toEqual({
            handled: true,
            index: 0,
        })
        expect(resolveListboxNavigation({ items, currentIndex: 0, key: 'End', isItemDisabled: disabled })).toEqual({
            handled: true,
            index: 2,
        })
    })

    it('leaves unrelated keys unhandled', () => {
        expect(resolveListboxNavigation({ items, currentIndex: 1, key: 'Enter', isItemDisabled: disabled })).toEqual({
            handled: false,
            index: 1,
        })
    })
})

describe('createFocusOutDismiss', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('dismisses after focus leaves the container', () => {
        const container = document.createElement('div')
        const input = document.createElement('input')
        container.append(input)
        document.body.append(container)
        const onDismiss = vi.fn()
        const dismiss = createFocusOutDismiss({ container: () => container, onDismiss, delay: 100 })

        dismiss.schedule(new FocusEvent('focusout'))
        vi.advanceTimersByTime(100)

        expect(onDismiss).toHaveBeenCalledTimes(1)
        dismiss.cleanup()
        container.remove()
    })

    it('does not dismiss when focus remains inside the container', () => {
        const container = document.createElement('div')
        const input = document.createElement('input')
        container.append(input)
        document.body.append(container)
        input.focus()
        const onDismiss = vi.fn()
        const dismiss = createFocusOutDismiss({ container: () => container, onDismiss, delay: 100 })

        dismiss.schedule(new FocusEvent('focusout'))
        vi.advanceTimersByTime(100)

        expect(onDismiss).not.toHaveBeenCalled()
        dismiss.cleanup()
        container.remove()
    })

    it('cancels stale scheduled dismisses when reopened', () => {
        const onDismiss = vi.fn()
        const dismiss = createFocusOutDismiss({ container: () => null, onDismiss, delay: 100 })

        dismiss.schedule(new FocusEvent('focusout'))
        dismiss.markOpen()
        vi.advanceTimersByTime(100)

        expect(onDismiss).not.toHaveBeenCalled()
        dismiss.cleanup()
    })
})
