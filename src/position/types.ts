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
    anchorPositioning?: boolean
}

export interface PositionResult {
    x: number
    y: number
    placement: Placement
}

export interface ViewportRect {
    top: number
    right: number
    bottom: number
    left: number
    width: number
    height: number
}

export interface FloatingSize {
    width: number
    height: number
}

export interface TopLayerElementResizeObserver {
    cleanup: () => void
    syncFloatingObserver: () => void
}

export interface StoredStyleProperty {
    value: string
    priority: string
}

export interface StoredParkedStyles {
    visibility: StoredStyleProperty
    transition: StoredStyleProperty
    animation: StoredStyleProperty
}
