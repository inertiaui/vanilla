import { createMenuNavigation } from '../src/menu'

describe('createMenuNavigation initial focus', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
        document.body.innerHTML = ''
    })

    it('focuses the last enabled item with a matching roving tab stop', () => {
        const menu = document.createElement('div')
        menu.innerHTML =
            '<button role="menuitem">First</button><button role="menuitem">Last</button><button role="menuitem" disabled>Disabled</button>'
        document.body.append(menu)
        const cleanup = createMenuNavigation(menu, { initialFocus: 'last' })
        vi.advanceTimersByTime(50)
        expect(document.activeElement).toBe(menu.children[1])
        expect(menu.children[0].getAttribute('tabindex')).toBe('-1')
        expect(menu.children[1].getAttribute('tabindex')).toBe('0')
        cleanup()
    })

    it('cancels pending initial focus when cleaned up', () => {
        const menu = document.createElement('div')
        menu.innerHTML = '<button role="menuitem">First</button>'
        document.body.append(menu)
        const cleanup = createMenuNavigation(menu, { initialFocus: 'last' })
        cleanup()
        vi.advanceTimersByTime(50)
        expect(document.activeElement).not.toBe(menu.firstElementChild)
    })

    it('queries once per navigation and changes only the old and new tab stops', () => {
        const menu = document.createElement('div')
        menu.innerHTML = Array.from({ length: 100 }, (_, i) => `<button role="menuitem">Item ${i}</button>`).join('')
        document.body.append(menu)
        const cleanup = createMenuNavigation(menu)
        vi.advanceTimersByTime(50)
        const query = vi.spyOn(menu, 'querySelectorAll')
        const write = vi.spyOn(Element.prototype, 'setAttribute')
        try {
            menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
            expect(document.activeElement).toBe(menu.children[1])
            expect(query).toHaveBeenCalledTimes(1)
            expect(write).toHaveBeenCalledTimes(2)
        } finally {
            cleanup()
        }
    })

    it('uses current enabled children after insertion, removal and disabled changes', () => {
        const menu = document.createElement('div')
        menu.innerHTML =
            '<button role="menuitem">First</button><button role="menuitem">Second</button><button role="menuitem">Third</button>'
        document.body.append(menu)
        const cleanup = createMenuNavigation(menu)
        vi.advanceTimersByTime(50)
        const press = (key: string) =>
            menu.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
        try {
            menu.children[1].setAttribute('disabled', '')
            press('ArrowDown')
            expect(document.activeElement).toBe(menu.children[2])
            const added = document.createElement('button')
            added.role = 'menuitem'
            added.textContent = 'Added'
            menu.append(added)
            press('End')
            expect(document.activeElement).toBe(added)
            added.remove()
            menu.children[1].removeAttribute('disabled')
            press('Home')
            press('ArrowDown')
            expect(document.activeElement).toBe(menu.children[1])
            expect(menu.querySelectorAll('[tabindex="0"]')).toHaveLength(1)
        } finally {
            cleanup()
        }
    })

    it.each([true, false])('does not scan menu items for ignored keys with typeAhead=%s', (typeAhead) => {
        const menu = document.createElement('div')
        menu.innerHTML = '<button role="menuitem">First</button><button role="menuitem">Second</button>'
        document.body.append(menu)
        const cleanup = createMenuNavigation(menu, { typeAhead })
        vi.advanceTimersByTime(50)
        const query = vi.spyOn(menu, 'querySelectorAll')
        const ignored: KeyboardEventInit[] = [
            { key: 'Tab' },
            { key: 'Escape' },
            { key: 'Shift' },
            { key: 'ArrowLeft' },
            { key: 'a', ctrlKey: true },
            { key: 'a', metaKey: true },
            { key: 'a', altKey: true },
        ]
        if (!typeAhead) ignored.push({ key: 'a' })
        try {
            for (const init of ignored) {
                const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true })
                menu.dispatchEvent(event)
                expect(event.defaultPrevented).toBe(false)
            }
            expect(document.activeElement).toBe(menu.firstElementChild)
            expect(query).not.toHaveBeenCalled()
        } finally {
            cleanup()
        }
    })

    it('preserves horizontal navigation, modifier activation and typeahead after ignored keys', () => {
        const menu = document.createElement('div')
        menu.innerHTML = '<button role="menuitem">Apple</button><button role="menuitem">Banana</button>'
        document.body.append(menu)
        const onActivate = vi.fn()
        const cleanup = createMenuNavigation(menu, { orientation: 'horizontal', onActivate })
        vi.advanceTimersByTime(50)
        const press = (key: string, ctrlKey = false) => {
            const event = new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true, cancelable: true })
            menu.dispatchEvent(event)
            return event.defaultPrevented
        }
        try {
            expect(press('ArrowDown')).toBe(false)
            expect(document.activeElement).toBe(menu.children[0])
            expect(press('ArrowRight')).toBe(true)
            expect(document.activeElement).toBe(menu.children[1])
            expect(press('Enter', true)).toBe(true)
            expect(onActivate).toHaveBeenCalledExactlyOnceWith(menu.children[1])
            expect(press('a', true)).toBe(false)
            expect(press('a')).toBe(true)
            expect(document.activeElement).toBe(menu.children[0])
        } finally {
            cleanup()
        }
    })
})
