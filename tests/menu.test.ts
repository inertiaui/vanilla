import { createMenuNavigation } from '../src/menu'

describe('createMenuNavigation initial focus', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => {
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
})
