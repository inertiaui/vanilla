import type { CleanupFunction } from './dialog'

export interface MenuNavigationOptions {
    itemSelector?: string
    orientation?: 'vertical' | 'horizontal'
    loop?: boolean
    typeAhead?: boolean
    onActivate?: (item: HTMLElement) => void
}

export function createMenuNavigation(
    container: HTMLElement,
    options: MenuNavigationOptions = {},
): CleanupFunction {
    const {
        itemSelector = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])',
        orientation = 'vertical',
        loop = true,
        typeAhead = true,
        onActivate,
    } = options

    let typeAheadBuffer = ''
    let typeAheadTimeout: ReturnType<typeof setTimeout> | undefined

    function getItems(): HTMLElement[] {
        return Array.from(container.querySelectorAll<HTMLElement>(itemSelector))
    }

    function getActiveIndex(): number {
        const items = getItems()
        const focused = document.activeElement as HTMLElement
        return items.indexOf(focused)
    }

    function focusItem(index: number) {
        const items = getItems()
        if (items.length === 0) {
            return
        }

        const targetIndex = loop
            ? ((index % items.length) + items.length) % items.length
            : Math.max(0, Math.min(index, items.length - 1))

        const item = items[targetIndex]

        // Roving tabindex
        items.forEach((el) => el.setAttribute('tabindex', '-1'))
        item.setAttribute('tabindex', '0')
        item.focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
        const items = getItems()
        if (items.length === 0) {
            return
        }

        const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
        const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'

        switch (event.key) {
            case nextKey: {
                event.preventDefault()
                const currentIndex = getActiveIndex()
                focusItem(currentIndex + 1)
                break
            }

            case prevKey: {
                event.preventDefault()
                const currentIndex = getActiveIndex()
                focusItem(currentIndex - 1)
                break
            }

            case 'Home': {
                event.preventDefault()
                focusItem(0)
                break
            }

            case 'End': {
                event.preventDefault()
                focusItem(items.length - 1)
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
                if (typeAhead && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
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
                        focusItem(index)
                    }
                }
                break
            }
        }
    }

    container.addEventListener('keydown', handleKeyDown)

    // Initialize roving tabindex: first item gets tabindex="0", rest get "-1"
    const items = getItems()
    items.forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'))

    // Focus first item
    let rafId: number | undefined
    if (items.length > 0) {
        rafId = requestAnimationFrame(() => {
            rafId = undefined
            items[0].focus()
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
