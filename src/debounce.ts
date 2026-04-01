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
