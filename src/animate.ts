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

const defaultOptions: Required<AnimateOptions> = {
    duration: 300,
    easing: 'inOut',
    fill: 'forwards',
}

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
