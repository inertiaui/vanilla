import type { CleanupFunction } from './dialog'

type ListboxDirection = 1 | -1

type ListboxNavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'

interface ListboxIndexOptions<T> {
    items: readonly T[]
    startIndex: number
    direction: ListboxDirection
    isItemDisabled?: (item: T, index: number) => boolean
    fallbackIndex?: number
}

export interface ListboxNavigationOptions<T> {
    items: readonly T[]
    currentIndex: number
    key: string
    isItemDisabled?: (item: T, index: number) => boolean
    fallbackIndex?: number
}

export interface ListboxNavigationResult {
    handled: boolean
    index: number
}

function findEnabledListboxIndex<T>(options: ListboxIndexOptions<T>): number {
    const { items, startIndex, direction, isItemDisabled, fallbackIndex = -1 } = options

    if (items.length === 0) {
        return fallbackIndex
    }

    let index = Math.min(Math.max(startIndex, 0), items.length - 1)

    while (index >= 0 && index < items.length) {
        if (!isItemDisabled?.(items[index], index)) {
            return index
        }

        index += direction
    }

    return fallbackIndex
}

export function resolveListboxNavigation<T>(options: ListboxNavigationOptions<T>): ListboxNavigationResult {
    const { items, currentIndex, key, isItemDisabled, fallbackIndex = currentIndex } = options

    if (items.length === 0) {
        return { handled: false, index: fallbackIndex }
    }

    switch (key as ListboxNavigationKey) {
        case 'ArrowDown':
            return {
                handled: true,
                index: findEnabledListboxIndex({
                    items,
                    startIndex: currentIndex + 1,
                    direction: 1,
                    isItemDisabled,
                    fallbackIndex,
                }),
            }
        case 'ArrowUp':
            return {
                handled: true,
                index: findEnabledListboxIndex({
                    items,
                    startIndex: currentIndex - 1,
                    direction: -1,
                    isItemDisabled,
                    fallbackIndex,
                }),
            }
        case 'Home':
            return {
                handled: true,
                index: findEnabledListboxIndex({
                    items,
                    startIndex: 0,
                    direction: 1,
                    isItemDisabled,
                    fallbackIndex,
                }),
            }
        case 'End':
            return {
                handled: true,
                index: findEnabledListboxIndex({
                    items,
                    startIndex: items.length - 1,
                    direction: -1,
                    isItemDisabled,
                    fallbackIndex,
                }),
            }
        default:
            return { handled: false, index: fallbackIndex }
    }
}

export interface FocusOutDismissOptions {
    container: () => HTMLElement | null
    onDismiss: () => void
    delay?: number
    shouldIgnore?: () => boolean
}

export interface FocusOutDismissController {
    markOpen: () => void
    cancel: () => void
    schedule: (event: FocusEvent) => void
    cleanup: CleanupFunction
}

export function createFocusOutDismiss(options: FocusOutDismissOptions): FocusOutDismissController {
    const { delay = 150 } = options
    let timeout: ReturnType<typeof setTimeout> | null = null
    let version = 0

    const cancel = () => {
        if (timeout) {
            clearTimeout(timeout)
            timeout = null
        }
    }

    const markOpen = () => {
        version += 1
        cancel()
    }

    const schedule = (event: FocusEvent) => {
        const container = options.container()
        const related = event.relatedTarget as Node | null

        if (container && related && container.contains(related)) {
            return
        }

        const scheduledVersion = version
        cancel()

        timeout = setTimeout(() => {
            timeout = null
            const currentContainer = options.container()

            if (scheduledVersion !== version) {
                return
            }

            if (currentContainer?.contains(document.activeElement)) {
                return
            }

            if (options.shouldIgnore?.()) {
                return
            }

            options.onDismiss()
        }, delay)
    }

    return {
        markOpen,
        cancel,
        schedule,
        cleanup: cancel,
    }
}
