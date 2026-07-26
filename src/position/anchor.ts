import { generateId } from '../helpers'
import { removeStyleProperty, setStyleProperty } from './style'
import type { Placement } from './types'

const ANCHOR_CLASS_PREFIX = 'iui-anchor-'

let _supportsAnchor: boolean | null = null
let _supportsAnchorFlip: boolean | null = null
let _supportsTopLayerAnchor: boolean | null = null
let _supportsTopLayerAnchorSizing: boolean | null = null
let _isWebKit: boolean | null = null

export function supportsAnchorPositioning(): boolean {
    if (_supportsAnchor === null) {
        _supportsAnchor =
            typeof CSS !== 'undefined' &&
            typeof CSS.supports === 'function' &&
            CSS.supports('anchor-name', '--a') &&
            CSS.supports('position-anchor', '--a') &&
            CSS.supports('top', 'anchor(bottom)')
    }
    return _supportsAnchor
}

export function supportsTopLayerAnchorPositioning(): boolean {
    if (_supportsTopLayerAnchor === null) {
        _supportsTopLayerAnchor =
            supportsAnchorPositioning() && CSS.supports('width', 'anchor-size(width)') && !isWebKit()
    }

    return _supportsTopLayerAnchor
}

function isWebKit(): boolean {
    if (_isWebKit === null) {
        _isWebKit =
            typeof CSS !== 'undefined' &&
            typeof CSS.supports === 'function' &&
            CSS.supports('-webkit-backdrop-filter', 'none')
    }

    return _isWebKit
}

export function supportsAnchorFlip(): boolean {
    if (_supportsAnchorFlip === null) {
        _supportsAnchorFlip =
            supportsAnchorPositioning() &&
            (CSS.supports('position-try-fallbacks', 'flip-block') || CSS.supports('position-try', 'flip-block'))
    }

    return _supportsAnchorFlip
}

export function supportsTopLayerAnchorSizing(): boolean {
    if (_supportsTopLayerAnchorSizing === null) {
        _supportsTopLayerAnchorSizing =
            supportsTopLayerAnchorPositioning() &&
            CSS.supports('height', 'max-content') &&
            CSS.supports('max-height', 'stretch')
    }

    return _supportsTopLayerAnchorSizing
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

export function findAnchorClass(element: HTMLElement): string | undefined {
    return Array.from(element.classList).find((c) => c.startsWith(ANCHOR_CLASS_PREFIX))
}

function removeAnchorRule(className: string): void {
    const style = document.getElementById(anchorStyleId) as HTMLStyleElement | null
    if (!style?.sheet) return

    for (let i = 0; i < style.sheet.cssRules.length; i++) {
        const rule = style.sheet.cssRules[i] as CSSStyleRule
        if (rule.selectorText === `.${className}`) {
            style.sheet.deleteRule(i)
            return
        }
    }
}

export function setupAnchorPositioning(
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

    const sheet = ensureAnchorStylesheet()
    const className = id

    const positionRules = getAnchorPositionRules(placement, offset)
    let tryFallback = ''

    if (flip) {
        tryFallback = `position-try-fallbacks: flip-block, flip-inline; position-try: flip-block, flip-inline;`
    }

    const rule = `.${className} { ${positionRules} ${tryFallback} }`
    sheet.insertRule(rule, sheet.cssRules.length)

    floating.classList.add(className)

    return className
}

export function cleanupAnchorPositioning(reference: HTMLElement, floating: HTMLElement, className: string) {
    ;(reference.style as any).anchorName = ''
    ;(floating.style as any).positionAnchor = ''
    floating.style.position = ''
    floating.classList.remove(className)

    removeAnchorRule(className)
}

export function detachAnchorPositioning(reference: HTMLElement, floating: HTMLElement): void {
    reference.style.removeProperty('anchor-name')
    floating.style.removeProperty('position-anchor')

    for (const className of Array.from(floating.classList)) {
        if (className.startsWith(ANCHOR_CLASS_PREFIX)) {
            floating.classList.remove(className)
            removeAnchorRule(className)
        }
    }
}

function getAnchorPositionRules(placement: Placement, offset: number): string {
    const [side, alignment] = placement.split('-') as [string, string | undefined]
    let positionRules = ''

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

    return positionRules
}

function getTopLayerAnchorSizingRules(placement: Placement, viewportMargin: number): string {
    const [side] = placement.split('-')

    if (side === 'bottom') {
        return `bottom: ${viewportMargin}px; height: max-content; max-height: stretch;`
    }

    if (side === 'top') {
        return `top: ${viewportMargin}px; height: max-content; max-height: stretch; align-self: end;`
    }

    return ''
}

export function setupTopLayerAnchorPositioning(
    reference: HTMLElement,
    floating: HTMLElement,
    placement: Placement,
    offset: number,
    flip: boolean,
    matchReferenceWidth: boolean,
    maxWidth: number,
    viewportMargin: number,
    stretchToAvailableHeight: boolean,
): string {
    const existingClass = findAnchorClass(floating)
    const existingAnchorName = existingClass ? `--${existingClass}` : ''
    const canReuseAnchor =
        !!existingClass &&
        reference.style.getPropertyValue('anchor-name') === existingAnchorName &&
        floating.style.getPropertyValue('position-anchor') === existingAnchorName
    const className = canReuseAnchor ? existingClass : generateId(ANCHOR_CLASS_PREFIX)
    const anchorName = `--${className}`
    const sheet = ensureAnchorStylesheet()

    if (canReuseAnchor) {
        removeAnchorRule(className)
    } else {
        detachAnchorPositioning(reference, floating)
    }

    ;(reference.style as any).anchorName = anchorName
    ;(floating.style as any).positionAnchor = anchorName

    removeStyleProperty(floating.style, 'inset')
    removeStyleProperty(floating.style, 'top')
    removeStyleProperty(floating.style, 'right')
    removeStyleProperty(floating.style, 'bottom')
    removeStyleProperty(floating.style, 'left')
    removeStyleProperty(floating.style, 'margin')
    setStyleProperty(floating.style, 'position', 'fixed')
    if (stretchToAvailableHeight) {
        setStyleProperty(floating.style, 'height', 'max-content')
        removeStyleProperty(floating.style, 'max-height')
    } else {
        removeStyleProperty(floating.style, 'height')
    }
    if (matchReferenceWidth) {
        setStyleProperty(floating.style, 'width', `min(anchor-size(width), ${maxWidth}px)`)
    }

    const positionRules = getAnchorPositionRules(placement, offset)
    const tryFallbackRules = flip
        ? 'position-try-fallbacks: flip-block, flip-inline; position-try: flip-block, flip-inline;'
        : ''
    const sizeRules = matchReferenceWidth ? `width: min(anchor-size(width), ${maxWidth}px);` : ''
    const heightRules = stretchToAvailableHeight ? getTopLayerAnchorSizingRules(placement, viewportMargin) : ''
    const rule = `.${className} { position: fixed; inset: auto; margin: 0; ${positionRules} ${tryFallbackRules} ${sizeRules} ${heightRules} }`

    sheet.insertRule(rule, sheet.cssRules.length)
    floating.classList.add(className)

    return className
}
