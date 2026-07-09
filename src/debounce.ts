/**
 * Debounce a function using requestAnimationFrame.
 * Ensures the function runs at most once per animation frame.
 *
 * @see https://pqina.nl/blog/applying-styles-based-on-the-user-scroll-position-with-smart-css/
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T): (...args: Parameters<T>) => void {
    let frame: number | undefined

    return (...params: Parameters<T>) => {
        if (frame) {
            cancelAnimationFrame(frame)
        }

        frame = requestAnimationFrame(() => {
            fn(...params)
        })
    }
}

/**
 * A timeout-based debounced scheduler. Each `schedule()` cancels any pending
 * call and queues a fresh one `delay` milliseconds out.
 */
export interface Debouncer {
    /** Queue `fn` to run after `delay` ms, cancelling any pending call. */
    schedule(fn: () => void): void
    /** Cancel a pending call, if any. */
    cancel(): void
}

/**
 * Create a {@link Debouncer} with a fixed delay.
 *
 * @param delay - Milliseconds to wait after the latest `schedule()` call.
 */
export function createDebouncer(delay: number): Debouncer {
    let timer: ReturnType<typeof setTimeout> | null = null

    const cancel = () => {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
    }

    const schedule = (fn: () => void) => {
        cancel()
        timer = setTimeout(() => {
            timer = null
            fn()
        }, delay)
    }

    return { schedule, cancel }
}

/**
 * Detect the browser's current framerate.
 * Returns a Promise that resolves with the detected FPS (capped to 30–240 range).
 * Falls back to 60 if requestAnimationFrame is unavailable or detection times out.
 */
export function detectFramerate(): Promise<number> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.requestAnimationFrame) {
            return resolve(60)
        }

        const timestamps: number[] = []
        let rafId: number | undefined

        function measure(now: number) {
            timestamps.unshift(now)

            if (timestamps.length > 10) {
                const lastTime = timestamps.pop()!
                const fps = Math.floor((1000 * 10) / (now - lastTime))

                cancelAnimationFrame(rafId!)

                // Cap at reasonable values (30-240 fps range)
                resolve(Math.min(Math.max(fps, 30), 240))
                return
            }

            rafId = window.requestAnimationFrame(measure)
        }

        rafId = window.requestAnimationFrame(measure)

        // Safety timeout after 1 second
        setTimeout(() => {
            if (rafId !== undefined) {
                cancelAnimationFrame(rafId)
            }
            resolve(60)
        }, 1000)
    })
}
