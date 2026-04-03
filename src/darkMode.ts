export type DarkModeStrategy = 'auto' | 'class' | 'selector' | 'media' | (() => boolean)

/**
 * Detect whether the user prefers dark mode.
 *
 * Strategies:
 * - `'class'` / `'selector'` — checks `<html class="dark">`
 * - `'media'` — checks `prefers-color-scheme: dark` media query
 * - `'auto'` (default) — checks class first, then media query
 * - custom function — called directly for full control
 */
export function prefersDarkMode(strategy: DarkModeStrategy = 'auto'): boolean {
    if (typeof strategy === 'function') {
        return strategy()
    }

    const containsDarkClass = () => document.documentElement.classList.contains('dark')
    const matchesDarkMediaQuery = () => window.matchMedia('(prefers-color-scheme: dark)').matches

    if (strategy === 'class' || strategy === 'selector') {
        return containsDarkClass()
    }

    if (strategy === 'media') {
        return matchesDarkMediaQuery()
    }

    return containsDarkClass() || matchesDarkMediaQuery()
}
