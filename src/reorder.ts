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

export type ReorderMove<T> = {
    item: T
    fromIndex: number
    toIndex: number
    source: ReorderSource
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

/**
 * Given the on-screen hit boxes of each item and a pointer position, resolve the
 * insertion index (0..count) the pointer currently maps to, or `null` when the
 * point falls outside the combined bounds. Handles both single-column (vertical
 * midpoint) and multi-item rows (horizontal midpoint) layouts.
 */
export function getInsertionIndexFromPoint(hitBoxes: readonly ReorderHitBox[], point: ReorderPoint): number | null {
    const orderedHitBoxes = [...hitBoxes]
        .filter(
            (hitBox) =>
                Number.isFinite(hitBox.index) &&
                Number.isFinite(hitBox.left) &&
                Number.isFinite(hitBox.top) &&
                Number.isFinite(hitBox.right) &&
                Number.isFinite(hitBox.bottom) &&
                hitBox.left <= hitBox.right &&
                hitBox.top <= hitBox.bottom,
        )
        .sort((first, second) => first.index - second.index)

    if (orderedHitBoxes.length === 0) {
        return null
    }

    const left = Math.min(...orderedHitBoxes.map((hitBox) => hitBox.left))
    const top = Math.min(...orderedHitBoxes.map((hitBox) => hitBox.top))
    const right = Math.max(...orderedHitBoxes.map((hitBox) => hitBox.right))
    const bottom = Math.max(...orderedHitBoxes.map((hitBox) => hitBox.bottom))

    if (point.clientX < left || point.clientX > right || point.clientY < top || point.clientY > bottom) {
        return null
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

export interface PointerReorderOptions {
    /**
     * Return the current hit boxes for every reorderable item. Called on each
     * pointer move so callers can measure fresh `getBoundingClientRect()` values.
     */
    getHitBoxes: () => ReorderHitBox[]
    /** Current number of items in the list. */
    getItemCount: () => number
    /** Optional guard; reordering is skipped when it returns false. Defaults to true. */
    canReorder?: () => boolean
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
     * on an element carrying the handle attribute.
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

    let activePointer: { fromIndex: number; pointerId: number } | null = null
    let insertionIndex: number | null = null
    let cleaned = false

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

    function updateInsertionIndex(event: PointerEvent) {
        insertionIndex = getInsertionIndexFromPoint(options.getHitBoxes(), {
            clientX: event.clientX,
            clientY: event.clientY,
        })
    }

    function stop() {
        window.removeEventListener('pointermove', handleWindowPointerMove)
        window.removeEventListener('pointerup', handleWindowPointerUp)
        window.removeEventListener('pointercancel', handleWindowPointerCancel)
        activePointer = null
        insertionIndex = null
    }

    function handleWindowPointerMove(event: PointerEvent) {
        if (activePointer?.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        updateInsertionIndex(event)
        emitChange()
    }

    function handleWindowPointerUp(event: PointerEvent) {
        const pointer = activePointer

        if (!pointer || pointer.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        updateInsertionIndex(event)

        const fromIndex = pointer.fromIndex
        const toIndex = resolveTargetIndexFromInsertion(fromIndex, insertionIndex, options.getItemCount())

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

    function pointerDown(index: number, event: PointerEvent) {
        if (
            cleaned ||
            !canReorder() ||
            activePointer ||
            event.button !== 0 ||
            event.isPrimary === false ||
            !isReorderHandle(event.currentTarget)
        ) {
            return
        }

        event.preventDefault()
        activePointer = {
            fromIndex: index,
            pointerId: event.pointerId,
        }
        insertionIndex = index

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
    }

    return {
        pointerDown,
        getState: currentState,
        isDragging: () => activePointer !== null,
        cleanup,
    }
}
