import {
    formatAlpha,
    formatColor,
    hexToHsl,
    hexToRgb,
    hslToHex,
    normalizeAlpha,
    normalizeHue,
    normalizePercent,
    parseAlphaChannel,
    parseColorString,
    parseHexColor,
    parseHslColor,
    parseRgbChannel,
    parseRgbColor,
    parsedFromHex,
    rgbToHex,
    type ParsedColor,
} from '../src/color'

describe('hexToHsl / hslToHex (existing compatibility)', () => {
    it('converts hex to hsl', () => {
        expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 100, l: 50 })
        expect(hexToHsl('00ff00')).toEqual({ h: 120, s: 100, l: 50 })
        expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 })
    })

    it('falls back to a default hsl on invalid input', () => {
        expect(hexToHsl('nope')).toEqual({ h: 0, s: 100, l: 50 })
    })

    it('converts hsl to hex', () => {
        expect(hslToHex(0, 100, 50)).toBe('#ff0000')
        expect(hslToHex(120, 100, 50)).toBe('#00ff00')
        expect(hslToHex(240, 100, 50)).toBe('#0000ff')
    })
})

describe('normalize helpers', () => {
    it('normalizeHue wraps into 0-359', () => {
        expect(normalizeHue(0)).toBe(0)
        expect(normalizeHue(360)).toBe(0)
        expect(normalizeHue(-30)).toBe(330)
        expect(normalizeHue(725)).toBe(5)
        expect(normalizeHue(180.4)).toBe(180)
    })

    it('normalizePercent clamps and rounds to 0-100', () => {
        expect(normalizePercent(-10)).toBe(0)
        expect(normalizePercent(150)).toBe(100)
        expect(normalizePercent(49.6)).toBe(50)
    })

    it('normalizeAlpha clamps to 0-1 and defaults non-finite to 1', () => {
        expect(normalizeAlpha(0.5)).toBe(0.5)
        expect(normalizeAlpha(-1)).toBe(0)
        expect(normalizeAlpha(2)).toBe(1)
        expect(normalizeAlpha(Number.NaN)).toBe(1)
    })
})

describe('formatAlpha', () => {
    it('renders compact decimals without trailing zeros', () => {
        expect(formatAlpha(1)).toBe('1')
        expect(formatAlpha(0.5)).toBe('0.5')
        expect(formatAlpha(0.25)).toBe('0.25')
        expect(formatAlpha(0)).toBe('0')
    })
})

describe('rgb <-> hex', () => {
    it('hexToRgb parses channels', () => {
        expect(hexToRgb('#3b82f6')).toEqual({ r: 59, g: 130, b: 246 })
    })

    it('hexToRgb accepts shorthand and falls back to black on invalid', () => {
        expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
        expect(hexToRgb('garbage')).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('rgbToHex clamps and pads', () => {
        expect(rgbToHex(59, 130, 246)).toBe('#3b82f6')
        expect(rgbToHex(0, 0, 0)).toBe('#000000')
        expect(rgbToHex(300, -5, 255)).toBe('#ff00ff')
    })
})

describe('parseHexColor', () => {
    it('parses 6-digit hex with and without #', () => {
        expect(parseHexColor('#ff0000')).toMatchObject({ hex: '#ff0000', h: 0, s: 100, l: 50, alpha: 1 })
        expect(parseHexColor('00ff00')).toMatchObject({ hex: '#00ff00', alpha: 1 })
    })

    it('expands 3-digit shorthand', () => {
        expect(parseHexColor('#f00')).toMatchObject({ hex: '#ff0000', alpha: 1 })
        expect(parseHexColor('abc')).toMatchObject({ hex: '#aabbcc' })
    })

    it('parses 4-digit shorthand with alpha', () => {
        const parsed = parseHexColor('#f00f')
        expect(parsed?.hex).toBe('#ff0000')
        expect(parsed?.alpha).toBe(1)

        const half = parseHexColor('#f008')
        expect(half?.hex).toBe('#ff0000')
        expect(half?.alpha).toBeCloseTo(136 / 255, 5)
    })

    it('parses 8-digit hex with alpha', () => {
        const parsed = parseHexColor('#3b82f680')
        expect(parsed?.hex).toBe('#3b82f6')
        expect(parsed?.alpha).toBeCloseTo(128 / 255, 5)

        expect(parseHexColor('#00000000')?.alpha).toBe(0)
        expect(parseHexColor('#000000ff')?.alpha).toBe(1)
    })

    it('lowercases the hex', () => {
        expect(parseHexColor('#ABCDEF')?.hex).toBe('#abcdef')
    })

    it('returns null for invalid hex', () => {
        expect(parseHexColor('#ff')).toBeNull()
        expect(parseHexColor('#12345')).toBeNull()
        expect(parseHexColor('#gggggg')).toBeNull()
        expect(parseHexColor('')).toBeNull()
    })
})

describe('parseRgbChannel', () => {
    it('parses numeric and percentage channels', () => {
        expect(parseRgbChannel('128')).toBe(128)
        expect(parseRgbChannel(' 255 ')).toBe(255)
        expect(parseRgbChannel('50%')).toBe(128)
        expect(parseRgbChannel('100%')).toBe(255)
    })

    it('returns null for out-of-range or non-numeric', () => {
        expect(parseRgbChannel('256')).toBeNull()
        expect(parseRgbChannel('-1')).toBeNull()
        expect(parseRgbChannel('101%')).toBeNull()
        expect(parseRgbChannel('abc')).toBeNull()
    })
})

describe('parseRgbColor', () => {
    it('parses rgb() with numeric channels', () => {
        expect(parseRgbColor('rgb(59, 130, 246)')).toMatchObject({ hex: '#3b82f6', alpha: 1 })
    })

    it('parses rgba() with alpha', () => {
        const parsed = parseRgbColor('rgba(255, 0, 0, 0.5)')
        expect(parsed?.hex).toBe('#ff0000')
        expect(parsed?.alpha).toBe(0.5)
    })

    it('parses percentage channels', () => {
        expect(parseRgbColor('rgb(100%, 0%, 0%)')).toMatchObject({ hex: '#ff0000' })
    })

    it('parses percentage alpha', () => {
        expect(parseRgbColor('rgba(255, 0, 0, 50%)')?.alpha).toBe(0.5)
    })

    it('returns null for invalid rgb', () => {
        expect(parseRgbColor('rgb(256, 0, 0)')).toBeNull()
        expect(parseRgbColor('rgb(0, 0)')).toBeNull()
        expect(parseRgbColor('rgba(0,0,0,2)')).toBeNull()
        expect(parseRgbColor('hsl(0, 0%, 0%)')).toBeNull()
    })
})

describe('parseHslColor', () => {
    it('parses hsl()', () => {
        expect(parseHslColor('hsl(0, 100%, 50%)')).toMatchObject({ hex: '#ff0000', h: 0, s: 100, l: 50, alpha: 1 })
    })

    it('parses hsla() with alpha', () => {
        const parsed = parseHslColor('hsla(120, 100%, 50%, 0.25)')
        expect(parsed?.hex).toBe('#00ff00')
        expect(parsed?.alpha).toBe(0.25)
    })

    it('wraps negative hue', () => {
        expect(parseHslColor('hsl(-120, 100%, 50%)')?.h).toBe(240)
    })

    it('returns null for out-of-range or malformed', () => {
        expect(parseHslColor('hsl(0, 101%, 50%)')).toBeNull()
        expect(parseHslColor('hsl(0, 50, 50)')).toBeNull()
        expect(parseHslColor('hsl(0, 50%, 50%, 2)')).toBeNull()
    })
})

describe('parseAlphaChannel', () => {
    it('treats missing/empty as fully opaque', () => {
        expect(parseAlphaChannel(undefined)).toBe(1)
        expect(parseAlphaChannel('  ')).toBe(1)
    })

    it('parses decimals and percentages', () => {
        expect(parseAlphaChannel('0.5')).toBe(0.5)
        expect(parseAlphaChannel('50%')).toBe(0.5)
        expect(parseAlphaChannel('1')).toBe(1)
        expect(parseAlphaChannel('0')).toBe(0)
    })

    it('rejects out-of-range and non-numeric', () => {
        expect(parseAlphaChannel('2')).toBeNull()
        expect(parseAlphaChannel('-0.1')).toBeNull()
        expect(parseAlphaChannel('101%')).toBeNull()
        expect(parseAlphaChannel('abc')).toBeNull()
    })
})

describe('parseColorString', () => {
    it('dispatches to hex, rgb, and hsl parsers', () => {
        expect(parseColorString('#3b82f6')?.hex).toBe('#3b82f6')
        expect(parseColorString('rgb(59, 130, 246)')?.hex).toBe('#3b82f6')
        expect(parseColorString('hsl(0, 100%, 50%)')?.hex).toBe('#ff0000')
    })

    it('returns null for empty or unrecognized input', () => {
        expect(parseColorString(null)).toBeNull()
        expect(parseColorString(undefined)).toBeNull()
        expect(parseColorString('')).toBeNull()
        expect(parseColorString('not-a-color')).toBeNull()
    })
})

describe('parsedFromHex', () => {
    it('builds a normalized parsed color', () => {
        expect(parsedFromHex('#FF0000', 0.5)).toEqual({ hex: '#ff0000', h: 0, s: 100, l: 50, alpha: 0.5 })
    })

    it('defaults alpha to 1', () => {
        expect(parsedFromHex('#000000').alpha).toBe(1)
    })
})

describe('formatColor', () => {
    const opaque: ParsedColor = { hex: '#3b82f6', h: 217, s: 91, l: 60, alpha: 1 }
    const translucent: ParsedColor = { hex: '#ff0000', h: 0, s: 100, l: 50, alpha: 0.5 }

    it('formats hex without alpha by default', () => {
        expect(formatColor(opaque, 'hex')).toBe('#3b82f6')
        expect(formatColor(opaque)).toBe('#3b82f6')
    })

    it('appends alpha to hex when translucent', () => {
        expect(formatColor(translucent, 'hex')).toBe('#ff000080')
    })

    it('formats rgb / rgba', () => {
        expect(formatColor(opaque, 'rgb')).toBe('rgb(59, 130, 246)')
        expect(formatColor(translucent, 'rgb')).toBe('rgba(255, 0, 0, 0.5)')
    })

    it('formats hsl / hsla', () => {
        expect(formatColor(opaque, 'hsl')).toBe('hsl(217, 91%, 60%)')
        expect(formatColor(translucent, 'hsl')).toBe('hsla(0, 100%, 50%, 0.5)')
    })

    it('respects includeAlpha override', () => {
        expect(formatColor(translucent, 'hex', { includeAlpha: false })).toBe('#ff0000')
        expect(formatColor(opaque, 'rgb', { includeAlpha: true })).toBe('rgba(59, 130, 246, 1)')
        expect(formatColor(opaque, 'hsl', { includeAlpha: true })).toBe('hsla(217, 91%, 60%, 1)')
    })

    it('normalizes out-of-range channels before formatting', () => {
        const messy: ParsedColor = { hex: '#00ff00', h: 480, s: 150, l: -10, alpha: 2 }
        expect(formatColor(messy, 'hsl')).toBe('hsl(120, 100%, 0%)')
    })

    it('round-trips through parseColorString', () => {
        const parsed = parseColorString('rgba(255, 0, 0, 0.5)')!
        expect(formatColor(parsed, 'rgb')).toBe('rgba(255, 0, 0, 0.5)')
        expect(formatColor(parsed, 'hex')).toBe('#ff000080')
    })
})
