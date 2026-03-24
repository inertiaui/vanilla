import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMenuNavigation } from '../src/menu'

describe('createMenuNavigation', () => {
    let container: HTMLElement

    beforeEach(() => {
        container = document.createElement('div')
        container.setAttribute('role', 'menu')
        document.body.appendChild(container)
    })

    afterEach(() => {
        container.remove()
    })

    function addItems(count: number): HTMLElement[] {
        const items: HTMLElement[] = []
        for (let i = 0; i < count; i++) {
            const item = document.createElement('button')
            item.setAttribute('role', 'menuitem')
            item.textContent = `Item ${i + 1}`
            container.appendChild(item)
            items.push(item)
        }
        return items
    }

    function pressKey(key: string, options: Partial<KeyboardEventInit> = {}) {
        container.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
    }

    it('should initialize roving tabindex on items', () => {
        const items = addItems(3)
        const cleanup = createMenuNavigation(container)

        expect(items[0].getAttribute('tabindex')).toBe('0')
        expect(items[1].getAttribute('tabindex')).toBe('-1')
        expect(items[2].getAttribute('tabindex')).toBe('-1')

        cleanup()
    })

    it('should navigate down with ArrowDown in vertical orientation', () => {
        const items = addItems(3)
        const cleanup = createMenuNavigation(container)

        // Simulate first item focused
        items[0].focus()

        pressKey('ArrowDown')
        expect(document.activeElement).toBe(items[1])

        pressKey('ArrowDown')
        expect(document.activeElement).toBe(items[2])

        cleanup()
    })

    it('should navigate up with ArrowUp in vertical orientation', () => {
        const items = addItems(3)
        const cleanup = createMenuNavigation(container)

        items[2].focus()

        pressKey('ArrowUp')
        expect(document.activeElement).toBe(items[1])

        pressKey('ArrowUp')
        expect(document.activeElement).toBe(items[0])

        cleanup()
    })

    it('should loop navigation by default', () => {
        const items = addItems(3)
        const cleanup = createMenuNavigation(container)

        items[2].focus()
        pressKey('ArrowDown')
        expect(document.activeElement).toBe(items[0])

        items[0].focus()
        pressKey('ArrowUp')
        expect(document.activeElement).toBe(items[2])

        cleanup()
    })

    it('should clamp navigation when loop is disabled', () => {
        const items = addItems(3)
        const cleanup = createMenuNavigation(container, { loop: false })

        items[0].focus()
        pressKey('ArrowUp')
        expect(document.activeElement).toBe(items[0])

        items[2].focus()
        pressKey('ArrowDown')
        expect(document.activeElement).toBe(items[2])

        cleanup()
    })

    it('should navigate with ArrowRight/ArrowLeft in horizontal orientation', () => {
        const items = addItems(3)
        const cleanup = createMenuNavigation(container, { orientation: 'horizontal' })

        items[0].focus()
        pressKey('ArrowRight')
        expect(document.activeElement).toBe(items[1])

        pressKey('ArrowLeft')
        expect(document.activeElement).toBe(items[0])

        cleanup()
    })

    it('should focus first item on Home key', () => {
        const items = addItems(3)
        const cleanup = createMenuNavigation(container)

        items[2].focus()
        pressKey('Home')
        expect(document.activeElement).toBe(items[0])

        cleanup()
    })

    it('should focus last item on End key', () => {
        const items = addItems(3)
        const cleanup = createMenuNavigation(container)

        items[0].focus()
        pressKey('End')
        expect(document.activeElement).toBe(items[2])

        cleanup()
    })

    it('should activate item on Enter', () => {
        const items = addItems(3)
        const onClick = vi.fn()
        items[1].addEventListener('click', onClick)

        const onActivate = vi.fn()
        const cleanup = createMenuNavigation(container, { onActivate })

        items[1].focus()
        pressKey('Enter')

        expect(onClick).toHaveBeenCalledOnce()
        expect(onActivate).toHaveBeenCalledWith(items[1])

        cleanup()
    })

    it('should activate item on Space', () => {
        const items = addItems(3)
        const onClick = vi.fn()
        items[0].addEventListener('click', onClick)

        const cleanup = createMenuNavigation(container)

        items[0].focus()
        pressKey(' ')

        expect(onClick).toHaveBeenCalledOnce()

        cleanup()
    })

    it('should support type-ahead search', async () => {
        const items = addItems(3)
        items[0].textContent = 'Apple'
        items[1].textContent = 'Banana'
        items[2].textContent = 'Cherry'

        const cleanup = createMenuNavigation(container)

        items[0].focus()
        pressKey('b')
        expect(document.activeElement).toBe(items[1])

        pressKey('c') // No match for "bc" — stays on Banana
        // Wait for buffer to clear
        await new Promise((r) => setTimeout(r, 400))

        pressKey('c')
        expect(document.activeElement).toBe(items[2])

        cleanup()
    })

    it('should not type-ahead when typeAhead is disabled', () => {
        const items = addItems(3)
        items[0].textContent = 'Apple'
        items[1].textContent = 'Banana'

        const cleanup = createMenuNavigation(container, { typeAhead: false })

        items[0].focus()
        pressKey('b')
        expect(document.activeElement).toBe(items[0])

        cleanup()
    })

    it('should skip disabled items via selector', () => {
        const items = addItems(3)
        items[1].setAttribute('disabled', '')

        const cleanup = createMenuNavigation(container)

        items[0].focus()
        pressKey('ArrowDown')
        expect(document.activeElement).toBe(items[2])

        cleanup()
    })

    it('should skip aria-disabled items via selector', () => {
        const items = addItems(3)
        items[1].setAttribute('aria-disabled', 'true')

        const cleanup = createMenuNavigation(container)

        items[0].focus()
        pressKey('ArrowDown')
        expect(document.activeElement).toBe(items[2])

        cleanup()
    })

    it('should update roving tabindex when navigating', () => {
        const items = addItems(3)
        const cleanup = createMenuNavigation(container)

        items[0].focus()
        pressKey('ArrowDown')

        expect(items[0].getAttribute('tabindex')).toBe('-1')
        expect(items[1].getAttribute('tabindex')).toBe('0')
        expect(items[2].getAttribute('tabindex')).toBe('-1')

        cleanup()
    })

    it('should remove keydown listener on cleanup', () => {
        const items = addItems(3)
        const cleanup = createMenuNavigation(container)

        items[0].focus()
        cleanup()

        pressKey('ArrowDown')
        // Focus should not have moved since listener was removed
        expect(document.activeElement).toBe(items[0])
    })

    it('should be safe to call cleanup multiple times', () => {
        addItems(3)
        const cleanup = createMenuNavigation(container)

        cleanup()
        cleanup() // should not throw
    })

    it('should support a custom item selector', () => {
        const item1 = document.createElement('button')
        item1.className = 'custom-item'
        item1.textContent = 'A'
        const item2 = document.createElement('button')
        item2.className = 'custom-item'
        item2.textContent = 'B'
        container.appendChild(item1)
        container.appendChild(item2)

        const cleanup = createMenuNavigation(container, { itemSelector: '.custom-item' })

        expect(item1.getAttribute('tabindex')).toBe('0')
        expect(item2.getAttribute('tabindex')).toBe('-1')

        item1.focus()
        pressKey('ArrowDown')
        expect(document.activeElement).toBe(item2)

        cleanup()
    })

    it('should handle empty container gracefully', () => {
        const cleanup = createMenuNavigation(container)

        // Should not throw
        pressKey('ArrowDown')
        pressKey('Home')
        pressKey('Enter')

        cleanup()
    })

    it('should not type-ahead on modifier key combos', () => {
        const items = addItems(3)
        items[0].textContent = 'Apple'
        items[1].textContent = 'Banana'

        const cleanup = createMenuNavigation(container)

        items[0].focus()
        pressKey('b', { ctrlKey: true })
        expect(document.activeElement).toBe(items[0])

        pressKey('b', { metaKey: true })
        expect(document.activeElement).toBe(items[0])

        pressKey('b', { altKey: true })
        expect(document.activeElement).toBe(items[0])

        cleanup()
    })
})
