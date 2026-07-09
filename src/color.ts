export interface HslColor {
    h: number
    s: number
    l: number
}

/**
 * Convert a hex color string to HSL values.
 * Accepts with or without leading '#'.
 */
export function hexToHsl(hex: string): HslColor {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return { h: 0, s: 100, l: 50 }

    let r = parseInt(result[1], 16) / 255
    let g = parseInt(result[2], 16) / 255
    let b = parseInt(result[3], 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6
                break
            case g:
                h = ((b - r) / d + 2) / 6
                break
            case b:
                h = ((r - g) / d + 4) / 6
                break
        }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/**
 * Convert HSL values to a hex color string.
 * h: 0-360, s: 0-100, l: 0-100
 * Returns string with leading '#'.
 */
export function hslToHex(h: number, s: number, l: number): string {
    s /= 100
    l /= 100

    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = l - c / 2
    let r = 0,
        g = 0,
        b = 0

    if (0 <= h && h < 60) {
        r = c
        g = x
        b = 0
    } else if (60 <= h && h < 120) {
        r = x
        g = c
        b = 0
    } else if (120 <= h && h < 180) {
        r = 0
        g = c
        b = x
    } else if (180 <= h && h < 240) {
        r = 0
        g = x
        b = c
    } else if (240 <= h && h < 300) {
        r = x
        g = 0
        b = c
    } else if (300 <= h && h < 360) {
        r = c
        g = 0
        b = x
    }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16)
        return hex.length === 1 ? '0' + hex : hex
    }

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Supported output formats for {@link formatColor}.
 */
export type ColorFormat = 'hex' | 'rgb' | 'hsl'

/**
 * An RGB color with 0-255 integer channels.
 */
export interface RgbColor {
    r: number
    g: number
    b: number
}

/**
 * A fully normalized color model.
 *
 * - `hex` is lowercase, 6-digit, with a leading '#'
 * - `h` is 0-359, `s`/`l` are 0-100
 * - `alpha` is 0-1
 */
export interface ParsedColor {
    hex: string
    h: number
    s: number
    l: number
    alpha: number
}

/**
 * Options for {@link formatColor}.
 */
export interface FormatColorOptions {
    /**
     * Whether to include the alpha channel in the output.
     * Defaults to `true` when the color's alpha is below 1, `false` otherwise.
     */
    includeAlpha?: boolean
}

const clamp = (number: number, min: number, max: number): number => Math.min(max, Math.max(min, number))

/**
 * Normalize a hue to an integer in the range 0-359, wrapping negatives and overflow.
 */
export function normalizeHue(number: number): number {
    const rounded = Math.round(number)

    return ((rounded % 360) + 360) % 360
}

/**
 * Clamp and round a percentage value to an integer in the range 0-100.
 */
export function normalizePercent(number: number): number {
    return clamp(Math.round(number), 0, 100)
}

/**
 * Clamp an alpha value to the range 0-1. Non-finite input falls back to 1.
 */
export function normalizeAlpha(number: number): number {
    return clamp(Number.isFinite(number) ? number : 1, 0, 1)
}

/**
 * Format an alpha value as a compact decimal string (e.g. `0.5`, `1`),
 * dropping trailing zeros.
 */
export function formatAlpha(number: number): string {
    return normalizeAlpha(number).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * Convert a hex color string to RGB channels.
 * Accepts any input understood by {@link parseHexColor}; falls back to black on invalid input.
 */
export function hexToRgb(hex: string): RgbColor {
    const normalized = parseHexColor(hex)?.hex ?? '#000000'

    return {
        r: parseInt(normalized.slice(1, 3), 16),
        g: parseInt(normalized.slice(3, 5), 16),
        b: parseInt(normalized.slice(5, 7), 16),
    }
}

/**
 * Convert RGB channels to a lowercase 6-digit hex string with a leading '#'.
 * Channels are clamped to 0-255.
 */
export function rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Parse an alpha channel from a raw string as found in rgba()/hsla() notation.
 *
 * - `undefined` or empty means "no alpha specified" and returns 1
 * - Percentages (`50%`) must be within 0-100
 * - Decimals must be within 0-1
 * - Returns `null` for out-of-range or non-numeric input
 */
export function parseAlphaChannel(rawAlpha: string | undefined): number | null {
    if (rawAlpha === undefined || rawAlpha.trim() === '') return 1

    const trimmed = rawAlpha.trim()
    const number = Number.parseFloat(trimmed)

    if (!Number.isFinite(number)) return null

    if (trimmed.endsWith('%')) {
        if (number < 0 || number > 100) return null

        return normalizeAlpha(number / 100)
    }

    if (number < 0 || number > 1) return null

    return normalizeAlpha(number)
}

/**
 * Parse a single RGB channel from a raw string.
 *
 * - Percentages (`50%`) map 0-100 onto 0-255
 * - Numbers must be within 0-255
 * - Returns `null` for out-of-range or non-numeric input
 */
export function parseRgbChannel(rawChannel: string): number | null {
    const trimmed = rawChannel.trim()
    const number = Number.parseFloat(trimmed)

    if (!Number.isFinite(number)) return null

    if (trimmed.endsWith('%')) {
        if (number < 0 || number > 100) return null

        return clamp(Math.round((number / 100) * 255), 0, 255)
    }

    if (number < 0 || number > 255) return null

    return clamp(Math.round(number), 0, 255)
}

/**
 * Build a {@link ParsedColor} from a 6-digit hex string and optional alpha (0-1).
 */
export function parsedFromHex(hex: string, alphaValue = 1): ParsedColor {
    const hsl = hexToHsl(hex)

    return {
        hex: hex.toLowerCase(),
        h: normalizeHue(hsl.h),
        s: normalizePercent(hsl.s),
        l: normalizePercent(hsl.l),
        alpha: normalizeAlpha(alphaValue),
    }
}

/**
 * Parse a hex color string into a {@link ParsedColor}.
 *
 * Accepts 3, 4, 6, or 8 digit hex, with or without a leading '#'.
 * 4/8 digit forms carry an alpha channel. Returns `null` on invalid input.
 */
export function parseHexColor(input: string): ParsedColor | null {
    const trimmed = input.trim()
    const match = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(trimmed)

    if (!match) return null

    const raw = match[1]
    const expanded =
        raw.length === 3 || raw.length === 4
            ? raw
                  .split('')
                  .map((char) => char + char)
                  .join('')
            : raw
    const hex = `#${expanded.slice(0, 6)}`
    const alphaHex = expanded.length === 8 ? expanded.slice(6, 8) : null

    return parsedFromHex(hex, alphaHex ? parseInt(alphaHex, 16) / 255 : 1)
}

/**
 * Parse an `rgb()`/`rgba()` color string into a {@link ParsedColor}.
 * Channels may be numeric (0-255) or percentages. Returns `null` on invalid input.
 */
export function parseRgbColor(input: string): ParsedColor | null {
    const match =
        /^rgba?\(\s*([+-]?\d*\.?\d+%?)\s*,\s*([+-]?\d*\.?\d+%?)\s*,\s*([+-]?\d*\.?\d+%?)(?:\s*,\s*([+-]?\d*\.?\d+%?))?\s*\)$/i.exec(
            input.trim(),
        )

    if (!match) return null

    const r = parseRgbChannel(match[1])
    const g = parseRgbChannel(match[2])
    const b = parseRgbChannel(match[3])
    const alphaValue = parseAlphaChannel(match[4])

    if (r === null || g === null || b === null || alphaValue === null) return null

    return parsedFromHex(rgbToHex(r, g, b), alphaValue)
}

/**
 * Parse an `hsl()`/`hsla()` color string into a {@link ParsedColor}.
 * Saturation and lightness must be percentages within 0-100. Returns `null` on invalid input.
 */
export function parseHslColor(input: string): ParsedColor | null {
    const match =
        /^hsla?\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)%\s*,\s*([+-]?\d*\.?\d+)%(?:\s*,\s*([+-]?\d*\.?\d+%?))?\s*\)$/i.exec(
            input.trim(),
        )

    if (!match) return null

    const h = normalizeHue(Number.parseFloat(match[1]))
    const s = Number.parseFloat(match[2])
    const l = Number.parseFloat(match[3])
    const alphaValue = parseAlphaChannel(match[4])

    if (!Number.isFinite(s) || !Number.isFinite(l) || s < 0 || s > 100 || l < 0 || l > 100 || alphaValue === null)
        return null

    return {
        hex: hslToHex(h, s, l).toLowerCase(),
        h,
        s: normalizePercent(s),
        l: normalizePercent(l),
        alpha: alphaValue,
    }
}

/**
 * Parse any supported color string (hex, rgb/rgba, hsl/hsla) into a {@link ParsedColor}.
 * Returns `null` for empty or unrecognized input.
 */
export function parseColorString(input: string | null | undefined): ParsedColor | null {
    if (!input) return null

    return parseHexColor(input) ?? parseRgbColor(input) ?? parseHslColor(input)
}

/**
 * Format a {@link ParsedColor} as a `hex`, `rgb`, or `hsl` string.
 *
 * By default the alpha channel is only included when the color is partially
 * transparent (`alpha < 1`); override with {@link FormatColorOptions.includeAlpha}.
 * Returned values are stable and normalized (hex is lowercase); callers may
 * uppercase for display.
 */
export function formatColor(color: ParsedColor, format: ColorFormat = 'hex', options: FormatColorOptions = {}): string {
    const normalized: ParsedColor = {
        hex: color.hex,
        h: normalizeHue(color.h),
        s: normalizePercent(color.s),
        l: normalizePercent(color.l),
        alpha: normalizeAlpha(color.alpha),
    }

    const includeAlpha = options.includeAlpha ?? normalized.alpha < 1

    if (format === 'rgb') {
        const { r, g, b } = hexToRgb(normalized.hex)

        return includeAlpha ? `rgba(${r}, ${g}, ${b}, ${formatAlpha(normalized.alpha)})` : `rgb(${r}, ${g}, ${b})`
    }

    if (format === 'hsl') {
        return includeAlpha
            ? `hsla(${normalized.h}, ${normalized.s}%, ${normalized.l}%, ${formatAlpha(normalized.alpha)})`
            : `hsl(${normalized.h}, ${normalized.s}%, ${normalized.l}%)`
    }

    return includeAlpha
        ? `${normalized.hex}${Math.round(normalized.alpha * 255)
              .toString(16)
              .padStart(2, '0')}`
        : normalized.hex
}
