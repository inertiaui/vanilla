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
}

export interface PositionResult {
    x: number
    y: number
    placement: Placement
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

export function computePosition(
    reference: HTMLElement,
    floating: HTMLElement,
    options: PositionOptions = {},
): PositionResult {
    const { placement = 'bottom-start', offset = 0, flip = true } = options

    if (supportsAnchorPositioning()) {
        // CSS handles the positioning — just set it up and return current coords
        const existingClass = findAnchorClass(floating)
        if (!existingClass) {
            setupAnchorPositioning(reference, floating, placement, offset, flip)
        }
        const rect = floating.getBoundingClientRect()
        return { x: rect.left, y: rect.top, placement }
    }

    // JS fallback
    const result = computeWithFallback(reference, floating, { placement, offset, flip })
    floating.style.position = 'fixed'
    floating.style.top = `${result.y}px`
    floating.style.left = `${result.x}px`
    return result
}

export function autoUpdate(
    reference: HTMLElement,
    floating: HTMLElement,
    update: () => void,
): CleanupFunction {
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
