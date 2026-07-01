import type { CleanupFunction } from './dialog'
import { generateId } from './helpers'

export type Placement =
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end'
    | 'right'
    | 'right-start'
    | 'right-end'

export interface PositionOptions {
    placement?: Placement
    offset?: number
    flip?: boolean
    /**
     * Constrain the floating element to the available viewport space by setting
     * `max-height` and `overflow-y: auto`. Mirrors the auto-sizing Headless UI
     * applied via its `anchor` prop, so long menus scroll instead of overflowing.
     */
    autoSize?: boolean
}

export interface TopLayerPopoverPositionOptions {
    placement?: Placement
    offset?: number
    flip?: boolean
    matchReferenceWidth?: boolean
    viewportMargin?: number
}

export interface PositionResult {
    x: number
    y: number
    placement: Placement
}

interface ViewportRect {
    top: number
    right: number
    bottom: number
    left: number
    width: number
    height: number
}

interface FloatingSize {
    width: number
    height: number
}

const ANCHOR_CLASS_PREFIX = 'iui-anchor-'

let _supportsAnchor: boolean | null = null

export function supportsAnchorPositioning(): boolean {
    if (_supportsAnchor === null) {
        _supportsAnchor =
            typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('anchor-name', '--a')
    }
    return _supportsAnchor
}

function isRtl(): boolean {
    return typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
}

function getOppositePlacement(placement: Placement): Placement {
    const map: Record<string, Placement> = {
        top: 'bottom',
        'top-start': 'bottom-start',
        'top-end': 'bottom-end',
        bottom: 'top',
        'bottom-start': 'top-start',
        'bottom-end': 'top-end',
        left: 'right',
        'left-start': 'right-start',
        'left-end': 'right-end',
        right: 'left',
        'right-start': 'left-start',
        'right-end': 'left-end',
    }
    return map[placement] || placement
}

function getViewportRect(): ViewportRect {
    const visualViewport = window.visualViewport

    if (visualViewport) {
        return {
            top: visualViewport.offsetTop,
            right: visualViewport.offsetLeft + visualViewport.width,
            bottom: visualViewport.offsetTop + visualViewport.height,
            left: visualViewport.offsetLeft,
            width: visualViewport.width,
            height: visualViewport.height,
        }
    }

    return {
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
    }
}

function clamp(value: number, min: number, max: number): number {
    if (max < min) {
        return min
    }

    return Math.max(min, Math.min(value, max))
}

function getAvailableSpace(
    referenceRect: DOMRect,
    viewport: ViewportRect,
    side: string,
    offset: number,
    margin: number,
): number {
    if (side === 'top') {
        return referenceRect.top - viewport.top - offset - margin
    }

    if (side === 'bottom') {
        return viewport.bottom - referenceRect.bottom - offset - margin
    }

    if (side === 'left') {
        return referenceRect.left - viewport.left - offset - margin
    }

    if (side === 'right') {
        return viewport.right - referenceRect.right - offset - margin
    }

    return viewport.height - margin * 2
}

function resolveTopLayerPlacement(
    preferredPlacement: Placement,
    referenceRect: DOMRect,
    floatingSize: FloatingSize,
    viewport: ViewportRect,
    offset: number,
    margin: number,
    flip: boolean,
): Placement {
    if (!flip) {
        return preferredPlacement
    }

    const [side] = preferredPlacement.split('-')
    const oppositePlacement = getOppositePlacement(preferredPlacement)
    const [oppositeSide] = oppositePlacement.split('-')
    const floatingLength = side === 'left' || side === 'right' ? floatingSize.width : floatingSize.height
    const preferredSpace = getAvailableSpace(referenceRect, viewport, side, offset, margin)
    const oppositeSpace = getAvailableSpace(referenceRect, viewport, oppositeSide, offset, margin)

    if (floatingLength > preferredSpace && oppositeSpace > preferredSpace) {
        return oppositePlacement
    }

    return preferredPlacement
}

function computePositionFromRect(
    refRect: DOMRect,
    floatingRect: DOMRect,
    placement: Placement,
    offset: number,
): { x: number; y: number } {
    let x = 0
    let y = 0

    const [side, alignment] = placement.split('-') as [string, string | undefined]
    const rtl = isRtl()

    // Calculate position based on side
    switch (side) {
        case 'bottom':
            y = refRect.bottom + offset
            break
        case 'top':
            y = refRect.top - floatingRect.height - offset
            break
        case 'left':
            x = refRect.left - floatingRect.width - offset
            break
        case 'right':
            x = refRect.right + offset
            break
    }

    // Calculate alignment (RTL-aware for start/end)
    if (side === 'bottom' || side === 'top') {
        const startIsLeft = !rtl
        switch (alignment) {
            case 'start':
                x = startIsLeft ? refRect.left : refRect.right - floatingRect.width
                break
            case 'end':
                x = startIsLeft ? refRect.right - floatingRect.width : refRect.left
                break
            default:
                x = refRect.left + (refRect.width - floatingRect.width) / 2
                break
        }
    } else {
        switch (alignment) {
            case 'start':
                y = refRect.top
                break
            case 'end':
                y = refRect.bottom - floatingRect.height
                break
            default:
                y = refRect.top + (refRect.height - floatingRect.height) / 2
                break
        }
    }

    return { x, y }
}

function wouldOverflow(x: number, y: number, floatingRect: DOMRect, placement: Placement): boolean {
    const [side] = placement.split('-')
    const vw = window.innerWidth
    const vh = window.innerHeight

    switch (side) {
        case 'bottom':
            return y + floatingRect.height > vh
        case 'top':
            return y < 0
        case 'left':
            return x < 0
        case 'right':
            return x + floatingRect.width > vw
        default:
            return false
    }
}

function clampToViewport(x: number, y: number, floatingRect: DOMRect): { x: number; y: number } {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 4

    return {
        x: Math.max(margin, Math.min(x, vw - floatingRect.width - margin)),
        y: Math.max(margin, Math.min(y, vh - floatingRect.height - margin)),
    }
}

function computeWithFallback(
    reference: HTMLElement,
    floating: HTMLElement,
    options: PositionOptions = {},
): PositionResult {
    const { placement = 'bottom-start', offset = 0, flip = true } = options

    const refRect = reference.getBoundingClientRect()
    const floatingRect = floating.getBoundingClientRect()

    let { x, y } = computePositionFromRect(refRect, floatingRect, placement, offset)
    let actualPlacement = placement

    // Flip to opposite side if overflowing
    if (flip && wouldOverflow(x, y, floatingRect, placement)) {
        const flipped = getOppositePlacement(placement)
        const flippedPos = computePositionFromRect(refRect, floatingRect, flipped, offset)

        if (!wouldOverflow(flippedPos.x, flippedPos.y, floatingRect, flipped)) {
            x = flippedPos.x
            y = flippedPos.y
            actualPlacement = flipped
        }
    }

    // Clamp to viewport edges
    const clamped = clampToViewport(x, y, floatingRect)

    return { x: clamped.x, y: clamped.y, placement: actualPlacement }
}

// CSS Anchor Positioning approach
const anchorStyleId = 'inertiaui-anchor-styles'

function ensureAnchorStylesheet(): CSSStyleSheet {
    let style = document.getElementById(anchorStyleId) as HTMLStyleElement | null
    if (!style) {
        style = document.createElement('style')
        style.id = anchorStyleId
        document.head.appendChild(style)
    }
    return style.sheet!
}

function findAnchorClass(element: HTMLElement): string | undefined {
    return Array.from(element.classList).find((c) => c.startsWith(ANCHOR_CLASS_PREFIX))
}

function setupAnchorPositioning(
    reference: HTMLElement,
    floating: HTMLElement,
    placement: Placement,
    offset: number,
    flip: boolean,
): string {
    const id = generateId(ANCHOR_CLASS_PREFIX)
    const anchorName = `--${id}`

    ;(reference.style as any).anchorName = anchorName
    ;(floating.style as any).positionAnchor = anchorName
    floating.style.position = 'fixed'

    const [side, alignment] = placement.split('-') as [string, string | undefined]

    // Map placement to CSS anchor functions
    const sheet = ensureAnchorStylesheet()
    const className = id

    let positionRules = ''
    let tryFallback = ''

    switch (side) {
        case 'bottom':
            positionRules += `top: anchor(bottom);`
            positionRules += `margin-top: ${offset}px;`
            break
        case 'top':
            positionRules += `bottom: anchor(top);`
            positionRules += `margin-bottom: ${offset}px;`
            break
        case 'left':
            positionRules += `right: anchor(left);`
            positionRules += `margin-right: ${offset}px;`
            break
        case 'right':
            positionRules += `left: anchor(right);`
            positionRules += `margin-left: ${offset}px;`
            break
    }

    if (side === 'bottom' || side === 'top') {
        switch (alignment) {
            case 'start':
                positionRules += `left: anchor(left);`
                break
            case 'end':
                positionRules += `right: anchor(right);`
                break
            default:
                positionRules += `left: anchor(center); translate: -50% 0;`
                break
        }
    } else {
        switch (alignment) {
            case 'start':
                positionRules += `top: anchor(top);`
                break
            case 'end':
                positionRules += `bottom: anchor(bottom);`
                break
            default:
                positionRules += `top: anchor(center); translate: 0 -50%;`
                break
        }
    }

    if (flip) {
        tryFallback = `position-try-fallbacks: flip-block, flip-inline;`
    }

    const rule = `.${className} { ${positionRules} ${tryFallback} }`
    sheet.insertRule(rule, sheet.cssRules.length)

    floating.classList.add(className)

    return className
}

function cleanupAnchorPositioning(reference: HTMLElement, floating: HTMLElement, className: string) {
    ;(reference.style as any).anchorName = ''
    ;(floating.style as any).positionAnchor = ''
    floating.style.position = ''
    floating.classList.remove(className)

    const style = document.getElementById(anchorStyleId) as HTMLStyleElement | null
    if (style?.sheet) {
        for (let i = 0; i < style.sheet.cssRules.length; i++) {
            const rule = style.sheet.cssRules[i] as CSSStyleRule
            if (rule.selectorText === `.${className}`) {
                style.sheet.deleteRule(i)
                break
            }
        }
    }
}

function detachAnchorPositioning(reference: HTMLElement, floating: HTMLElement): void {
    reference.style.removeProperty('anchor-name')
    floating.style.removeProperty('position-anchor')

    for (const className of Array.from(floating.classList)) {
        if (className.startsWith(ANCHOR_CLASS_PREFIX)) {
            floating.classList.remove(className)
        }
    }
}

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
function applySize(reference: HTMLElement, floating: HTMLElement, offset: number, side?: string): void {
    const refRect = reference.getBoundingClientRect()
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

    if (supportsAnchorPositioning()) {
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
    if (autoSize) {
        applySize(reference, floating, offset, placement.split('-')[0])
    }
    const result = computeWithFallback(reference, floating, { placement, offset, flip })
    floating.style.position = 'fixed'
    floating.style.top = `${result.y}px`
    floating.style.left = `${result.x}px`
    if (autoSize) {
        applySize(reference, floating, offset, result.placement.split('-')[0])
    }
    return result
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
    window.addEventListener('scroll', scheduleUpdate, true)

    const resizeObserver = new ResizeObserver(scheduleUpdate)
    resizeObserver.observe(reference)
    resizeObserver.observe(floating)

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
        resizeObserver.disconnect()

        // Cleanup CSS anchor positioning if used
        const anchorClass = findAnchorClass(floating)
        if (anchorClass) {
            cleanupAnchorPositioning(reference, floating, anchorClass)
        }
    }
}

export function positionTopLayerPopover(
    reference: HTMLElement,
    floating: HTMLElement,
    options: TopLayerPopoverPositionOptions = {},
): PositionResult {
    const {
        placement = 'bottom-start',
        offset = 4,
        flip = true,
        matchReferenceWidth = false,
        viewportMargin = 8,
    } = options
    const viewport = getViewportRect()
    const maxWidth = Math.max(0, Math.floor(viewport.width - viewportMargin * 2))

    detachAnchorPositioning(reference, floating)

    floating.style.position = 'fixed'
    floating.style.inset = 'auto'
    floating.style.right = 'auto'
    floating.style.bottom = 'auto'
    floating.style.margin = '0'
    floating.style.boxSizing = 'border-box'
    floating.style.maxWidth = `${maxWidth}px`
    floating.style.overflowX = 'auto'
    floating.style.overflowY = 'auto'
    floating.style.overscrollBehavior = 'contain'

    const referenceRect = reference.getBoundingClientRect()

    if (matchReferenceWidth) {
        floating.style.width = `${Math.min(referenceRect.width, maxWidth)}px`
    }

    const measuredRect = floating.getBoundingClientRect()
    const naturalSize = {
        width: Math.max(measuredRect.width, floating.scrollWidth),
        height: Math.max(measuredRect.height, floating.scrollHeight),
    }
    const resolvedPlacement = resolveTopLayerPlacement(
        placement,
        referenceRect,
        naturalSize,
        viewport,
        offset,
        viewportMargin,
        flip,
    )
    const [resolvedSide] = resolvedPlacement.split('-')
    const availableHeight = Math.max(
        0,
        Math.floor(getAvailableSpace(referenceRect, viewport, resolvedSide, offset, viewportMargin)),
    )

    if (resolvedSide === 'top' || resolvedSide === 'bottom') {
        floating.style.maxHeight = `${availableHeight}px`
    } else {
        floating.style.maxHeight = `${Math.max(0, Math.floor(viewport.height - viewportMargin * 2))}px`
    }

    const floatingRect = floating.getBoundingClientRect()
    const coordinates = computePositionFromRect(referenceRect, floatingRect, resolvedPlacement, offset)
    const x = clamp(coordinates.x, viewport.left + viewportMargin, viewport.right - floatingRect.width - viewportMargin)
    const y = clamp(
        coordinates.y,
        viewport.top + viewportMargin,
        viewport.bottom - floatingRect.height - viewportMargin,
    )

    floating.style.left = `${Math.round(x)}px`
    floating.style.top = `${Math.round(y)}px`

    return { x, y, placement: resolvedPlacement }
}

export function autoUpdateTopLayerPopover(
    reference: HTMLElement,
    floating: HTMLElement,
    update: () => void,
): CleanupFunction {
    const cleanupAutoUpdate = autoUpdate(reference, floating, update)
    const visualViewport = window.visualViewport
    let rafId: number | null = null

    const scheduleUpdate = () => {
        if (rafId !== null) {
            return
        }

        rafId = requestAnimationFrame(() => {
            rafId = null
            update()
        })
    }

    visualViewport?.addEventListener('resize', scheduleUpdate)
    visualViewport?.addEventListener('scroll', scheduleUpdate)

    return () => {
        cleanupAutoUpdate()

        if (rafId !== null) {
            cancelAnimationFrame(rafId)
            rafId = null
        }

        visualViewport?.removeEventListener('resize', scheduleUpdate)
        visualViewport?.removeEventListener('scroll', scheduleUpdate)
    }
}
