import type { FloatingSize, Placement, PositionOptions, PositionResult, ViewportRect } from './types'

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

export function getViewportRect(): ViewportRect {
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

export function clampTopLayerCoordinates(
    x: number,
    y: number,
    floatingRect: DOMRect,
    placement: Placement,
    viewport: ViewportRect,
    margin: number,
): { x: number; y: number } {
    const [side] = placement.split('-')
    const minX = viewport.left + margin
    const maxX = viewport.right - floatingRect.width - margin
    const minY = viewport.top + margin
    const maxY = viewport.bottom - floatingRect.height - margin

    if (side === 'top' || side === 'bottom') {
        return {
            x: clamp(x, minX, maxX),
            y,
        }
    }

    if (side === 'left' || side === 'right') {
        return {
            x,
            y: clamp(y, minY, maxY),
        }
    }

    return {
        x: clamp(x, minX, maxX),
        y: clamp(y, minY, maxY),
    }
}

export function topLayerRectOverflowsViewport(rect: DOMRect, viewport: ViewportRect): boolean {
    const tolerance = 0.5

    return (
        rect.top < viewport.top - tolerance ||
        rect.left < viewport.left - tolerance ||
        rect.right > viewport.right + tolerance ||
        rect.bottom > viewport.bottom + tolerance
    )
}

export function referenceIntersectsViewport(reference: HTMLElement): boolean {
    const rect = reference.getBoundingClientRect()
    const viewport = getViewportRect()

    return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > viewport.top &&
        rect.top < viewport.bottom &&
        rect.right > viewport.left &&
        rect.left < viewport.right
    )
}

export function getAvailableSpace(
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

export function resolveTopLayerPlacement(
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

export function computePositionFromRect(
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

export function computeWithFallback(
    reference: HTMLElement,
    floating: HTMLElement,
    options: PositionOptions = {},
    referenceRect?: DOMRect,
): PositionResult {
    const { placement = 'bottom-start', offset = 0, flip = true } = options

    const refRect = referenceRect ?? reference.getBoundingClientRect()
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
