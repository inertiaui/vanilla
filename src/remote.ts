/**
 * A debounced scheduler. Each `schedule()` cancels any pending call and
 * queues a fresh one `delay` milliseconds out.
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
