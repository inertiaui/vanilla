// happy-dom's CSS.supports returns true for everything, including 'anchor-name'.
// The CSS object may be a Proxy, so we replace the entire global.
const originalCSS = globalThis.CSS
const originalSupports = originalCSS.supports.bind(originalCSS)

globalThis.CSS = new Proxy(originalCSS, {
    get(target, prop) {
        if (prop === 'supports') {
            return (...args: [string] | [string, string]) => {
                if (args[0] === 'anchor-name') return false
                return originalSupports(...(args as [string, string]))
            }
        }
        return Reflect.get(target, prop)
    },
})
