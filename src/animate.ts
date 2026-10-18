/**
 * Tailwind CSS easing functions
 */
export const easings = {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const

export type EasingName = keyof typeof easings

export interface AnimateOptions {
    duration?: number
    easing?: string | EasingName
    fill?: FillMode
}

export type AnimationSnapshot = Map<HTMLElement, DOMRect>

export interface AnimateFromSnapshotOptions extends AnimateOptions {
    minimumDelta?: number
    includeCurrentTransform?: boolean
}

const defaultOptions: Required<AnimateOptions> = {
    duration: 300,
    easing: 'inOut',
    fill: 'forwards',
}

const snapshotAnimationOptions: Required<AnimateFromSnapshotOptions> = {
    duration: 160,
    easing: 'out',
    fill: 'none',
    minimumDelta: 0.5,
    includeCurrentTransform: true,
}

const activeSnapshotAnimations = new WeakMap<HTMLElement, Animation>()

/**
 * Animate an element using the Web Animations API.
 * Returns a promise that resolves when the animation completes.
 *
 * @example
 * await animate(element, [
 *     { transform: 'scale(0.95)', opacity: 0 },
 *     { transform: 'scale(1)', opacity: 1 }
 * ])
 *
 * @example
 * await animate(element, keyframes.fadeIn, { duration: 200 })
 */
export function animate(element: HTMLElement, keyframes: Keyframe[], options: AnimateOptions = {}): Promise<Animation> {
    const { duration, easing, fill } = { ...defaultOptions, ...options }

    // Resolve easing name to actual easing function
    const resolvedEasing = easing in easings ? easings[easing as EasingName] : easing

    const animation = element.animate(keyframes, {
        duration,
        easing: resolvedEasing,
        fill,
    })

    return animation.finished.catch(() => animation)
}

/**
 * Cancel any running animations on an element
 */
export function cancelAnimations(element: HTMLElement): void {
    element.getAnimations().forEach((animation) => animation.cancel())
}

export function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
}

export function supportsWebAnimations(): boolean {
    return typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function'
}

function connectedElements(elements: Iterable<HTMLElement | null | undefined>): HTMLElement[] {
    return Array.from(elements).filter(
        (element): element is HTMLElement => element instanceof HTMLElement && element.isConnected,
    )
}

function currentTranslate(element: HTMLElement): { x: number; y: number } {
    const transform = getComputedStyle(element).transform

    if (!transform || transform === 'none') {
        return { x: 0, y: 0 }
    }

    try {
        if (typeof DOMMatrixReadOnly === 'undefined') {
            return { x: 0, y: 0 }
        }

        const matrix = new DOMMatrixReadOnly(transform)
        return { x: matrix.m41, y: matrix.m42 }
    } catch {
        return { x: 0, y: 0 }
    }
}

function resolveAnimationOptions(options: Required<AnimateFromSnapshotOptions>): KeyframeAnimationOptions {
    const resolvedEasing = options.easing in easings ? easings[options.easing as EasingName] : options.easing

    return {
        duration: options.duration,
        easing: resolvedEasing,
        fill: options.fill,
    }
}

function cancelSnapshotAnimation(element: HTMLElement): void {
    const animation = activeSnapshotAnimations.get(element)

    if (animation) {
        animation.cancel()
        activeSnapshotAnimations.delete(element)
    }
}

function canBatchSnapshotMeasurements(elements: HTMLElement[]): boolean {
    const targets = new Set<Element>(elements)

    // Repeated elements must see the animation started by their previous occurrence.
    if (targets.size !== elements.length) {
        return false
    }

    const checkedAncestors = new Set<Element>()
    for (const element of elements) {
        let ancestor: Element | null = element

        while (ancestor) {
            let parent: Element | null = ancestor.assignedSlot ?? ancestor.parentElement
            if (!parent) {
                const root = ancestor.getRootNode()
                parent = typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root.host : null
            }
            ancestor = parent
            if (!ancestor) break
            // Starting an ancestor's animation changes descendant geometry.
            if (targets.has(ancestor)) return false
            // Shared ancestor chains need inspection only once per operation.
            if (checkedAncestors.has(ancestor)) break
            checkedAncestors.add(ancestor)
        }
    }

    return true
}

/**
 * Capture current element rectangles before a renderer changes their order or
 * position. Pass the snapshot to animateFromSnapshot after the DOM has updated.
 */
export function captureAnimationSnapshot(elements: Iterable<HTMLElement | null | undefined>): AnimationSnapshot | null {
    if (typeof window === 'undefined' || prefersReducedMotion() || !supportsWebAnimations()) {
        return null
    }

    const snapshot: AnimationSnapshot = new Map()

    for (const element of connectedElements(elements)) {
        snapshot.set(element, element.getBoundingClientRect())
    }

    return snapshot.size > 0 ? snapshot : null
}

/**
 * Animate elements from a previously captured layout snapshot to their current
 * positions. Only animations started by this helper are cancelled on later runs.
 */
export function animateFromSnapshot(
    snapshot: AnimationSnapshot | null,
    elements: Iterable<HTMLElement | null | undefined>,
    options: AnimateFromSnapshotOptions = {},
): Animation[] {
    if (!snapshot || prefersReducedMotion() || !supportsWebAnimations()) {
        return []
    }

    const resolvedOptions = { ...snapshotAnimationOptions, ...options }
    const animations: Animation[] = []
    const targets = connectedElements(elements).filter((element) => snapshot.has(element))

    const measure = (element: HTMLElement) => {
        const before = snapshot.get(element)!
        const after = element.getBoundingClientRect()
        const running = resolvedOptions.includeCurrentTransform ? currentTranslate(element) : { x: 0, y: 0 }

        return {
            deltaX: before.left - after.left + running.x,
            deltaY: before.top - after.top + running.y,
        }
    }

    // Ordinary reorder lists contain independent elements: read all geometry and
    // transforms before cancelling/starting animations to avoid a layout per item.
    const measurements = canBatchSnapshotMeasurements(targets) ? targets.map(measure) : null
    const animationOptions = resolveAnimationOptions(resolvedOptions)

    for (const [index, element] of targets.entries()) {
        const { deltaX, deltaY } = measurements?.[index] ?? measure(element)

        if (Math.abs(deltaX) < resolvedOptions.minimumDelta && Math.abs(deltaY) < resolvedOptions.minimumDelta) {
            cancelSnapshotAnimation(element)
            continue
        }

        cancelSnapshotAnimation(element)

        const animation = element.animate(
            [{ transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
            animationOptions,
        )

        activeSnapshotAnimations.set(element, animation)
        animations.push(animation)

        animation.finished
            .catch(() => animation)
            .finally(() => {
                if (activeSnapshotAnimations.get(element) === animation) {
                    activeSnapshotAnimations.delete(element)
                }
            })
    }

    return animations
}
