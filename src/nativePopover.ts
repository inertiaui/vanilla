import type { CleanupFunction } from './dialog'
import { createFocusOutDismiss, type FocusOutDismissController, type FocusOutDismissOptions } from './listbox'
import { autoUpdateTopLayerPopover, positionTopLayerPopover, type TopLayerPopoverPositionOptions } from './position'

type ElementGetter<T extends HTMLElement = HTMLElement> = () => T | null

type NativeToggleEvent = Event & {
    newState?: 'open' | 'closed'
}

function restoreVisibility(popover: HTMLElement, visibility: string | undefined): void {
    if (visibility === undefined) {
        popover.style.removeProperty('visibility')

        return
    }

    popover.style.setProperty('visibility', visibility)
}

export interface NativePopoverDisclosureOptions {
    reference: ElementGetter
    popover: ElementGetter
    position: TopLayerPopoverPositionOptions
    enabled?: () => boolean
    focusOut?: FocusOutDismissOptions
    onOpenChange?: (isOpen: boolean) => void
}

export interface NativePopoverOpenOptions {
    onBeforeOpen?: () => void
}

export interface NativePopoverCloseOptions {
    onClose?: () => void
    hide?: boolean
}

export interface NativePopoverToggleOptions {
    onClose?: () => void
}

export interface NativePopoverDisclosureController {
    readonly isOpen: boolean
    openPopover: (options?: NativePopoverOpenOptions) => void
    closePopover: (options?: NativePopoverCloseOptions) => boolean
    togglePopover: (open: () => void, close: () => void) => void
    showPopover: () => void
    hidePopover: () => void
    handlePopoverToggle: (event: Event, options?: NativePopoverToggleOptions) => boolean
    handleFocusOut: (event: FocusEvent) => void
    updatePosition: () => void
    startAutoUpdate: () => void
    cleanupPopover: CleanupFunction
}

export function createNativePopoverDisclosure(
    options: NativePopoverDisclosureOptions,
): NativePopoverDisclosureController {
    let isOpen = false
    let autoUpdateCleanup: CleanupFunction | null = null
    const focusOutDismiss: FocusOutDismissController | null = options.focusOut
        ? createFocusOutDismiss(options.focusOut)
        : null

    const setOpen = (open: boolean) => {
        if (isOpen === open) return

        isOpen = open
        options.onOpenChange?.(open)
    }

    const cleanupAutoUpdate = () => {
        autoUpdateCleanup?.()
        autoUpdateCleanup = null
    }

    const getElements = () => {
        if (options.enabled?.() === false) {
            return null
        }

        const reference = options.reference()
        const popover = options.popover()

        if (!reference || !popover) {
            return null
        }

        return { reference, popover }
    }

    const updatePosition = () => {
        const elements = getElements()
        if (!elements) return

        positionTopLayerPopover(elements.reference, elements.popover, options.position)
    }

    const startAutoUpdate = () => {
        cleanupAutoUpdate()

        const elements = getElements()
        if (!elements) return

        autoUpdateCleanup = autoUpdateTopLayerPopover(elements.reference, elements.popover, updatePosition)
    }

    const showPopover = () => {
        const elements = getElements()
        if (!elements) return

        const { reference, popover } = elements
        const previousVisibility = popover.style.getPropertyValue('visibility') || undefined

        popover.style.setProperty('visibility', 'hidden')

        try {
            popover.showPopover()
            positionTopLayerPopover(reference, popover, options.position)
        } finally {
            restoreVisibility(popover, previousVisibility)
        }
    }

    const hidePopover = () => {
        options.popover()?.hidePopover()
    }

    const openPopover = (openOptions: NativePopoverOpenOptions = {}) => {
        focusOutDismiss?.markOpen()
        openOptions.onBeforeOpen?.()
        setOpen(true)
    }

    const closePopover = (closeOptions: NativePopoverCloseOptions = {}) => {
        if (!isOpen) return false

        focusOutDismiss?.cancel()
        setOpen(false)
        closeOptions.onClose?.()

        if (closeOptions.hide !== false) {
            hidePopover()
        }

        cleanupAutoUpdate()

        return true
    }

    const togglePopover = (open: () => void, close: () => void) => {
        if (isOpen) {
            close()
        } else {
            open()
        }
    }

    const handlePopoverToggle = (event: Event, toggleOptions: NativePopoverToggleOptions = {}) => {
        const toggleEvent = event as NativeToggleEvent

        if (toggleEvent.newState !== 'closed' || !isOpen) {
            return false
        }

        focusOutDismiss?.cancel()
        setOpen(false)
        toggleOptions.onClose?.()
        cleanupAutoUpdate()

        return true
    }

    const handleFocusOut = (event: FocusEvent) => {
        focusOutDismiss?.schedule(event)
    }

    const cleanupPopover = () => {
        focusOutDismiss?.cleanup()
        cleanupAutoUpdate()
    }

    return {
        get isOpen() {
            return isOpen
        },
        openPopover,
        closePopover,
        togglePopover,
        showPopover,
        hidePopover,
        handlePopoverToggle,
        handleFocusOut,
        updatePosition,
        startAutoUpdate,
        cleanupPopover,
    }
}
