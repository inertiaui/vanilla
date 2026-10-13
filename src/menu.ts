import type { CleanupFunction } from './dialog'

export interface MenuNavigationOptions {
    itemSelector?: string
    orientation?: 'vertical' | 'horizontal'
    loop?: boolean
    typeAhead?: boolean
    initialFocus?: 'first' | 'last'
    onActivate?: (item: HTMLElement) => void
}

export function createMenuNavigation(container: HTMLElement, options: MenuNavigationOptions = {}): CleanupFunction {
    const {
        itemSelector = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])',
        orientation = 'vertical',
        loop = true,
        typeAhead = true,
        initialFocus = 'first',
        onActivate,
    } = options

    let typeAheadBuffer = ''
    let typeAheadTimeout: ReturnType<typeof setTimeout> | undefined

    function getItems(): HTMLElement[] {
        return Array.from(container.querySelectorAll<HTMLElement>(itemSelector))
    }

    function getActiveIndex(items: HTMLElement[]): number {
        const focused = document.activeElement as HTMLElement
        return items.indexOf(focused)
    }

    function focusItem(index: number, items: HTMLElement[]) {
        if (items.length === 0) {
            return
        }

        const targetIndex = loop
            ? ((index % items.length) + items.length) % items.length
            : Math.max(0, Math.min(index, items.length - 1))

        const item = items[targetIndex]

        // Roving tabindex
        items.forEach((el) => {
            const value = el === item ? '0' : '-1'
            if (el.getAttribute('tabindex') !== value) {
                el.setAttribute('tabindex', value)
            }
        })
        item.focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
        const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
        const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
        const typeAheadKey = typeAhead && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
        if (
            event.key !== nextKey &&
            event.key !== prevKey &&
            event.key !== 'Home' &&
            event.key !== 'End' &&
            event.key !== 'Enter' &&
            event.key !== ' ' &&
            !typeAheadKey
        )
            return
        const items = getItems()
        if (items.length === 0) return

        switch (event.key) {
            case nextKey: {
                event.preventDefault()
                const currentIndex = getActiveIndex(items)
                focusItem(currentIndex + 1, items)
                break
            }

            case prevKey: {
                event.preventDefault()
                const currentIndex = getActiveIndex(items)
                focusItem(currentIndex - 1, items)
                break
            }

            case 'Home': {
                event.preventDefault()
                focusItem(0, items)
                break
            }

            case 'End': {
                event.preventDefault()
                focusItem(items.length - 1, items)
                break
            }

            case 'Enter':
            case ' ': {
                event.preventDefault()
                const focused = document.activeElement as HTMLElement
                if (items.includes(focused)) {
                    focused.click()
                    onActivate?.(focused)
                }
                break
            }

            default: {
                if (typeAheadKey) {
                    event.preventDefault()
                    typeAheadBuffer += event.key.toLowerCase()

                    if (typeAheadTimeout) {
                        clearTimeout(typeAheadTimeout)
                    }
                    typeAheadTimeout = setTimeout(() => {
                        typeAheadBuffer = ''
                    }, 350)

                    const match = items.find((item) => {
                        const text = (item.textContent || '').trim().toLowerCase()
                        return text.startsWith(typeAheadBuffer)
                    })

                    if (match) {
                        const index = items.indexOf(match)
                        focusItem(index, items)
                    }
                }
                break
            }
        }
    }

    container.addEventListener('keydown', handleKeyDown)

    // Initialize the tab stop to match the item that will receive focus.
    const items = getItems()
    const initialIndex = initialFocus === 'last' ? items.length - 1 : 0
    items.forEach((el, i) => el.setAttribute('tabindex', i === initialIndex ? '0' : '-1'))

    // Defer focus until the caller has rendered the menu.
    let rafId: number | undefined
    if (items.length > 0) {
        rafId = requestAnimationFrame(() => {
            rafId = undefined
            items[initialIndex].focus()
        })
    }

    let cleaned = false
    return function cleanup() {
        if (cleaned) {
            return
        }
        cleaned = true

        if (rafId !== undefined) {
            cancelAnimationFrame(rafId)
        }

        if (typeAheadTimeout) {
            clearTimeout(typeAheadTimeout)
        }

        container.removeEventListener('keydown', handleKeyDown)
    }
}
