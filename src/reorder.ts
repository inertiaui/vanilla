import type { CleanupFunction } from './dialog'

/**
 * Attribute a caller places on a drag handle element so the pointer controller
 * can verify that a pointer interaction started on an actual reorder handle.
 */
export const REORDERABLE_LIST_HANDLE_ATTRIBUTE = 'data-reorderable-list-handle'

export type ReorderDirection = 'up' | 'down'
export type ReorderSource = 'keyboard' | 'pointer'

export type ReorderPoint = {
    clientX: number
    clientY: number
}

export type ReorderPointer = {
    /** Where the press started. */
    readonly origin: ReorderPoint
    /** The latest pointer position. */
    readonly position: ReorderPoint
}

type ReorderHitBox = ReorderBounds & {
    index: number
}

export type ReorderBounds = {
    left: number
    top: number
    right: number
    bottom: number
}

export type AutoScrollAxis = 'x' | 'y' | 'both'
export type AutoScrollContainer = Element | Window

export type ReorderMove<T> = {
    item: T
    fromIndex: number
    toIndex: number
    source: ReorderSource
}

export interface AutoScrollerOptions {
    /** Edge size in CSS pixels that starts scrolling. Defaults to 48. */
    edgeThreshold?: number
    /** Maximum scroll speed in CSS pixels per second. Defaults to 720. */
    maxSpeed?: number
    /** Limit scrolling to one axis. Defaults to both axes. */
    axis?: AutoScrollAxis
    /** Override scroll containers. Defaults to scrollable ancestors plus window. */
    getScrollContainers?: (element: Element | null) => AutoScrollContainer[]
    /** Called once per animation frame after one or more containers scrolled. */
    onScroll?: () => void
}

interface AutoScrollerController {
    /** Update the latest pointer position and optional element used to find scroll ancestors. */
    update: (point: ReorderPoint, element?: Element | null) => void
    /** Stop any pending auto-scroll frame without disabling future updates. */
    stop: CleanupFunction
    /** Stop permanently and cancel all pending work. Idempotent. */
    cleanup: CleanupFunction
}

interface ReorderInsertionOptions {
    /**
     * Optional outer hit area for list chrome around the items, such as table
     * headers or empty padding. Item midpoint math still uses the item boxes.
     */
    bounds?: ReorderBounds | null
    /** Read rows from right to left, as the list is written. */
    rightToLeft?: boolean
}

export type ReorderPreviewItem<T> = {
    item: T
    /** Index in the source item array. */
    index: number
    /** Index where the item is currently previewed visually. */
    visualIndex: number
}

export type ReorderableListState = {
    draggedIndex: number | null
    insertionIndex: number | null
    targetIndex: number | null
}

export type ReorderCommitContext = {
    /**
     * True when a pointer reorder already animated to the committed target
     * while dragging. Consumers can use this to avoid replaying the same
     * reorder animation on release.
     */
    alreadyPreviewed: boolean
}

export interface ReorderableListOptions<T> {
    /** Return the current ordered items. */
    getItems: () => readonly T[]
    /** Optional writer used by `moveItem` and pointer commits. */
    setItems?: (items: T[]) => void
    /** Optional guard; reordering is skipped when it returns false. Defaults to true. */
    canReorder?: () => boolean
    /** Optional outer collision bounds. Defaults to the registered list element rect. */
    getBounds?: () => ReorderBounds | null
    /** Optional edge auto-scroll while pointer-dragging. Disabled by default. */
    autoScroll?: boolean | AutoScrollerOptions
    /**
     * Pointer travel in CSS pixels before a press starts dragging. Until then the
     * press keeps its native click, focus, and scrolling. Defaults to 0, which
     * starts dragging on press.
     */
    activationDistance?: number
    /** Ignore the click that follows a pointer drag, so releasing over a control does not activate it. Defaults to false. */
    suppressClickAfterDrag?: boolean
    /**
     * Point that picks the drop slot while pointer-dragging, given the pointer and
     * the dragged item's box as measured when the drag started. Returning the
     * item's leading edge lets items of different sizes swap once the dragged
     * item covers half of a neighbor. The point is clamped to the items' extent,
     * and returning null uses the pointer, which is also the default. Whether a
     * release drops or cancels always follows the pointer itself.
     */
    getCollisionPoint?: (pointer: ReorderPointer, item: ReorderBounds) => ReorderPoint | null
    /** Called whenever pointer drag state changes. */
    onChange?: (state: ReorderableListState) => void
    /** Called immediately before items are written or `onReorder` fires. */
    onBeforeReorder?: (move: ReorderMove<T>, context: ReorderCommitContext) => void
    /** Called after a valid keyboard or pointer reorder. */
    onReorder?: (move: ReorderMove<T>, context: ReorderCommitContext) => void
}

export interface ReorderableListController<T> {
    /** Register the outer list element used for default bounds and auto-scroll ancestry. */
    setListElement: (element: HTMLElement | null | undefined) => void
    /** Register or unregister an item element by source index. */
    setItemElement: (index: number, element: HTMLElement | null | undefined) => void
    /** Current registered item elements ordered by index. */
    getItemElements: () => HTMLElement[]
    /** Source indices in the order they should render for the live pointer preview. */
    getPreviewOrder: () => number[]
    /** Current items plus source and visual indices for the live pointer preview. */
    getPreviewItems: () => ReorderPreviewItem<T>[]
    /** Commit an up/down keyboard reorder. */
    moveItem: (index: number, direction: ReorderDirection) => ReorderMove<T> | null
    /** Begin a pointer reorder from a registered handle event. */
    pointerDown: (index: number, event: PointerEvent) => void
    /**
     * Pointer positions of the active drag, or null while idle and before a press
     * starts dragging. The object lives for the whole gesture and its `position`
     * is replaced as the pointer moves, so copy the values you need to keep.
     */
    getPointer: () => ReorderPointer | null
    /**
     * End a pending press or active pointer drag without committing it. An active
     * drag notifies `onChange` with the idle state. The controller stays usable.
     */
    cancel: () => void
    /** Cancel active pointer work and remove global listeners without notifying `onChange`. Idempotent. */
    cleanup: CleanupFunction
}

/**
 * Return a new array with the item at `fromIndex` moved to `toIndex`.
 * Out-of-range or no-op moves return a shallow copy unchanged.
 */
function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
        return [...items]
    }

    const nextItems = [...items]
    const [item] = nextItems.splice(fromIndex, 1)

    nextItems.splice(toIndex, 0, item as T)

    return nextItems
}

function identityOrder(length: number): number[] {
    // Preallocate dense indexes without Array.from's per-item callback overhead.
    // oxlint-disable-next-line unicorn/no-new-array
    const order = new Array<number>(length)
    for (let index = 0; index < length; index++) {
        order[index] = index
    }
    return order
}

function isHTMLElement(value: unknown): value is HTMLElement {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement
}

function isMeasuredHitBox(hitBox: ReorderHitBox): boolean {
    return (
        Number.isFinite(hitBox.index) &&
        Number.isFinite(hitBox.left) &&
        Number.isFinite(hitBox.top) &&
        Number.isFinite(hitBox.right) &&
        Number.isFinite(hitBox.bottom) &&
        hitBox.left <= hitBox.right &&
        hitBox.top <= hitBox.bottom
    )
}

/** Move a point inside the area the measured items cover. */
function clampToHitBoxes(hitBoxes: readonly ReorderHitBox[], point: ReorderPoint): ReorderPoint {
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity

    for (const hitBox of hitBoxes) {
        if (isMeasuredHitBox(hitBox)) {
            left = Math.min(left, hitBox.left)
            top = Math.min(top, hitBox.top)
            right = Math.max(right, hitBox.right)
            bottom = Math.max(bottom, hitBox.bottom)
        }
    }

    return {
        clientX: Math.min(Math.max(point.clientX, left), right),
        clientY: Math.min(Math.max(point.clientY, top), bottom),
    }
}

/**
 * Resolve the insertion index for vertical lists and multi-item rows. Select
 * the first matching item by index (or left edge within a row) in one pass,
 * without sorting or allocating temporary arrays on every pointer move.
 */
function getInsertionIndexFromPoint(
    hitBoxes: readonly ReorderHitBox[],
    point: ReorderPoint,
    options: ReorderInsertionOptions = {},
): number | null {
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    let firstIndex = Infinity
    let lastIndex = -Infinity
    let verticalIndex = Infinity
    let rowCount = 0
    let rowMatch: ReorderHitBox | null = null
    let rowLast: ReorderHitBox | null = null
    // Where rowMatch and rowLast start along the row's reading direction.
    let rowMatchStart = 0
    let rowLastStart = 0
    // Right-to-left rows read mirrored, so their first item is the rightmost.
    const reading = options.rightToLeft ? -1 : 1

    for (const hitBox of hitBoxes) {
        if (!isMeasuredHitBox(hitBox)) {
            continue
        }

        left = Math.min(left, hitBox.left)
        top = Math.min(top, hitBox.top)
        right = Math.max(right, hitBox.right)
        bottom = Math.max(bottom, hitBox.bottom)
        firstIndex = Math.min(firstIndex, hitBox.index)
        lastIndex = Math.max(lastIndex, hitBox.index)

        if (point.clientY <= hitBox.top + (hitBox.bottom - hitBox.top) / 2) {
            // Equivalent to the first vertical midpoint in item-index order.
            verticalIndex = Math.min(verticalIndex, hitBox.index)
        }

        if (point.clientY >= hitBox.top && point.clientY <= hitBox.bottom) {
            // Rows use visual order in their reading direction, with item index breaking ties.
            rowCount++
            const start = options.rightToLeft ? -hitBox.right : hitBox.left
            if (!rowLast || start > rowLastStart || (start === rowLastStart && hitBox.index > rowLast.index)) {
                rowLast = hitBox
                rowLastStart = start
            }
            if (
                reading * point.clientX <= reading * (hitBox.left + (hitBox.right - hitBox.left) / 2) &&
                (!rowMatch || start < rowMatchStart || (start === rowMatchStart && hitBox.index < rowMatch.index))
            ) {
                rowMatch = hitBox
                rowMatchStart = start
            }
        }
    }

    if (firstIndex === Infinity) return null
    const bounds = options.bounds
    if (
        point.clientX < (bounds ? Math.min(left, bounds.left) : left) ||
        point.clientX > (bounds ? Math.max(right, bounds.right) : right) ||
        point.clientY < (bounds ? Math.min(top, bounds.top) : top) ||
        point.clientY > (bounds ? Math.max(bottom, bounds.bottom) : bottom)
    )
        return null

    if (point.clientY < top) return firstIndex
    if (point.clientY > bottom) return lastIndex + 1
    if (rowCount > 1) return rowMatch ? rowMatch.index : rowLast!.index + 1
    return verticalIndex === Infinity ? lastIndex + 1 : verticalIndex
}

/**
 * Convert an insertion index (0..count) into the destination array index for the
 * item currently dragged from `fromIndex`. Returns `null` when the move is a
 * no-op or out of range. Because removing the dragged item shifts everything
 * after it left by one, an insertion index past `fromIndex` maps to `index - 1`.
 */
function resolveTargetIndexFromInsertion(
    fromIndex: number,
    insertionIndex: number | null,
    itemCount: number,
): number | null {
    if (insertionIndex === null || itemCount < 2 || fromIndex < 0 || fromIndex >= itemCount) {
        return null
    }

    const boundedInsertionIndex = Math.max(0, Math.min(insertionIndex, itemCount))
    const targetIndex = boundedInsertionIndex > fromIndex ? boundedInsertionIndex - 1 : boundedInsertionIndex

    if (targetIndex < 0 || targetIndex >= itemCount) {
        return null
    }

    return targetIndex
}

export interface ReorderOffsetsOptions {
    /** Axis the items are laid out along. Defaults to `'y'`. */
    axis?: 'x' | 'y'
    /** The items run toward the start of the axis, as in a right-to-left row. Defaults to false. */
    reverse?: boolean
    /**
     * Space between neighboring items, used for both orders. Defaults to the gap
     * each slot has now, which suits lists whose items are measured where they lie
     * in the flow. Pass 0 for items that touch, such as table cells, when some boxes
     * are measured elsewhere, for instance stuck in place by sticky positioning.
     */
    gap?: number
}

function isPermutation(order: readonly number[], count: number): boolean {
    if (order.length !== count) {
        return false
    }

    const seen = new Uint8Array(count)

    for (const index of order) {
        if (!Number.isInteger(index) || index < 0 || index >= count || seen[index]) {
            return false
        }

        seen[index] = 1
    }

    return true
}

/**
 * Return how far each item moves along the axis when the items are laid out in
 * `order`, a permutation of their indices. The offsets describe the movement
 * between the items packed in their current order and packed in `order`, so items
 * of different sizes line up and an unchanged order returns zero offsets. Each gap
 * between neighboring slots stays in place, or is `gap` in both layouts when
 * given. An order that is not a permutation of the items leaves every item where
 * it is.
 */
export function getReorderOffsets(
    rects: readonly ReorderBounds[],
    order: readonly number[],
    options: ReorderOffsetsOptions = {},
): number[] {
    const offsets = rects.map(() => 0)

    if (rects.length === 0 || !isPermutation(order, rects.length)) {
        return offsets
    }

    const [start, end] = options.axis === 'x' ? (['left', 'right'] as const) : (['top', 'bottom'] as const)
    const [leading, trailing] = options.reverse ? [end, start] : [start, end]
    const direction = options.reverse ? -1 : 1
    // Each offset is where the new order packs the item minus where its old slot
    // packs it, from the same origin, so an item measured away from its slot, such
    // as a sticky cell, doesn't shift the others.
    let original = 0
    let target = 0

    for (const [slot, index] of order.entries()) {
        const rect = rects[slot]!
        const next = rects[slot + 1]
        // The gap after this slot, signed along the direction the items run.
        const signedGap = next
            ? options.gap === undefined
                ? next[leading] - rect[trailing]
                : direction * options.gap
            : 0

        offsets[index] += target
        offsets[slot]! -= original
        target += direction * (rects[index]![end] - rects[index]![start]) + signedGap
        original += direction * (rect[end] - rect[start]) + signedGap
    }

    return offsets
}

/**
 * Return true when the event target is a reorder handle carrying
 * `REORDERABLE_LIST_HANDLE_ATTRIBUTE="true"`.
 */
function isReorderHandle(target: EventTarget | null): target is HTMLElement {
    return target instanceof HTMLElement && target.getAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE) === 'true'
}

function isShadowRoot(value: unknown): value is ShadowRoot {
    return typeof ShadowRoot !== 'undefined' && value instanceof ShadowRoot
}

function getParentNodeAcrossShadowDom(node: Node): Node | null {
    if (node instanceof Element && node.assignedSlot) {
        return node.assignedSlot
    }

    if (node.parentNode) {
        return node.parentNode
    }

    const root = node.getRootNode?.()

    return isShadowRoot(root) ? root.host : null
}

function getFallbackEventPath(event: Event): EventTarget[] {
    const path: EventTarget[] = []
    let node = event.target instanceof Node ? event.target : null

    while (node) {
        path.push(node)
        node = getParentNodeAcrossShadowDom(node)
    }

    if (typeof document !== 'undefined') {
        path.push(document)
    }

    if (typeof window !== 'undefined') {
        path.push(window)
    }

    return path
}

/**
 * Find the reorder handle in an event path. This supports nested handle content
 * and shadow-dom retargeting while preserving the same handle attribute contract.
 */
function findReorderHandle(event: Event, boundary: EventTarget | null = event.currentTarget): HTMLElement | null {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : getFallbackEventPath(event)

    for (const target of path) {
        if (isReorderHandle(target)) {
            return target
        }

        if (boundary && target === boundary) {
            break
        }
    }

    return isReorderHandle(boundary) ? boundary : null
}

const autoScrollDefaults = {
    edgeThreshold: 48,
    maxSpeed: 720,
    axis: 'both' as AutoScrollAxis,
}

function finiteNumber(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) ? Math.max(0, value as number) : fallback
}

function canOverflow(value: string): boolean {
    return value === 'auto' || value === 'scroll' || value === 'overlay'
}

function isScrollableElement(element: Element, axis: AutoScrollAxis): boolean {
    const style = getComputedStyle(element)
    const canScrollY = axis !== 'x' && canOverflow(style.overflowY) && element.scrollHeight > element.clientHeight
    const canScrollX = axis !== 'y' && canOverflow(style.overflowX) && element.scrollWidth > element.clientWidth

    return canScrollY || canScrollX
}

function getOwnerWindow(element: Element | null): Window | null {
    if (element?.ownerDocument.defaultView) {
        return element.ownerDocument.defaultView
    }

    return typeof window !== 'undefined' ? window : null
}

function isWindowContainer(container: AutoScrollContainer): container is Window {
    return typeof Window !== 'undefined' && container instanceof Window
}

/**
 * Ancestors of `element` that can scroll, nearest first, followed by its window.
 * Pass an axis to keep only the ancestors that scroll along it. Shadow roots are
 * crossed through their hosts.
 */
export function getScrollableAncestors(element: Element | null, axis: AutoScrollAxis = 'both'): AutoScrollContainer[] {
    const containers: AutoScrollContainer[] = []
    const ownerWindow = getOwnerWindow(element)
    let node: Node | null = element

    while (node) {
        node = getParentNodeAcrossShadowDom(node)

        if (node instanceof Element && isScrollableElement(node, axis)) {
            containers.push(node)
        }
    }

    if (ownerWindow) {
        containers.push(ownerWindow)
    }

    return containers
}

function getContainerRect(container: AutoScrollContainer): Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'> {
    if (isWindowContainer(container)) {
        return {
            left: 0,
            top: 0,
            right: container.innerWidth,
            bottom: container.innerHeight,
        }
    }

    return container.getBoundingClientRect()
}

function getScrollElement(container: Window): Element | null {
    return container.document.scrollingElement ?? container.document.documentElement
}

function getScrollPosition(container: AutoScrollContainer, axis: 'x' | 'y'): number {
    if (isWindowContainer(container)) {
        return axis === 'x' ? container.scrollX : container.scrollY
    }

    return axis === 'x' ? container.scrollLeft : container.scrollTop
}

/** Keep initial geometry independent of preview transforms, translating only ancestor scroll displacement. */
function createScrollAdjustedHitBox(hitBox: ReorderHitBox, element: HTMLElement): () => ReorderHitBox {
    const containers: Element[] = []
    const ownerWindow = getOwnerWindow(element)
    const scrollElement = ownerWindow ? getScrollElement(ownerWindow) : null
    const windowLeft = ownerWindow?.scrollX ?? 0
    const windowTop = ownerWindow?.scrollY ?? 0
    let node: Node | null = element

    while ((node = getParentNodeAcrossShadowDom(node))) {
        // Include programmatically scrollable ancestors (such as overflow:hidden), but count window scroll once.
        if (node instanceof Element && node !== scrollElement) {
            containers.push(node)
        }
    }

    const positions = containers.map((container) => ({
        container,
        left: container.scrollLeft,
        top: container.scrollTop,
    }))

    return () => {
        let left = (ownerWindow?.scrollX ?? 0) - windowLeft
        let top = (ownerWindow?.scrollY ?? 0) - windowTop

        for (const position of positions) {
            left += position.container.scrollLeft - position.left
            top += position.container.scrollTop - position.top
        }

        return {
            index: hitBox.index,
            left: hitBox.left - left,
            top: hitBox.top - top,
            right: hitBox.right - left,
            bottom: hitBox.bottom - top,
        }
    }
}

function getMaxScrollPosition(container: AutoScrollContainer, axis: 'x' | 'y'): number {
    if (isWindowContainer(container)) {
        const scrollElement = getScrollElement(container)

        if (!scrollElement) {
            return 0
        }

        return Math.max(
            0,
            axis === 'x'
                ? scrollElement.scrollWidth - container.innerWidth
                : scrollElement.scrollHeight - container.innerHeight,
        )
    }

    return Math.max(
        0,
        axis === 'x' ? container.scrollWidth - container.clientWidth : container.scrollHeight - container.clientHeight,
    )
}

function scrollsRightToLeft(container: AutoScrollContainer): boolean {
    const element = isWindowContainer(container) ? getScrollElement(container) : container

    return element !== null && getComputedStyle(element).direction === 'rtl'
}

function canScroll(
    container: AutoScrollContainer,
    axis: 'x' | 'y',
    direction: number,
    isRightToLeft: (container: AutoScrollContainer) => boolean,
): boolean {
    const position = getScrollPosition(container, axis)
    const maxPosition = getMaxScrollPosition(container, axis)

    // Right-to-left boxes start at 0 on the right and scroll left into negative positions.
    if (axis === 'x' && isRightToLeft(container)) {
        return direction < 0 ? position > -maxPosition : position < 0
    }

    return direction < 0 ? position > 0 : position < maxPosition
}

function edgeIntensity(position: number, start: number, end: number, threshold: number): number {
    if (threshold <= 0 || position < start || position > end) {
        return 0
    }

    const startDistance = position - start
    const endDistance = end - position
    const startIntensity = startDistance < threshold ? (threshold - startDistance) / threshold : 0
    const endIntensity = endDistance < threshold ? (threshold - endDistance) / threshold : 0

    return endIntensity > startIntensity ? endIntensity : -startIntensity
}

function getAutoScrollVector(
    container: AutoScrollContainer,
    point: ReorderPoint,
    edgeThreshold: number,
    maxStep: number,
    isRightToLeft: (container: AutoScrollContainer) => boolean,
): { left: number; top: number } {
    const rect = getContainerRect(container)
    const width = rect.right - rect.left
    const height = rect.bottom - rect.top
    const xThreshold = Math.min(edgeThreshold, Math.max(0, width / 2))
    const yThreshold = Math.min(edgeThreshold, Math.max(0, height / 2))
    const xIntensity = edgeIntensity(point.clientX, rect.left, rect.right, xThreshold)
    const yIntensity = edgeIntensity(point.clientY, rect.top, rect.bottom, yThreshold)
    const left = xIntensity !== 0 && canScroll(container, 'x', xIntensity, isRightToLeft) ? xIntensity * maxStep : 0
    const top = yIntensity !== 0 && canScroll(container, 'y', yIntensity, isRightToLeft) ? yIntensity * maxStep : 0

    return { left, top }
}

function scrollContainer(container: AutoScrollContainer, left: number, top: number): { x: boolean; y: boolean } {
    const previousLeft = getScrollPosition(container, 'x')
    const previousTop = getScrollPosition(container, 'y')

    if (isWindowContainer(container)) {
        container.scrollBy({ left, top, behavior: 'auto' })
    } else {
        if (left !== 0) {
            container.scrollLeft += left
        }

        if (top !== 0) {
            container.scrollTop += top
        }
    }

    return {
        x: getScrollPosition(container, 'x') !== previousLeft,
        y: getScrollPosition(container, 'y') !== previousTop,
    }
}

/**
 * Create a transform-free pointer auto-scroller for drag interactions.
 */
function createAutoScroller(options: AutoScrollerOptions = {}): AutoScrollerController {
    const edgeThreshold = finiteNumber(options.edgeThreshold, autoScrollDefaults.edgeThreshold)
    const maxSpeed = finiteNumber(options.maxSpeed, autoScrollDefaults.maxSpeed)
    const axis = options.axis ?? autoScrollDefaults.axis

    let latestPoint: ReorderPoint | null = null
    let latestElement: Element | null = null
    let containers: AutoScrollContainer[] = []
    let frameId: number | null = null
    let lastTimestamp: number | null = null
    let cleaned = false
    // Writing direction of each container, read once per gesture when it first scrolls sideways.
    const rightToLeft = new Map<AutoScrollContainer, boolean>()

    function queueFrame() {
        if (cleaned || frameId !== null || typeof requestAnimationFrame !== 'function') {
            return
        }

        frameId = requestAnimationFrame(step)
    }

    function readsRightToLeft(container: AutoScrollContainer): boolean {
        let value = rightToLeft.get(container)

        if (value === undefined) {
            value = scrollsRightToLeft(container)
            rightToLeft.set(container, value)
        }

        return value
    }

    function stop() {
        if (frameId !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(frameId)
        }

        latestPoint = null
        latestElement = null
        containers = []
        frameId = null
        lastTimestamp = null
        rightToLeft.clear()
    }

    function step(timestamp: number) {
        frameId = null

        if (cleaned || !latestPoint) {
            return
        }

        const elapsed = Math.max(1, Math.min(lastTimestamp === null ? 16 : timestamp - lastTimestamp, 32))
        const maxStep = (maxSpeed * elapsed) / 1000
        let scrolled = false
        let handledX = axis === 'y'
        let handledY = axis === 'x'

        lastTimestamp = timestamp

        for (const container of containers) {
            const vector = getAutoScrollVector(container, latestPoint, edgeThreshold, maxStep, readsRightToLeft)
            const left = handledX ? 0 : vector.left
            const top = handledY ? 0 : vector.top

            if (left === 0 && top === 0) {
                continue
            }

            const result = scrollContainer(container, left, top)

            if (result.x) {
                handledX = true
                scrolled = true
            }

            if (result.y) {
                handledY = true
                scrolled = true
            }

            if (handledX && handledY) {
                break
            }
        }

        if (scrolled) {
            options.onScroll?.()
            queueFrame()
        } else {
            lastTimestamp = null
        }
    }

    function update(point: ReorderPoint, element: Element | null = latestElement) {
        if (cleaned) {
            return
        }

        latestPoint = point
        latestElement = element
        containers = options.getScrollContainers?.(element) ?? getScrollableAncestors(element)
        queueFrame()
    }

    function cleanup() {
        if (cleaned) {
            return
        }

        cleaned = true
        stop()
    }

    return {
        update,
        stop,
        cleanup,
    }
}

interface PointerReorderOptions {
    /** Capture drag geometry only after the initiating pointer has been accepted. */
    onStart: () => void
    /** Whether rows read from right to left, as decided when the drag started. */
    isRightToLeft?: () => boolean
    /**
     * Return the current hit boxes for every reorderable item. Called on each
     * pointer move and auto-scroll frame to account for scroll displacement.
     */
    getHitBoxes: () => ReorderHitBox[]
    /** Optional outer collision bounds for list chrome around the item boxes. */
    getBounds?: () => ReorderBounds | null
    /** Current number of items in the list. */
    getItemCount: () => number
    /** Optional guard; reordering is skipped when it returns false. Defaults to true. */
    canReorder?: () => boolean
    /** Optional edge auto-scroll while pointer-dragging. Disabled by default. */
    autoScroll?: boolean | AutoScrollerOptions
    /** Pointer travel before a press starts dragging. Defaults to 0. */
    activationDistance?: number
    /** Ignore the click that follows a drag. Defaults to false. */
    suppressClickAfterDrag?: boolean
    /** Point that picks the drop slot instead of the pointer. Defaults to the pointer. */
    getCollisionPoint?: (pointer: ReorderPointer, item: ReorderBounds) => ReorderPoint | null
    /** Called whenever the dragged/target/insertion indices change (drag start, move, end). */
    onChange?: (state: PointerReorderState) => void
    /** Called once on pointer up with a resolved, in-range move. */
    onCommit: (fromIndex: number, toIndex: number, source: 'pointer') => void
}

type PointerReorderState = ReorderableListState

interface PointerReorderController {
    /**
     * Begin a pointer reorder from `index`. Pass the originating `pointerdown`
     * event; the interaction is ignored unless it is a primary left-button press
     * whose composed path contains an element carrying the handle attribute.
     */
    pointerDown: (index: number, event: PointerEvent) => void
    /** Pointer positions of the active drag. */
    getPointer: () => ReorderPointer | null
    /** End a pending press or active drag without committing it. */
    cancel: () => void
    /** Cancel any active drag and remove all window listeners. Idempotent. */
    cleanup: CleanupFunction
}

const idleState: PointerReorderState = {
    draggedIndex: null,
    insertionIndex: null,
    targetIndex: null,
}

function defaultReorderableListBounds(element: HTMLElement | null): ReorderBounds | null {
    const rect = element?.getBoundingClientRect()

    if (!rect || rect.width <= 0 || rect.height <= 0) {
        return null
    }

    return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
    }
}

function getRegisteredItemElements(itemElements: Map<number, HTMLElement>): HTMLElement[] {
    return Array.from(itemElements.entries())
        .sort(([firstIndex], [secondIndex]) => firstIndex - secondIndex)
        .map(([, element]) => element)
}

function isValidReorderIndex(index: number, itemCount: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < itemCount
}

/**
 * Framework-neutral list reorder controller. It combines item registration,
 * live pointer preview ordering, keyboard moves, pointer commits, bounds, and
 * cleanup while leaving rendering, announcements, and animation policy to the
 * consuming package.
 */
export function createReorderableList<T>(options: ReorderableListOptions<T>): ReorderableListController<T> {
    let listElement: HTMLElement | null = null
    let pointerState: ReorderableListState = idleState
    let dragHitBoxes: Array<() => ReorderHitBox> | null = null
    let dragRightToLeft = false
    let lastPreviewedPointerTargetIndex: number | null = null
    const itemElements = new Map<number, HTMLElement>()

    const itemCount = () => options.getItems().length
    const canReorder = () => (options.canReorder?.() ?? true) && itemCount() > 1
    const getBounds = () => options.getBounds?.() ?? defaultReorderableListBounds(listElement)

    const measureItemHitBoxes = (): ReorderHitBox[] => {
        return options
            .getItems()
            .map((_, index) => {
                const element = itemElements.get(index)

                if (!element) {
                    return null
                }

                const rect = element.getBoundingClientRect()

                return {
                    index,
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                }
            })
            .filter((hitBox): hitBox is ReorderHitBox => hitBox !== null)
    }

    const getHitBoxes = () => dragHitBoxes?.map((getHitBox) => getHitBox()) ?? measureItemHitBoxes()

    const commitReorder = (
        fromIndex: number,
        toIndex: number,
        source: ReorderSource,
        context: ReorderCommitContext,
    ): ReorderMove<T> | null => {
        const items = options.getItems()

        if (
            !canReorder() ||
            fromIndex === toIndex ||
            !isValidReorderIndex(fromIndex, items.length) ||
            !isValidReorderIndex(toIndex, items.length)
        ) {
            return null
        }

        const move: ReorderMove<T> = {
            item: items[fromIndex] as T,
            fromIndex,
            toIndex,
            source,
        }

        options.onBeforeReorder?.(move, context)
        options.setItems?.(moveArrayItem(items, fromIndex, toIndex))
        options.onReorder?.(move, context)

        return move
    }

    const pointerReorder = createPointerReorder({
        onStart: () => {
            dragHitBoxes = measureItemHitBoxes().map((hitBox) =>
                createScrollAdjustedHitBox(hitBox, itemElements.get(hitBox.index)!),
            )
            // Rows follow the list's writing direction, read once per drag.
            const element = listElement ?? itemElements.values().next().value
            dragRightToLeft = !!element && getComputedStyle(element).direction === 'rtl'
        },
        isRightToLeft: () => dragRightToLeft,
        getItemCount: itemCount,
        getHitBoxes,
        getBounds,
        canReorder,
        autoScroll: options.autoScroll ?? false,
        activationDistance: options.activationDistance,
        suppressClickAfterDrag: options.suppressClickAfterDrag,
        getCollisionPoint: options.getCollisionPoint,
        onChange: (state) => {
            if (state.draggedIndex !== null) {
                lastPreviewedPointerTargetIndex = state.targetIndex
            }

            pointerState = state
            options.onChange?.(state)

            if (state.draggedIndex === null) {
                dragHitBoxes = null
            }
        },
        onCommit: (fromIndex, toIndex, source) => {
            const context = {
                alreadyPreviewed: source === 'pointer' && lastPreviewedPointerTargetIndex === toIndex,
            }

            commitReorder(fromIndex, toIndex, source, context)
            lastPreviewedPointerTargetIndex = null
        },
    })

    const getPreviewOrder = (): number[] => {
        const order = identityOrder(itemCount())
        const fromIndex = pointerState.draggedIndex
        const toIndex = pointerState.targetIndex

        if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
            return order
        }

        return moveArrayItem(order, fromIndex, toIndex)
    }

    return {
        setListElement: (element) => {
            listElement = isHTMLElement(element) ? element : null
        },
        setItemElement: (index, element) => {
            if (isHTMLElement(element)) {
                itemElements.set(index, element)
                return
            }

            itemElements.delete(index)
        },
        getItemElements: () => getRegisteredItemElements(itemElements),
        getPreviewOrder,
        getPreviewItems: () => {
            const items = options.getItems()

            return getPreviewOrder()
                .filter((index) => index >= 0 && index < items.length)
                .map((index, visualIndex) => ({ item: items[index] as T, index, visualIndex }))
        },
        moveItem: (index, direction) => {
            return commitReorder(index, direction === 'up' ? index - 1 : index + 1, 'keyboard', {
                alreadyPreviewed: false,
            })
        },
        pointerDown: pointerReorder.pointerDown,
        getPointer: pointerReorder.getPointer,
        cancel: pointerReorder.cancel,
        cleanup: () => {
            pointerReorder.cleanup()
            dragHitBoxes = null
            itemElements.clear()
            listElement = null
            pointerState = idleState
            lastPreviewedPointerTargetIndex = null
        },
    }
}

/**
 * Pointer-drag reorder implementation used by createReorderableList. It owns
 * the window pointer listeners and insertion-index math.
 */
function createPointerReorder(options: PointerReorderOptions): PointerReorderController {
    const canReorder = () => (options.canReorder?.() ?? true) && options.getItemCount() > 1
    let activePointer: {
        fromIndex: number
        pointerId: number
        captureElement: HTMLElement | null
        scrollElement: HTMLElement | null
        initialItemBounds: ReorderBounds | null
    } | null = null
    // A press that has not yet travelled the activation distance.
    let pendingPointer: {
        fromIndex: number
        pointerId: number
        handle: HTMLElement
    } | null = null
    let pointer: { origin: ReorderPoint; position: ReorderPoint } | null = null
    let insertionIndex: number | null = null
    let pointerOverReorderArea = false
    let lastPoint: ReorderPoint | null = null
    let cleaned = false
    const activationDistance = finiteNumber(options.activationDistance, 0)
    const autoScrollOptions = options.autoScroll === true ? {} : options.autoScroll || null
    const autoScroller = autoScrollOptions
        ? createAutoScroller({
              ...autoScrollOptions,
              onScroll: () => {
                  autoScrollOptions.onScroll?.()

                  if (!activePointer || !lastPoint) {
                      return
                  }

                  updateInsertionIndex(lastPoint)
                  emitChange()
              },
          })
        : null

    function currentState(): PointerReorderState {
        if (!activePointer) {
            return idleState
        }

        return {
            draggedIndex: activePointer.fromIndex,
            insertionIndex,
            targetIndex: resolveTargetIndexFromInsertion(
                activePointer.fromIndex,
                insertionIndex,
                options.getItemCount(),
            ),
        }
    }

    function emitChange() {
        options.onChange?.(currentState())
    }

    function updateInsertionIndex(point: ReorderPoint) {
        const hitBoxes = options.getHitBoxes()
        const nextInsertionIndex = getInsertionIndexFromPoint(
            hitBoxes,
            {
                clientX: point.clientX,
                clientY: point.clientY,
            },
            {
                bounds: options.getBounds?.() ?? null,
                rightToLeft: options.isRightToLeft?.(),
            },
        )

        // The pointer decides whether a release drops or cancels, even when another point picks the slot.
        pointerOverReorderArea = nextInsertionIndex !== null

        if (nextInsertionIndex !== null) {
            insertionIndex = getCollisionInsertionIndex(hitBoxes) ?? nextInsertionIndex
        }
    }

    /** The insertion index at the caller's collision point, or null to use the pointer. */
    function getCollisionInsertionIndex(hitBoxes: readonly ReorderHitBox[]): number | null {
        const getCollisionPoint = options.getCollisionPoint

        if (!getCollisionPoint || !activePointer || !pointer) {
            return null
        }

        const item = activePointer.initialItemBounds
        const point = item ? getCollisionPoint(pointer, item) : null

        if (!point || !Number.isFinite(point.clientX) || !Number.isFinite(point.clientY)) {
            return null
        }

        return getInsertionIndexFromPoint(hitBoxes, clampToHitBoxes(hitBoxes, point), {
            rightToLeft: options.isRightToLeft?.(),
        })
    }

    function updatePointerPosition(event: PointerEvent, shouldAutoScroll: boolean) {
        lastPoint = {
            clientX: event.clientX,
            clientY: event.clientY,
        }

        if (pointer) {
            pointer.position = lastPoint
        }

        updateInsertionIndex(lastPoint)

        if (shouldAutoScroll) {
            autoScroller?.update(lastPoint, activePointer?.scrollElement ?? activePointer?.captureElement ?? null)
        }
    }

    function stop() {
        releasePointerCapture()
        autoScroller?.stop()
        window.removeEventListener('pointermove', handleWindowPointerMove)
        window.removeEventListener('pointerup', handleWindowPointerUp)
        window.removeEventListener('pointercancel', handleWindowPointerCancel)
        window.removeEventListener('blur', cancel)
        activePointer = null
        pendingPointer = null
        pointer = null
        insertionIndex = null
        pointerOverReorderArea = false
        lastPoint = null
    }

    function releasePointerCapture() {
        const pointer = activePointer

        if (!pointer?.captureElement?.isConnected) {
            return
        }

        try {
            if (pointer.captureElement.hasPointerCapture?.(pointer.pointerId)) {
                pointer.captureElement.releasePointerCapture(pointer.pointerId)
            }
        } catch {
            // Ignore browsers that throw when the pointer has already been released.
        }
    }

    function handleWindowPointerMove(event: PointerEvent) {
        const pending = pendingPointer

        if (pending?.pointerId === event.pointerId && pointer) {
            if (
                Math.hypot(event.clientX - pointer.origin.clientX, event.clientY - pointer.origin.clientY) <
                activationDistance
            ) {
                return
            }

            pendingPointer = null

            if (!canReorder() || !isValidReorderIndex(pending.fromIndex, options.getItemCount())) {
                stop()
                return
            }

            activate(pending.fromIndex, event, pending.handle)
        }

        if (activePointer?.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        updatePointerPosition(event, true)
        emitChange()
    }

    function handleWindowPointerUp(event: PointerEvent) {
        if (pendingPointer?.pointerId === event.pointerId) {
            stop()
            return
        }

        const active = activePointer

        if (!active || active.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()

        const fromIndex = active.fromIndex
        const toIndex = pointerOverReorderArea
            ? resolveTargetIndexFromInsertion(fromIndex, insertionIndex, options.getItemCount())
            : null

        end()

        if (toIndex !== null && fromIndex !== toIndex) {
            options.onCommit(fromIndex, toIndex, 'pointer')
        }
    }

    function handleWindowPointerCancel(event: PointerEvent) {
        if (pendingPointer?.pointerId === event.pointerId) {
            stop()
        } else if (activePointer?.pointerId === event.pointerId) {
            // A canceled pointer does not produce a click to suppress.
            end(false)
        }
    }

    /** Stop an active drag and report the idle state, keeping its click from activating whatever is under the pointer. */
    function end(suppressFollowingClick = options.suppressClickAfterDrag ?? false) {
        stop()

        if (suppressFollowingClick) {
            window.addEventListener('click', suppressClick, { capture: true })
            window.addEventListener('pointerdown', releaseClick, { capture: true })
            window.addEventListener('keydown', releaseClick, { capture: true })
        }

        emitChange()
    }

    function suppressClick(event: MouseEvent) {
        event.preventDefault()
        event.stopPropagation()
        releaseClick()
    }

    // A new press or key is a fresh interaction, so a drag that produced no click never swallows a later one.
    function releaseClick() {
        window.removeEventListener('click', suppressClick, { capture: true })
        window.removeEventListener('pointerdown', releaseClick, { capture: true })
        window.removeEventListener('keydown', releaseClick, { capture: true })
    }

    function bindPointerCapture(element: HTMLElement, pointerId: number): HTMLElement | null {
        if (typeof element.setPointerCapture !== 'function') {
            return null
        }

        try {
            element.setPointerCapture(pointerId)
        } catch {
            return null
        }

        return element
    }

    function pointerDown(index: number, event: PointerEvent) {
        const handle = findReorderHandle(event)

        if (
            cleaned ||
            !canReorder() ||
            !isValidReorderIndex(index, options.getItemCount()) ||
            activePointer ||
            pendingPointer ||
            event.button !== 0 ||
            event.isPrimary === false ||
            !handle
        ) {
            return
        }

        const origin = { clientX: event.clientX, clientY: event.clientY }
        pointer = { origin, position: origin }

        // Keep the window listeners as a compatibility path for older browsers
        // and for synthetic tests that dispatch pointer events on window.
        window.addEventListener('pointermove', handleWindowPointerMove, { passive: false })
        window.addEventListener('pointerup', handleWindowPointerUp)
        window.addEventListener('pointercancel', handleWindowPointerCancel)
        window.addEventListener('blur', cancel)

        if (activationDistance > 0) {
            pendingPointer = { fromIndex: index, pointerId: event.pointerId, handle }
            return
        }

        activate(index, event, handle)
        emitChange()
    }

    /** Turn an accepted press into a drag: measure, claim the pointer, and stop native defaults. */
    function activate(fromIndex: number, event: PointerEvent, handle: HTMLElement) {
        options.onStart()
        event.preventDefault()
        const captureElement = bindPointerCapture(handle, event.pointerId)
        activePointer = {
            fromIndex,
            pointerId: event.pointerId,
            captureElement,
            scrollElement: handle,
            initialItemBounds: options.getHitBoxes().find((hitBox) => hitBox.index === fromIndex) ?? null,
        }
        insertionIndex = fromIndex
        pointerOverReorderArea = true
    }

    function cancel() {
        if (activePointer) {
            end()
        } else if (pendingPointer) {
            stop()
        }
    }

    function cleanup() {
        if (cleaned) {
            return
        }

        cleaned = true
        stop()
        releaseClick()
        autoScroller?.cleanup()
    }

    return {
        pointerDown,
        getPointer: () => (activePointer ? pointer : null),
        cancel,
        cleanup,
    }
}
