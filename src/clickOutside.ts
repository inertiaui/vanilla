import type { CleanupFunction } from './dialog'

export function onClickOutside(
    elements: HTMLElement | HTMLElement[],
    callback: (event: PointerEvent) => void,
): CleanupFunction {
    const targets = Array.isArray(elements) ? elements : [elements]

    function handler(event: PointerEvent) {
        const target = event.target as Node

        for (const el of targets) {
            if (el.contains(target)) {
                return
            }
        }

        // Check if the click target is inside a portal element
        let node: Node | null = target
        while (node) {
            if (node instanceof HTMLElement && node.hasAttribute('data-inertiaui-portal')) {
                return
            }
            node = node.parentNode
        }

        callback(event)
    }

    // Use a timeout so the click that opened the element doesn't immediately close it
    const timeoutId = setTimeout(() => {
        document.addEventListener('pointerdown', handler, true)
    }, 0)

    let cleaned = false
    return function cleanup() {
        if (cleaned) {
            return
        }
        cleaned = true
        clearTimeout(timeoutId)
        document.removeEventListener('pointerdown', handler, true)
    }
}
