import type { CleanupFunction } from './dialog'

export function onClickOutside(
    elements: HTMLElement | HTMLElement[],
    callback: (event: PointerEvent) => void,
): CleanupFunction {
    const targets = Array.isArray(elements) ? elements : [elements]
    let abortController: AbortController | null = null
    let listening = false

    function handler(event: PointerEvent) {
        const target = event.target as Node

        for (const el of targets) {
            if (el.contains(target)) {
                return
            }
        }

        // Check if the click target is inside a portal element
        let node = target instanceof Element ? target : target?.parentElement
        while (node) {
            const portal = node.closest('[data-inertiaui-portal]')
            if (!portal) {
                break
            }
            if (portal instanceof HTMLElement) {
                return
            }
            // SVG markers are not HTML portals; continue looking above them.
            node = portal.parentElement
        }

        callback(event)
    }

    function addListener() {
        listening = true

        if (typeof AbortController !== 'undefined') {
            try {
                abortController = new AbortController()
                document.addEventListener('pointerdown', handler, {
                    capture: true,
                    signal: abortController.signal,
                })
                return
            } catch {
                abortController = null
            }
        }

        document.addEventListener('pointerdown', handler, true)
    }

    // Use a timeout so the click that opened the element doesn't immediately close it
    const timeoutId = setTimeout(() => {
        addListener()
    }, 0)

    let cleaned = false
    return function cleanup() {
        if (cleaned) {
            return
        }
        cleaned = true
        clearTimeout(timeoutId)
        if (abortController) {
            abortController.abort()
        } else if (listening) {
            document.removeEventListener('pointerdown', handler, true)
        }
    }
}
