import { onClickOutside } from './clickOutside'
import { onEscapeKey, type CleanupFunction } from './dialog'
import { createMenuNavigation } from './menu'
import {
    createNativePopoverDisclosure,
    type NativePopoverDisclosureController,
    type NativePopoverDisclosureOptions,
} from './nativePopover'
import type { TopLayerPopoverPositionOptions } from './position'
import { followReferenceDirection } from './rtl'

export interface PopoverMountContext {
    reference: HTMLElement
    popover: HTMLElement
    native: boolean
}

export interface PopoverControllerOptions {
    reference: () => HTMLElement | null
    popover: () => HTMLElement | null
    position: TopLayerPopoverPositionOptions
    menu?: boolean
    onOpenChange?: (open: boolean) => void
    onMount?: (context: PopoverMountContext) => CleanupFunction | void
    onOpened?: () => void
    onClosed?: () => void
}

export interface PopoverController {
    readonly native: boolean
    readonly isOpen: boolean
    open: () => void
    close: (restoreFocus?: boolean) => void
    toggle: (event?: MouseEvent) => void
    mount: () => void
    cleanup: CleanupFunction
    onKeydown: (event: KeyboardEvent) => void
    onFocusOut: (event: FocusEvent) => void
    onPointerDown: () => void
}

/** Mount after rendering the open panel; cleanup detaches behavior without discarding open state. */
export function createPopoverController(options: PopoverControllerOptions): PopoverController {
    const native = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype
    let cleanups: CleanupFunction[] = []
    let mountedPanel: HTMLElement | null = null
    let pointerStartedOpen = false
    let focusLast = false

    // Preserve construction-time callbacks while deferring disclosure and timer
    // state until the first interaction. Closed menu lists need neither.
    const disclosureOptions: NativePopoverDisclosureOptions = {
        reference: options.reference,
        popover: options.popover,
        get position() {
            return {
                ...options.position,
                anchorPositioning: native && options.position.anchorPositioning !== false,
            }
        },
        focusOut: {
            container: options.reference,
            shouldIgnore: () => !!options.popover()?.contains(document.activeElement),
            onDismiss: () => close(false),
        },
        onOpenChange: options.onOpenChange,
    }
    let disclosure: NativePopoverDisclosureController | undefined

    function getDisclosure(): NativePopoverDisclosureController {
        return (disclosure ??= createNativePopoverDisclosure(disclosureOptions))
    }

    function cleanup(hide = true) {
        cleanups.forEach((cleanup) => cleanup())
        cleanups = []
        disclosure?.cleanupPopover()
        if (hide && native && mountedPanel?.matches(':popover-open')) {
            mountedPanel.hidePopover()
        }
        mountedPanel = null
    }

    function returnFocus() {
        const reference = options.reference()
        const target = reference?.matches('button, input, select, textarea, a[href], [tabindex]')
            ? reference
            : reference?.querySelector<HTMLElement>(
                  'button:not([disabled]), input, select, textarea, a[href], [tabindex]',
              )
        target?.focus({ preventScroll: true })
    }

    function shouldReturnFocus() {
        return (
            typeof document !== 'undefined' &&
            (!!mountedPanel?.contains(document.activeElement) || document.activeElement === document.body)
        )
    }

    function close(restoreFocus = shouldReturnFocus()) {
        disclosure?.closePopover({
            hide: false,
            onClose() {
                cleanup()
                if (restoreFocus) returnFocus()
                options.onClosed?.()
            },
        })
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && disclosure?.isOpen) {
            event.preventDefault()
            event.stopPropagation()
            close(true)
        } else if (options.menu && !disclosure?.isOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault()
            focusLast = event.key === 'ArrowUp'
            getDisclosure().openPopover()
        }
    }

    function mount() {
        const reference = options.reference()
        const panel = options.popover()
        if (!disclosure?.isOpen || !reference || !panel) return
        const activeDisclosure = disclosure
        cleanup()
        mountedPanel = panel

        const onBeforeToggle = (event: Event) => {
            const restoreFocus = shouldReturnFocus()
            activeDisclosure.handlePopoverToggle(event, {
                onClose() {
                    cleanup(false)
                    if (restoreFocus) returnFocus()
                    options.onClosed?.()
                },
            })
        }
        panel.addEventListener('beforetoggle', onBeforeToggle)
        panel.addEventListener('keydown', onKeydown)
        panel.addEventListener('focusout', activeDisclosure.handleFocusOut)
        cleanups.push(() => {
            panel.removeEventListener('beforetoggle', onBeforeToggle)
            panel.removeEventListener('keydown', onKeydown)
            panel.removeEventListener('focusout', activeDisclosure.handleFocusOut)
        })

        // A panel rendered away from its reference, such as in the body, still reads in the reference's direction.
        cleanups.push(followReferenceDirection(reference, panel))

        if (native) {
            activeDisclosure.showPopover()
        } else {
            activeDisclosure.updatePosition()
            cleanups.push(onClickOutside([reference, panel], () => close()))
            cleanups.push(onEscapeKey(() => close(true)))
        }
        activeDisclosure.startAutoUpdate()

        const cleanupMount = options.onMount?.({ reference, popover: panel, native })
        if (cleanupMount) cleanups.push(cleanupMount)

        if (options.menu) {
            cleanups.push(createMenuNavigation(panel, { initialFocus: focusLast ? 'last' : 'first' }))
            focusLast = false
            const onClick = (event: MouseEvent) => {
                if ((event.target as Element).closest('[role="menuitem"]')) {
                    // Let the item's handler finish before closing, including React's delegated handlers.
                    const timer = setTimeout(() => {
                        if (mountedPanel === panel) close()
                    }, 0)
                    cleanups.push(() => clearTimeout(timer))
                }
            }
            panel.addEventListener('click', onClick)
            cleanups.push(() => panel.removeEventListener('click', onClick))
        }

        options.onOpened?.()
    }

    function toggle(event?: MouseEvent) {
        const wasOpen = !!event?.detail && pointerStartedOpen
        pointerStartedOpen = false
        if (wasOpen) close()
        else
            getDisclosure().togglePopover(
                () => getDisclosure().openPopover(),
                () => close(),
            )
    }

    return {
        native,
        get isOpen() {
            return disclosure?.isOpen ?? false
        },
        open: () => getDisclosure().openPopover(),
        close,
        mount,
        cleanup,
        toggle,
        onKeydown,
        onFocusOut: (event) => getDisclosure().handleFocusOut(event),
        onPointerDown: () => {
            pointerStartedOpen = disclosure?.isOpen ?? false
        },
    }
}
