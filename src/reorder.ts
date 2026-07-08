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

export type ReorderHitBox = {
    index: number
    left: number
    top: number
    right: number
    bottom: number
}

export type ReorderBounds = Pick<ReorderHitBox, 'left' | 'top' | 'right' | 'bottom'>
export type ReorderCollisionDirection = 'up' | 'down' | 'left' | 'right'
export type AutoScrollAxis = 'x' | 'y' | 'both'
export type AutoScrollContainer = Element | Window

export type ReorderMove<T> = {
    item: T
    fromIndex: number
    toIndex: number
    source: ReorderSource
}

export interface ClosestReorderHitBoxOptions {
    /**
     * Prefer hit boxes whose center is in this direction from the pointer while
     * still falling back to the closest opposite-side hit box when needed.
     */
    direction?: ReorderCollisionDirection
    /** Multiplier applied to hit boxes outside the preferred direction. */
    oppositeDirectionPenalty?: number
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

export interface AutoScrollerController {
    /** Update the latest pointer position and optional element used to find scroll ancestors. */
    update: (point: ReorderPoint, element?: Element | null) => void
    /** Stop any pending auto-scroll frame without disabling future updates. */
    stop: CleanupFunction
    /** Stop permanently and cancel all pending work. Idempotent. */
    cleanup: CleanupFunction
    /** True when an auto-scroll animation frame is pending. */
    isScrolling: () => boolean
}

export interface ReorderInsertionOptions {
    /**
     * Optional outer hit area for list chrome around the items, such as table
     * headers or empty padding. Item midpoint math still uses the item boxes.
     */
    bounds?: ReorderBounds | null
}

/**
 * Return a new array with the item at `fromIndex` moved to `toIndex`.
 * Out-of-range or no-op moves return a shallow copy unchanged.
 */
export function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
        return [...items]
    }

    const nextItems = [...items]
    const [item] = nextItems.splice(fromIndex, 1)

    nextItems.splice(toIndex, 0, item as T)

    return nextItems
}

function getValidReorderHitBoxes(hitBoxes: readonly ReorderHitBox[]): ReorderHitBox[] {
    return hitBoxes.filter(
        (hitBox) =>
            Number.isFinite(hitBox.index) &&
            Number.isFinite(hitBox.left) &&
            Number.isFinite(hitBox.top) &&
            Number.isFinite(hitBox.right) &&
            Number.isFinite(hitBox.bottom) &&
            hitBox.left <= hitBox.right &&
            hitBox.top <= hitBox.bottom,
    )
}

function getOrderedReorderHitBoxes(hitBoxes: readonly ReorderHitBox[]): ReorderHitBox[] {
    return getValidReorderHitBoxes(hitBoxes).sort((first, second) => first.index - second.index)
}

/**
 * Return true when the pointer is inside the hit box bounds.
 */
export function pointerIntersectsHitBox(hitBox: ReorderHitBox, point: ReorderPoint): boolean {
    return (
        Number.isFinite(point.clientX) &&
        Number.isFinite(point.clientY) &&
        point.clientX >= hitBox.left &&
        point.clientX <= hitBox.right &&
        point.clientY >= hitBox.top &&
        point.clientY <= hitBox.bottom
    )
}

/**
 * Resolve the visual center point for a hit box.
 */
export function getHitBoxCenter(hitBox: ReorderHitBox): ReorderPoint {
    return {
        clientX: hitBox.left + (hitBox.right - hitBox.left) / 2,
        clientY: hitBox.top + (hitBox.bottom - hitBox.top) / 2,
    }
}

/**
 * Return the first hit box intersecting the pointer, ordered by item index.
 */
export function getIntersectingHitBox(hitBoxes: readonly ReorderHitBox[], point: ReorderPoint): ReorderHitBox | null {
    return getOrderedReorderHitBoxes(hitBoxes).find((hitBox) => pointerIntersectsHitBox(hitBox, point)) ?? null
}

function distanceSquared(first: ReorderPoint, second: ReorderPoint): number {
    return (first.clientX - second.clientX) ** 2 + (first.clientY - second.clientY) ** 2
}

function isPointInDirection(point: ReorderPoint, origin: ReorderPoint, direction: ReorderCollisionDirection): boolean {
    if (direction === 'up') {
        return point.clientY < origin.clientY
    }

    if (direction === 'down') {
        return point.clientY > origin.clientY
    }

    if (direction === 'left') {
        return point.clientX < origin.clientX
    }

    return point.clientX > origin.clientX
}

/**
 * Return the hit box whose center is closest to the pointer. When a direction
 * is provided, opposite-side candidates are penalized instead of discarded.
 */
export function getClosestHitBoxByCenter(
    hitBoxes: readonly ReorderHitBox[],
    point: ReorderPoint,
    options: ClosestReorderHitBoxOptions = {},
): ReorderHitBox | null {
    const penalty = Math.max(1, options.oppositeDirectionPenalty ?? 4)
    let closestHitBox: ReorderHitBox | null = null
    let closestScore = Number.POSITIVE_INFINITY

    for (const hitBox of getValidReorderHitBoxes(hitBoxes)) {
        const center = getHitBoxCenter(hitBox)
        const directionPenalty =
            options.direction && !isPointInDirection(center, point, options.direction) ? penalty : 1
        const score = distanceSquared(center, point) * directionPenalty

        if (score < closestScore || (score === closestScore && closestHitBox && hitBox.index < closestHitBox.index)) {
            closestHitBox = hitBox
            closestScore = score
        }
    }

    return closestHitBox
}

/**
 * Direction-biased closest-center helper for complex list/grid collision models.
 */
export function getDirectionBiasedHitBox(
    hitBoxes: readonly ReorderHitBox[],
    point: ReorderPoint,
    direction: ReorderCollisionDirection,
    options: Omit<ClosestReorderHitBoxOptions, 'direction'> = {},
): ReorderHitBox | null {
    return getClosestHitBoxByCenter(hitBoxes, point, { ...options, direction })
}

/**
 * Given the on-screen hit boxes of each item and a pointer position, resolve the
 * insertion index (0..count) the pointer currently maps to, or `null` when the
 * point falls outside the combined bounds. Handles both single-column (vertical
 * midpoint) and multi-item rows (horizontal midpoint) layouts.
 */
export function getInsertionIndexFromPoint(
    hitBoxes: readonly ReorderHitBox[],
    point: ReorderPoint,
    options: ReorderInsertionOptions = {},
): number | null {
    const orderedHitBoxes = getOrderedReorderHitBoxes(hitBoxes)

    if (orderedHitBoxes.length === 0) {
        return null
    }

    const left = Math.min(...orderedHitBoxes.map((hitBox) => hitBox.left))
    const top = Math.min(...orderedHitBoxes.map((hitBox) => hitBox.top))
    const right = Math.max(...orderedHitBoxes.map((hitBox) => hitBox.right))
    const bottom = Math.max(...orderedHitBoxes.map((hitBox) => hitBox.bottom))
    const bounds = options.bounds
    const activeLeft = bounds ? Math.min(left, bounds.left) : left
    const activeTop = bounds ? Math.min(top, bounds.top) : top
    const activeRight = bounds ? Math.max(right, bounds.right) : right
    const activeBottom = bounds ? Math.max(bottom, bounds.bottom) : bottom

    if (
        point.clientX < activeLeft ||
        point.clientX > activeRight ||
        point.clientY < activeTop ||
        point.clientY > activeBottom
    ) {
        return null
    }

    if (point.clientY < top) {
        return orderedHitBoxes[0].index
    }

    if (point.clientY > bottom) {
        return orderedHitBoxes[orderedHitBoxes.length - 1].index + 1
    }

    const hitBoxesOnCurrentRow = orderedHitBoxes
        .filter((hitBox) => point.clientY >= hitBox.top && point.clientY <= hitBox.bottom)
        .sort((first, second) => first.left - second.left || first.index - second.index)

    if (hitBoxesOnCurrentRow.length > 1) {
        for (const hitBox of hitBoxesOnCurrentRow) {
            const midpoint = hitBox.left + (hitBox.right - hitBox.left) / 2

            if (point.clientX <= midpoint) {
                return hitBox.index
            }
        }

        return hitBoxesOnCurrentRow[hitBoxesOnCurrentRow.length - 1].index + 1
    }

    for (const hitBox of orderedHitBoxes) {
        const midpoint = hitBox.top + (hitBox.bottom - hitBox.top) / 2

        if (point.clientY <= midpoint) {
            return hitBox.index
        }
    }

    return orderedHitBoxes[orderedHitBoxes.length - 1].index + 1
}

/**
 * Convert an insertion index (0..count) into the destination array index for the
 * item currently dragged from `fromIndex`. Returns `null` when the move is a
 * no-op or out of range. Because removing the dragged item shifts everything
 * after it left by one, an insertion index past `fromIndex` maps to `index - 1`.
 */
export function resolveTargetIndexFromInsertion(
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

/**
 * Return true when the event target is a reorder handle carrying
 * `REORDERABLE_LIST_HANDLE_ATTRIBUTE="true"`.
 */
export function isReorderHandle(target: EventTarget | null): target is HTMLElement {
    return target instanceof HTMLElement && target.getAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE) === 'true'
}

function isShadowRoot(value: unknown): value is ShadowRoot {
    return typeof ShadowRoot !== 'undefined' && value instanceof ShadowRoot
}

function getParentNodeAcrossShadowDom(node: Node): Node | null {
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
export function findReorderHandle(
    event: Event,
    boundary: EventTarget | null = event.currentTarget,
): HTMLElement | null {
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

function isScrollableElement(element: Element): boolean {
    const style = getComputedStyle(element)
    const canScrollY = canOverflow(style.overflowY) && element.scrollHeight > element.clientHeight
    const canScrollX = canOverflow(style.overflowX) && element.scrollWidth > element.clientWidth

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

function getScrollableAncestors(element: Element | null): AutoScrollContainer[] {
    const containers: AutoScrollContainer[] = []
    const ownerWindow = getOwnerWindow(element)
    let node: Node | null = element

    while (node) {
        node = getParentNodeAcrossShadowDom(node)

        if (node instanceof Element && isScrollableElement(node)) {
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

function canScroll(container: AutoScrollContainer, axis: 'x' | 'y', direction: number): boolean {
    const position = getScrollPosition(container, axis)
    const maxPosition = getMaxScrollPosition(container, axis)

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
): { left: number; top: number } {
    const rect = getContainerRect(container)
    const width = rect.right - rect.left
    const height = rect.bottom - rect.top
    const xThreshold = Math.min(edgeThreshold, Math.max(0, width / 2))
    const yThreshold = Math.min(edgeThreshold, Math.max(0, height / 2))
    const xIntensity = edgeIntensity(point.clientX, rect.left, rect.right, xThreshold)
    const yIntensity = edgeIntensity(point.clientY, rect.top, rect.bottom, yThreshold)
    const left = xIntensity !== 0 && canScroll(container, 'x', xIntensity) ? xIntensity * maxStep : 0
    const top = yIntensity !== 0 && canScroll(container, 'y', yIntensity) ? yIntensity * maxStep : 0

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
export function createAutoScroller(options: AutoScrollerOptions = {}): AutoScrollerController {
    const edgeThreshold = finiteNumber(options.edgeThreshold, autoScrollDefaults.edgeThreshold)
    const maxSpeed = finiteNumber(options.maxSpeed, autoScrollDefaults.maxSpeed)
    const axis = options.axis ?? autoScrollDefaults.axis

    let latestPoint: ReorderPoint | null = null
    let latestElement: Element | null = null
    let containers: AutoScrollContainer[] = []
    let frameId: number | null = null
    let lastTimestamp: number | null = null
    let cleaned = false

    function queueFrame() {
        if (cleaned || frameId !== null || typeof requestAnimationFrame !== 'function') {
            return
        }

        frameId = requestAnimationFrame(step)
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
            const vector = getAutoScrollVector(container, latestPoint, edgeThreshold, maxStep)
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
        isScrolling: () => frameId !== null,
    }
}

export interface PointerReorderOptions {
    /**
     * Return the current hit boxes for every reorderable item. Called on each
     * pointer move and auto-scroll frame so callers can measure fresh
     * `getBoundingClientRect()` values.
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
    /** Called whenever the dragged/target/insertion indices change (drag start, move, end). */
    onChange?: (state: PointerReorderState) => void
    /** Called once on pointer up with a resolved, in-range move. */
    onCommit: (fromIndex: number, toIndex: number, source: 'pointer') => void
}

export type PointerReorderState = {
    draggedIndex: number | null
    insertionIndex: number | null
    targetIndex: number | null
}

export interface PointerReorderController {
    /**
     * Begin a pointer reorder from `index`. Pass the originating `pointerdown`
     * event; the interaction is ignored unless it is a primary left-button press
     * whose composed path contains an element carrying the handle attribute.
     */
    pointerDown: (index: number, event: PointerEvent) => void
    /** Current interaction state. */
    getState: () => PointerReorderState
    /** True while a pointer drag is active. */
    isDragging: () => boolean
    /** Cancel any active drag and remove all window listeners. Idempotent. */
    cleanup: CleanupFunction
}

const idleState: PointerReorderState = {
    draggedIndex: null,
    insertionIndex: null,
    targetIndex: null,
}

/**
 * Framework-neutral pointer-drag reorder controller. It owns the window
 * pointer listeners and insertion-index math; the caller supplies hit boxes and
 * receives state updates plus a single commit callback. Keyboard reordering is
 * intentionally left to the caller; it is a one-line `moveArrayItem` call.
 */
export function createPointerReorder(options: PointerReorderOptions): PointerReorderController {
    const canReorder = () => (options.canReorder?.() ?? true) && options.getItemCount() > 1
    let activePointer: {
        fromIndex: number
        pointerId: number
        captureElement: HTMLElement | null
        scrollElement: HTMLElement | null
    } | null = null
    let insertionIndex: number | null = null
    let pointerOverReorderArea = false
    let lastPoint: ReorderPoint | null = null
    let cleaned = false
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
        const nextInsertionIndex = getInsertionIndexFromPoint(
            options.getHitBoxes(),
            {
                clientX: point.clientX,
                clientY: point.clientY,
            },
            {
                bounds: options.getBounds?.() ?? null,
            },
        )

        pointerOverReorderArea = nextInsertionIndex !== null

        if (nextInsertionIndex !== null) {
            insertionIndex = nextInsertionIndex
        }
    }

    function updatePointerPosition(event: PointerEvent, shouldAutoScroll: boolean) {
        lastPoint = {
            clientX: event.clientX,
            clientY: event.clientY,
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
        activePointer = null
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
        if (activePointer?.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        updatePointerPosition(event, true)
        emitChange()
    }

    function handleWindowPointerUp(event: PointerEvent) {
        const pointer = activePointer

        if (!pointer || pointer.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()

        const fromIndex = pointer.fromIndex
        const toIndex = pointerOverReorderArea
            ? resolveTargetIndexFromInsertion(fromIndex, insertionIndex, options.getItemCount())
            : null

        stop()
        emitChange()

        if (toIndex !== null && fromIndex !== toIndex) {
            options.onCommit(fromIndex, toIndex, 'pointer')
        }
    }

    function handleWindowPointerCancel(event: PointerEvent) {
        if (activePointer?.pointerId !== event.pointerId) {
            return
        }

        stop()
        emitChange()
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

        if (cleaned || !canReorder() || activePointer || event.button !== 0 || event.isPrimary === false || !handle) {
            return
        }

        event.preventDefault()
        const captureElement = bindPointerCapture(handle, event.pointerId)
        activePointer = {
            fromIndex: index,
            pointerId: event.pointerId,
            captureElement,
            scrollElement: handle,
        }
        insertionIndex = index
        pointerOverReorderArea = true

        // Keep the window listeners as a compatibility path for older browsers
        // and for synthetic tests that dispatch pointer events on window.
        window.addEventListener('pointermove', handleWindowPointerMove, { passive: false })
        window.addEventListener('pointerup', handleWindowPointerUp)
        window.addEventListener('pointercancel', handleWindowPointerCancel)

        emitChange()
    }

    function cleanup() {
        if (cleaned) {
            return
        }

        cleaned = true
        stop()
        autoScroller?.cleanup()
    }

    return {
        pointerDown,
        getState: currentState,
        isDragging: () => activePointer !== null,
        cleanup,
    }
}
