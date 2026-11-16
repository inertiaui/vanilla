export type AnnouncerPoliteness = 'polite' | 'assertive'

export interface Announcer {
    announce(text: string, politeness: AnnouncerPoliteness): void
    destroy(): void
}

/** Screen readers ignore text added to a live region in the same moment the region appears. */
const ANNOUNCE_DELAY = 150

/** Messages that arrive within this window are announced together. */
const BATCH_WINDOW = 50

/** Clearing the region keeps old text out of the virtual cursor, and lets the same message be announced again. */
const CLEAR_DELAY = 1000

/**
 * Announces messages through two persistent, visually hidden live regions. The regions only ever contain
 * plain text, so screen readers do not read button labels or other markup along with a message.
 */
export function createAnnouncer(regions: Record<AnnouncerPoliteness, HTMLElement>): Announcer {
    const readyAt = Date.now() + ANNOUNCE_DELAY
    const queues: Record<AnnouncerPoliteness, string[]> = { polite: [], assertive: [] }
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const clearTimers: Partial<Record<AnnouncerPoliteness, ReturnType<typeof setTimeout>>> = {}
    let flushTimer: ReturnType<typeof setTimeout> | undefined
    let destroyed = false

    const later = (callback: () => void, delay: number): ReturnType<typeof setTimeout> => {
        const timer = setTimeout(() => {
            timers.delete(timer)
            callback()
        }, delay)
        timers.add(timer)

        return timer
    }

    const write = (politeness: AnnouncerPoliteness, text: string): void => {
        const region = regions[politeness]

        const pendingClear = clearTimers[politeness]
        if (pendingClear !== undefined) {
            clearTimeout(pendingClear)
            timers.delete(pendingClear)
        }

        const update = (): void => {
            region.textContent = text
            clearTimers[politeness] = later(() => (region.textContent = ''), CLEAR_DELAY)
        }

        if (region.textContent === '') {
            update()

            return
        }

        // Replacing text with the same text is not announced; empty the region first.
        region.textContent = ''
        later(update, BATCH_WINDOW)
    }

    const flush = (): void => {
        flushTimer = undefined

        for (const politeness of ['assertive', 'polite'] as const) {
            if (queues[politeness].length > 0) {
                write(politeness, queues[politeness].join(' '))
                queues[politeness] = []
            }
        }
    }

    return {
        announce(text, politeness) {
            if (destroyed) return

            queues[politeness].push(text)
            flushTimer ??= later(flush, Math.max(readyAt - Date.now(), BATCH_WINDOW))
        },
        destroy() {
            destroyed = true
            timers.forEach(clearTimeout)
            timers.clear()
            queues.polite = []
            queues.assertive = []
        },
    }
}
