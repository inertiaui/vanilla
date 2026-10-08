import { createDebouncer } from './debounce'
import type { CleanupFunction } from './dialog'
import { createNativePopoverDisclosure } from './nativePopover'
import type { PopoverMountContext } from './popover'
import {
    autoUpdateTopLayerPopover,
    computePosition,
    type PositionOptions,
    type TopLayerPopoverPositionOptions,
} from './position'

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
    const scheduler = createDebouncer(options.delay ?? 300)
    let hovered = false
    let focused = false
    let closing = false
    let revision = 0
    let mounted: HTMLElement | null = null
    let cleanups: CleanupFunction[] = []
    const disclosure = createNativePopoverDisclosure({
        reference: options.reference,
        popover: options.tooltip,
        get position(): TopLayerPopoverPositionOptions {
            return {
                placement: 'top',
                offset: 6,
                ...options.position,
            }
        },
        onOpenChange: options.onOpenChange,
    })

    function cleanup() {
        revision++
        closing = false
        scheduler.cancel()
        cleanups.forEach((cleanup) => cleanup())
        cleanups = []
        disclosure.cleanupPopover()
        if (native && mounted?.matches(':popover-open')) mounted.hidePopover()
        mounted = null
    }

    async function hide() {
        scheduler.cancel()
        if (!disclosure.isOpen || closing) return
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
        if (disclosure.isOpen) return
        scheduler.schedule(() => {
            if ((hovered || focused) && options.enabled?.() !== false) disclosure.openPopover()
        })
    }

    function dismissIfIdle() {
        if (!hovered && !focused) void hide()
    }

    function mount() {
        const reference = options.reference()
        const tooltip = options.tooltip()
        if (!disclosure.isOpen || !reference || !tooltip) return
        cleanup()
        mounted = tooltip
        if (native) tooltip.showPopover()
        // Preserve the consumer's CSS width limits while sharing positioning and viewport listeners.
        const updatePosition = () =>
            computePosition(reference, tooltip, { placement: 'top', offset: 6, ...options.position })
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
            return disclosure.isOpen
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
