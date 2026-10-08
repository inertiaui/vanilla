export interface CssVariableInheritanceOptions {
    filter: (name: string) => boolean
    mediaQueries?: readonly string[]
}

/** Copy selected computed custom properties and restore owned inline values on cleanup. */
export function inheritCssVariables(
    source: HTMLElement,
    target: HTMLElement,
    options: CssVariableInheritanceOptions,
): () => void {
    const view = source.ownerDocument.defaultView

    if (!view) {
        return () => {}
    }

    const original = new Map<string, { value: string; priority: string }>()
    const applied = new Map<string, string>()

    function restore(name: string) {
        const previous = original.get(name)

        if (previous && target.style.getPropertyValue(name) === applied.get(name)) {
            if (previous.value) {
                target.style.setProperty(name, previous.value, previous.priority)
            } else {
                target.style.removeProperty(name)
            }
        }

        original.delete(name)
        applied.delete(name)
    }

    function update() {
        const computed = view!.getComputedStyle(source)
        const names = new Set<string>()

        for (const name of Array.from(computed)) {
            if (!name.startsWith('--') || !options.filter(name)) {
                continue
            }

            const value = computed.getPropertyValue(name).trim()

            if (!value) {
                continue
            }

            names.add(name)

            if (!original.has(name)) {
                original.set(name, {
                    value: target.style.getPropertyValue(name),
                    priority: target.style.getPropertyPriority(name),
                })
            }

            if (applied.get(name) !== value) {
                target.style.setProperty(name, value)
                applied.set(name, value)
            }
        }

        for (const name of applied.keys()) {
            if (!names.has(name)) {
                restore(name)
            }
        }
    }

    update()

    const observer = new MutationObserver(update)

    for (let ancestor: HTMLElement | null = source; ancestor; ancestor = ancestor.parentElement) {
        observer.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style'] })
    }

    const media = (options.mediaQueries ?? []).map((query) => view.matchMedia(query))
    media.forEach((query) => query.addEventListener('change', update))

    return () => {
        observer.disconnect()
        media.forEach((query) => query.removeEventListener('change', update))

        for (const name of applied.keys()) {
            restore(name)
        }
    }
}
