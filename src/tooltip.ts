import { createDebouncer, type Debouncer } from './debounce'
import type { CleanupFunction } from './dialog'
import { createNativePopoverDisclosure, type NativePopoverDisclosureController } from './nativePopover'
import type { PopoverMountContext } from './popover'
import {
    autoUpdateTopLayerPopover,
    computePosition,
    type PositionOptions,
    type TopLayerPopoverPositionOptions,
} from './position'
import { followReferenceDirection } from './rtl'

export interface TooltipControllerOptions {
    reference: () => HTMLElement | null
    tooltip: () => HTMLElement | null
    enabled?: () => boolean
    delay?: number | (() => number)
    position?: PositionOptions
    onOpenChange?: (open: boolean) => void
    onMount?: (context: PopoverMountContext) => CleanupFunction | void
    transition?: (visible: boolean) => void | Promise<unknown>
}

export interface TooltipController {
    readonly native: boolean
    readonly isOpen: boolean
    mount: () => void
    cleanup: CleanupFunction
    hide: () => Promise<void>
    onMouseEnter: () => void
    onMouseLeave: () => void
    onFocusIn: () => void
    onFocusOut: (event: FocusEvent) => void
}

/** Coordinates hover and focus intent without moving focus into the tooltip. */
export function createTooltipController(options: TooltipControllerOptions): TooltipController {
    const native = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype
    const delay = options.delay ?? 300
    let scheduler: Debouncer | undefined
    let hovered = false
    let focused = false
    let closing = false
    let revision = 0
    let mounted: HTMLElement | null = null
    let cleanups: CleanupFunction[] = []
    // Keep closed tooltip controllers cheap when repeated across a large list.
    // Snapshot callbacks at construction just as the eager disclosure does.
    const reference = options.reference
    const tooltip = options.tooltip
    const onOpenChange = options.onOpenChange
    let disclosure: NativePopoverDisclosureController | undefined

    function getDisclosure(): NativePopoverDisclosureController {
        return (disclosure ??= createNativePopoverDisclosure({
            reference,
            popover: tooltip,
            get position(): TopLayerPopoverPositionOptions {
                return { placement: 'top', offset: 6, ...options.position }
            },
            onOpenChange,
        }))
    }

    function cleanup() {
        revision++
        closing = false
        scheduler?.cancel()
        cleanups.forEach((cleanup) => cleanup())
        cleanups = []
        disclosure?.cleanupPopover()
        if (native && mounted?.matches(':popover-open')) mounted.hidePopover()
        mounted = null
    }

    async function hide() {
        scheduler?.cancel()
        if (!disclosure?.isOpen || closing) return
        closing = true
        const current = ++revision
        await options.transition?.(false)
        if (current !== revision) return
        disclosure.closePopover({ hide: false, onClose: cleanup })
    }

    function requestShow() {
        if (options.enabled?.() === false) return
        if (closing) {
            revision++
            closing = false
            void options.transition?.(true)
        }
        if (disclosure?.isOpen) return
        ;(scheduler ??= createDebouncer(delay)).schedule(() => {
            if ((hovered || focused) && options.enabled?.() !== false) getDisclosure().openPopover()
        })
    }

    function dismissIfIdle() {
        if (!hovered && !focused) void hide()
    }

    function mount() {
        const reference = options.reference()
        const tooltip = options.tooltip()
        if (!disclosure?.isOpen || !reference || !tooltip) return
        cleanup()
        mounted = tooltip
        cleanups.push(followReferenceDirection(reference, tooltip))
        if (native) tooltip.showPopover()
        // Numeric positioning keeps centered tooltips beside the trigger at viewport edges
        // and preserves the consumer's CSS width limits.
        const updatePosition = () =>
            computePosition(reference, tooltip, {
                placement: 'top',
                offset: 6,
                anchorPositioning: false,
                ...options.position,
            })
        updatePosition()
        cleanups.push(autoUpdateTopLayerPopover(reference, tooltip, updatePosition))
        const release = options.onMount?.({ reference, popover: tooltip, native })
        if (release) cleanups.push(release)

        // Consume Escape only for this trigger; unrelated focused controls still handle the key.
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            if (event.target instanceof Node && reference.contains(event.target)) {
                event.preventDefault()
                event.stopPropagation()
            }
            void hide()
        }
        reference.ownerDocument.addEventListener('keydown', escape, true)
        cleanups.push(() => reference.ownerDocument.removeEventListener('keydown', escape, true))
        void options.transition?.(true)
    }

    return {
        native,
        get isOpen() {
            return disclosure?.isOpen ?? false
        },
        mount,
        cleanup,
        hide,
        onMouseEnter() {
            hovered = true
            requestShow()
        },
        onMouseLeave() {
            hovered = false
            dismissIfIdle()
        },
        onFocusIn() {
            focused = true
            requestShow()
        },
        onFocusOut(event) {
            if (event.relatedTarget instanceof Node && options.reference()?.contains(event.relatedTarget)) return
            focused = false
            dismissIfIdle()
        },
    }
}
