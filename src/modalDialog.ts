import { createFocusTrap, lockScroll, markInert, onEscapeKey, type CleanupFunction } from './dialog'

export interface DialogMountContext {
    dialog: HTMLElement
    panel: HTMLElement
    native: boolean
}

export interface DialogControllerOptions {
    dialog: () => HTMLElement | null
    panel: () => HTMLElement | null
    onOpenChange?: (open: boolean) => void
    onCancel?: () => void
    onMount?: (context: DialogMountContext) => CleanupFunction | void
    transition?: (visible: boolean) => void | Promise<unknown>
}

export interface DialogController {
    readonly native: boolean
    readonly isOpen: boolean
    open: () => void
    close: () => Promise<void>
    mount: () => void
    cleanup: CleanupFunction
}

const dialogs: object[] = []

/** Controls modal behavior while the consumer owns rendering and transitions. */
export function createDialogController(options: DialogControllerOptions): DialogController {
    const native =
        typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function'
    const entry = {}
    let open = false
    let closing = false
    let revision = 0
    let mounted: HTMLElement | null = null
    let previousFocus: HTMLElement | null = null
    let cleanups: CleanupFunction[] = []

    function cleanup() {
        revision++
        closing = false
        const top = dialogs[dialogs.length - 1] === entry
        const index = dialogs.indexOf(entry)
        if (index !== -1) dialogs.splice(index, 1)
        cleanups.forEach((cleanup) => cleanup())
        cleanups = []
        if (native && (mounted as HTMLDialogElement | null)?.open) (mounted as HTMLDialogElement).close()
        if (!native && top && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
        previousFocus = null
        mounted = null
    }

    function show() {
        revision++
        if (closing) {
            closing = false
            void options.transition?.(true)
        }
        if (open) return
        open = true
        options.onOpenChange?.(true)
    }

    async function close() {
        if (!open || closing) return
        closing = true
        const current = ++revision
        await options.transition?.(false)
        if (current !== revision) return
        open = false
        cleanup()
        options.onOpenChange?.(false)
    }

    function mount() {
        const dialog = options.dialog()
        const panel = options.panel()
        if (!open || !dialog || !panel) return
        cleanup()
        mounted = dialog
        previousFocus = dialog.ownerDocument.activeElement as HTMLElement | null
        dialogs.push(entry)
        cleanups.push(lockScroll())

        if (native) {
            const cancel = (event: Event) => {
                event.preventDefault()
                options.onCancel?.()
            }
            dialog.addEventListener('cancel', cancel)
            cleanups.push(() => dialog.removeEventListener('cancel', cancel))
            ;(dialog as HTMLDialogElement).showModal()
        } else {
            // Inert only siblings along the ancestry, never an ancestor containing the dialog.
            for (let current: HTMLElement | null = dialog; current?.parentElement; current = current.parentElement) {
                for (const sibling of Array.from(current.parentElement.children)) {
                    if (sibling !== current && sibling instanceof HTMLElement) cleanups.push(markInert(sibling))
                }
                if (current.parentElement === dialog.ownerDocument.body) break
            }
            cleanups.push(createFocusTrap(panel, { returnFocus: false }))
            cleanups.push(
                onEscapeKey((event) => {
                    if (event.defaultPrevented || dialogs[dialogs.length - 1] !== entry) return
                    event.preventDefault()
                    event.stopPropagation()
                    options.onCancel?.()
                }),
            )
        }

        const release = options.onMount?.({ dialog, panel, native })
        if (release) cleanups.push(release)
        void options.transition?.(true)
    }

    return {
        native,
        get isOpen() {
            return open
        },
        open: show,
        close,
        mount,
        cleanup,
    }
}
