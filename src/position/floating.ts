import type { CleanupFunction } from '../dialog'
import {
    cleanupAnchorPositioning,
    findAnchorClass,
    setupAnchorPositioning,
    supportsAnchorFlip,
    supportsAnchorPositioning,
} from './anchor'
import { computeWithFallback } from './geometry'
import type { PositionOptions, PositionResult } from './types'

// Margin between the floating element and the viewport edge when sizing.
const SIZE_MARGIN = 8

/**
 * Cap the floating element's height to the space available between its anchored
 * edge and the viewport edge, adding a scrollbar when the content is taller.
 *
 * On the JS fallback path the resolved `side` is known, so the available space is
 * measured from the reference rect (the clamp may have shifted the floating rect,
 * which would otherwise confuse a rect-based heuristic). On the CSS Anchor path the
 * resolved side is not known to JS after a `position-try` flip, so the open
 * direction is derived from the rendered rects: a menu whose top sits above the
 * reference opens upward (its bottom edge is anchored); otherwise it opens downward.
 */
function applySize(
    reference: HTMLElement,
    floating: HTMLElement,
    offset: number,
    side?: string,
    refRect?: DOMRect,
): void {
    refRect ??= reference.getBoundingClientRect()
    const vh = window.innerHeight

    let available: number
    if (side === 'top') {
        available = refRect.top - offset - SIZE_MARGIN
    } else if (side === 'bottom') {
        available = vh - refRect.bottom - offset - SIZE_MARGIN
    } else if (side === 'left' || side === 'right') {
        // Side placements align vertically near the reference top.
        available = vh - refRect.top - SIZE_MARGIN
    } else {
        // CSS Anchor path: infer direction from the rendered position.
        const rect = floating.getBoundingClientRect()
        available = rect.top < refRect.top ? rect.bottom - SIZE_MARGIN : vh - rect.top - SIZE_MARGIN
    }

    // Floor to whole pixels to avoid a subpixel scrollbar, and let consumers cap
    // the height further via a CSS variable (mirrors Headless UI's --anchor-max-height).
    floating.style.maxHeight = `min(var(--iui-max-height, 100vh), ${Math.floor(Math.max(0, available))}px)`
    floating.style.overflowY = 'auto'
}

export function computePosition(
    reference: HTMLElement,
    floating: HTMLElement,
    options: PositionOptions = {},
): PositionResult {
    const { placement = 'bottom-start', offset = 0, flip = true, autoSize = false } = options

    if (supportsAnchorPositioning() && (!flip || supportsAnchorFlip())) {
        // CSS handles the positioning — just set it up and return current coords
        const existingClass = findAnchorClass(floating)
        if (!existingClass) {
            setupAnchorPositioning(reference, floating, placement, offset, flip)
        }
        if (autoSize) {
            applySize(reference, floating, offset)
        }
        const rect = floating.getBoundingClientRect()
        return { x: rect.left, y: rect.top, placement }
    }

    // JS fallback. Pre-size with the requested side so a tall element is already
    // capped before positioning, avoiding a first-frame clamp to the viewport edge.
    let referenceRect: DOMRect | undefined
    if (autoSize) {
        referenceRect = reference.getBoundingClientRect()
        applySize(reference, floating, offset, placement.split('-')[0], referenceRect)
    }
    const result = computeWithFallback(reference, floating, { placement, offset, flip }, referenceRect)
    floating.style.position = 'fixed'
    floating.style.top = `${result.y}px`
    floating.style.left = `${result.x}px`
    if (autoSize) {
        applySize(reference, floating, offset, result.placement.split('-')[0], referenceRect)
    }
    return result
}

function observeElementResize(
    reference: HTMLElement,
    floating: HTMLElement,
    scheduleUpdate: () => void,
): CleanupFunction {
    if (typeof ResizeObserver !== 'function') {
        return () => {}
    }

    let reobserveFrame: number | undefined
    const resizeObserver = new ResizeObserver(([firstEntry]) => {
        const referenceResized = firstEntry?.target === reference

        if (referenceResized) {
            // If update() changes the floating element's size constraints, observing
            // it continuously can produce ResizeObserver feedback loops.
            resizeObserver.unobserve(floating)
        }

        scheduleUpdate()

        if (referenceResized) {
            if (reobserveFrame !== undefined) {
                cancelAnimationFrame(reobserveFrame)
            }

            reobserveFrame = requestAnimationFrame(() => {
                reobserveFrame = undefined
                resizeObserver.observe(floating)
            })
        }
    })

    resizeObserver.observe(reference)
    resizeObserver.observe(floating)

    return () => {
        if (reobserveFrame !== undefined) {
            cancelAnimationFrame(reobserveFrame)
            reobserveFrame = undefined
        }

        resizeObserver.disconnect()
    }
}

export function autoUpdate(reference: HTMLElement, floating: HTMLElement, update: () => void): CleanupFunction {
    let rafId: number | undefined

    function scheduleUpdate() {
        if (rafId !== undefined) {
            return
        }
        rafId = requestAnimationFrame(() => {
            rafId = undefined
            update()
        })
    }

    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true })

    const cleanupResizeObserver = observeElementResize(reference, floating, scheduleUpdate)

    let cleaned = false
    return function cleanup() {
        if (cleaned) {
            return
        }
        cleaned = true

        if (rafId !== undefined) {
            cancelAnimationFrame(rafId)
        }

        window.removeEventListener('resize', scheduleUpdate)
        window.removeEventListener('scroll', scheduleUpdate, true)
        cleanupResizeObserver()

        // Cleanup CSS anchor positioning if used
        const anchorClass = findAnchorClass(floating)
        if (anchorClass) {
            cleanupAnchorPositioning(reference, floating, anchorClass)
        }
    }
}
