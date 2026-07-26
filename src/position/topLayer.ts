import type { CleanupFunction } from '../dialog'
import {
    cleanupAnchorPositioning,
    detachAnchorPositioning,
    findAnchorClass,
    setupTopLayerAnchorPositioning,
    supportsAnchorFlip,
    supportsTopLayerAnchorPositioning,
    supportsTopLayerAnchorSizing,
} from './anchor'
import {
    clampTopLayerCoordinates,
    computePositionFromRect,
    getAvailableSpace,
    getViewportRect,
    referenceIntersectsViewport,
    resolveTopLayerPlacement,
    topLayerRectOverflowsViewport,
} from './geometry'
import { captureStyleProperty, removeStyleProperty, restoreStyleProperty, setStyleProperty } from './style'
import type {
    PositionResult,
    StoredParkedStyles,
    TopLayerElementResizeObserver,
    TopLayerPopoverPositionOptions,
} from './types'

function observeTopLayerElementResize(
    reference: HTMLElement,
    floating: HTMLElement,
    scheduleUpdate: () => void,
    shouldObserveFloating: () => boolean,
): TopLayerElementResizeObserver {
    if (typeof ResizeObserver !== 'function') {
        return { cleanup: () => {}, syncFloatingObserver: () => {} }
    }

    let floatingObserved = false
    let floatingObserverDeferred = false
    let reobserveFrame: number | undefined
    const resizeObserver = new ResizeObserver((entries) => {
        const referenceResized = entries.some((entry) => entry.target === reference)
        const floatingResized = entries.some((entry) => entry.target === floating)

        if (floatingResized && !referenceResized && !shouldObserveFloating()) {
            syncFloatingObserver()

            return
        }

        if (referenceResized && floatingObserved) {
            // If update() changes the floating element's size constraints, observing
            // it continuously can produce ResizeObserver feedback loops.
            resizeObserver.unobserve(floating)
            floatingObserved = false
            floatingObserverDeferred = true
        }

        scheduleUpdate()

        if (referenceResized) {
            if (reobserveFrame !== undefined) {
                cancelAnimationFrame(reobserveFrame)
            }

            reobserveFrame = requestAnimationFrame(() => {
                reobserveFrame = undefined
                floatingObserverDeferred = false
                syncFloatingObserver()
            })
        }
    })

    const syncFloatingObserver = () => {
        if (floatingObserverDeferred) {
            return
        }

        if (shouldObserveFloating()) {
            if (!floatingObserved) {
                resizeObserver.observe(floating)
                floatingObserved = true
            }

            return
        }

        if (floatingObserved) {
            resizeObserver.unobserve(floating)
            floatingObserved = false
        }
    }

    resizeObserver.observe(reference)
    syncFloatingObserver()

    return {
        cleanup: () => {
            if (reobserveFrame !== undefined) {
                cancelAnimationFrame(reobserveFrame)
                reobserveFrame = undefined
            }

            resizeObserver.disconnect()
            floatingObserved = false
            floatingObserverDeferred = false
        },
        syncFloatingObserver,
    }
}

export function positionTopLayerPopover(
    reference: HTMLElement,
    floating: HTMLElement,
    options: TopLayerPopoverPositionOptions = {},
): PositionResult {
    const {
        placement = 'bottom-start',
        offset = 4,
        flip = true,
        matchReferenceWidth = false,
        viewportMargin = 8,
        anchorPositioning = true,
    } = options
    const viewport = getViewportRect()
    const maxWidth = Math.max(0, Math.floor(viewport.width - viewportMargin * 2))

    setStyleProperty(floating.style, 'position', 'fixed')
    setStyleProperty(floating.style, 'box-sizing', 'border-box')
    setStyleProperty(floating.style, 'max-width', `${maxWidth}px`)
    setStyleProperty(floating.style, 'overflow-x', 'auto')
    setStyleProperty(floating.style, 'overflow-y', 'auto')
    setStyleProperty(floating.style, 'overscroll-behavior', 'contain')

    const referenceRect = reference.getBoundingClientRect()
    const viewportHeight = Math.max(0, Math.floor(viewport.height - viewportMargin * 2))

    if (anchorPositioning && supportsTopLayerAnchorPositioning() && (!flip || supportsAnchorFlip())) {
        if (matchReferenceWidth) {
            setStyleProperty(floating.style, 'width', `${Math.min(referenceRect.width, maxWidth)}px`)
        }

        const measuredRect = floating.getBoundingClientRect()
        const naturalSize = {
            width: Math.max(measuredRect.width, floating.scrollWidth),
            height: Math.max(measuredRect.height, floating.scrollHeight),
        }
        const resolvedPlacement = resolveTopLayerPlacement(
            placement,
            referenceRect,
            naturalSize,
            viewport,
            offset,
            viewportMargin,
            flip,
        )
        const [resolvedSide] = resolvedPlacement.split('-')
        const stretchToAvailableHeight =
            (resolvedSide === 'top' || resolvedSide === 'bottom') && supportsTopLayerAnchorSizing()

        if (stretchToAvailableHeight) {
            removeStyleProperty(floating.style, 'max-height')
        } else {
            const availableHeight =
                resolvedSide === 'top' || resolvedSide === 'bottom'
                    ? Math.min(
                          viewportHeight,
                          Math.max(
                              0,
                              Math.floor(
                                  getAvailableSpace(referenceRect, viewport, resolvedSide, offset, viewportMargin),
                              ),
                          ),
                      )
                    : viewportHeight

            setStyleProperty(floating.style, 'max-height', `${availableHeight}px`)
        }

        setupTopLayerAnchorPositioning(
            reference,
            floating,
            resolvedPlacement,
            offset,
            flip,
            matchReferenceWidth,
            maxWidth,
            viewportMargin,
            stretchToAvailableHeight,
        )

        const finalRect = floating.getBoundingClientRect()

        if (!topLayerRectOverflowsViewport(finalRect, viewport)) {
            return { x: finalRect.left, y: finalRect.top, placement: resolvedPlacement }
        }
    }

    detachAnchorPositioning(reference, floating)

    setStyleProperty(floating.style, 'inset', 'auto')
    setStyleProperty(floating.style, 'right', 'auto')
    setStyleProperty(floating.style, 'bottom', 'auto')
    setStyleProperty(floating.style, 'margin', '0')
    removeStyleProperty(floating.style, 'height')

    if (matchReferenceWidth) {
        setStyleProperty(floating.style, 'width', `${Math.min(referenceRect.width, maxWidth)}px`)
    }

    const measuredRect = floating.getBoundingClientRect()
    const naturalSize = {
        width: Math.max(measuredRect.width, floating.scrollWidth),
        height: Math.max(measuredRect.height, floating.scrollHeight),
    }
    const resolvedPlacement = resolveTopLayerPlacement(
        placement,
        referenceRect,
        naturalSize,
        viewport,
        offset,
        viewportMargin,
        flip,
    )
    const [resolvedSide] = resolvedPlacement.split('-')
    const availableHeight = Math.min(
        viewportHeight,
        Math.max(0, Math.floor(getAvailableSpace(referenceRect, viewport, resolvedSide, offset, viewportMargin))),
    )

    if (resolvedSide === 'top' || resolvedSide === 'bottom') {
        setStyleProperty(floating.style, 'max-height', `${availableHeight}px`)
    } else {
        setStyleProperty(floating.style, 'max-height', `${viewportHeight}px`)
    }

    const floatingRect = floating.getBoundingClientRect()
    const coordinates = computePositionFromRect(referenceRect, floatingRect, resolvedPlacement, offset)
    const { x, y } = clampTopLayerCoordinates(
        coordinates.x,
        coordinates.y,
        floatingRect,
        resolvedPlacement,
        viewport,
        viewportMargin,
    )

    setStyleProperty(floating.style, 'left', `${Math.round(x)}px`)
    setStyleProperty(floating.style, 'top', `${Math.round(y)}px`)

    return { x, y, placement: resolvedPlacement }
}

export function autoUpdateTopLayerPopover(
    reference: HTMLElement,
    floating: HTMLElement,
    update: () => void,
): CleanupFunction {
    const visualViewport = window.visualViewport
    const browserAnchorsPopover = () => supportsTopLayerAnchorPositioning() && findAnchorClass(floating) !== undefined
    let rafId: number | undefined
    let restoreMotionFrame: number | undefined
    let scrollListenersAttached = false
    let syncFloatingResizeObserver = () => {}
    let referenceHidden = !referenceIntersectsViewport(reference)
    let anchorParked = false
    let parkedStyles: StoredParkedStyles | undefined
    let restoreVisibilityAfterUpdate = false
    // Parking relies on the IntersectionObserver below to notice the reference
    // scrolling back into view. Without it, the only wake-up signal is the
    // scroll listener, which parking would otherwise detach, so keep those
    // listeners attached and let scheduleUpdate drive the restore instead.
    const hasReferenceVisibilityObserver = typeof IntersectionObserver === 'function'

    const scheduleUpdate = () => {
        if (rafId !== undefined) {
            return
        }

        rafId = requestAnimationFrame(() => {
            rafId = undefined
            syncReferenceVisibility()

            if (!anchorParked) {
                update()
            }

            syncScrollListeners()
            syncFloatingResizeObserver()

            if (restoreVisibilityAfterUpdate && !anchorParked) {
                restoreParkedVisibility()
            }
        })
    }

    const cancelMotionRestore = () => {
        if (restoreMotionFrame === undefined) {
            return
        }

        cancelAnimationFrame(restoreMotionFrame)
        restoreMotionFrame = undefined
    }

    const restoreParkedMotionStyles = () => {
        if (!parkedStyles) {
            floating.removeAttribute('data-inertiaui-top-layer-parked')

            return
        }

        restoreStyleProperty(floating.style, 'transition', parkedStyles.transition)
        restoreStyleProperty(floating.style, 'animation', parkedStyles.animation)
        floating.removeAttribute('data-inertiaui-top-layer-parked')
    }

    const scheduleMotionRestore = () => {
        cancelMotionRestore()

        restoreMotionFrame = requestAnimationFrame(() => {
            restoreMotionFrame = undefined
            restoreParkedMotionStyles()
            parkedStyles = undefined
        })
    }

    const handleScroll = () => {
        syncReferenceVisibility()

        if (anchorParked || browserAnchorsPopover()) {
            return
        }

        scheduleUpdate()
    }

    const addScrollListeners = () => {
        if (scrollListenersAttached) {
            return
        }

        scrollListenersAttached = true
        window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
        visualViewport?.addEventListener('scroll', handleScroll, { passive: true })
    }

    const removeScrollListeners = () => {
        if (!scrollListenersAttached) {
            return
        }

        scrollListenersAttached = false
        window.removeEventListener('scroll', handleScroll, true)
        visualViewport?.removeEventListener('scroll', handleScroll)
    }

    const syncScrollListeners = () => {
        if (anchorParked && hasReferenceVisibilityObserver) {
            removeScrollListeners()

            return
        }

        addScrollListeners()
    }

    // Hide the popover while its reference is out of view. A top-layer popover
    // paints above every fixed element on the page, so one left tracking an
    // off-screen reference scrolls straight across sticky headers.
    const parkPopover = () => {
        if (anchorParked) {
            return
        }

        if (restoreVisibilityAfterUpdate) {
            restoreVisibilityAfterUpdate = false
        } else if (!parkedStyles) {
            parkedStyles = {
                visibility: captureStyleProperty(floating.style, 'visibility'),
                transition: captureStyleProperty(floating.style, 'transition'),
                animation: captureStyleProperty(floating.style, 'animation'),
            }
        }

        cancelMotionRestore()
        floating.setAttribute('data-inertiaui-top-layer-parked', '')
        floating.style.setProperty('transition', 'none', 'important')
        floating.style.setProperty('animation', 'none', 'important')
        floating.style.setProperty('visibility', 'hidden')

        anchorParked = true
        syncScrollListeners()
        syncFloatingResizeObserver()
    }

    const restoreParkedVisibility = () => {
        if (!parkedStyles) {
            restoreVisibilityAfterUpdate = false

            return
        }

        restoreStyleProperty(floating.style, 'visibility', parkedStyles.visibility)
        restoreVisibilityAfterUpdate = false
        scheduleMotionRestore()
    }

    const restoreParkedPopover = (schedule = true) => {
        if (!anchorParked) {
            return
        }

        anchorParked = false

        if (schedule) {
            restoreVisibilityAfterUpdate = true
            scheduleUpdate()

            return
        }

        restoreParkedVisibility()
    }

    const syncReferenceVisibility = (visible = referenceIntersectsViewport(reference)) => {
        referenceHidden = !visible

        if (visible) {
            restoreParkedPopover()

            return
        }

        parkPopover()
    }

    let cleanupReferenceVisibilityObserver: CleanupFunction = () => {}

    if (typeof IntersectionObserver === 'function') {
        const intersectionObserver = new IntersectionObserver(([entry]) => {
            syncReferenceVisibility(Boolean(entry?.isIntersecting || (entry?.intersectionRatio ?? 0) > 0))
        })

        intersectionObserver.observe(reference)
        cleanupReferenceVisibilityObserver = () => {
            intersectionObserver.disconnect()
        }
    }

    window.addEventListener('resize', scheduleUpdate)
    visualViewport?.addEventListener('resize', scheduleUpdate)
    syncScrollListeners()
    syncReferenceVisibility(!referenceHidden)

    const elementResizeObserver = observeTopLayerElementResize(
        reference,
        floating,
        scheduleUpdate,
        () => !anchorParked && !browserAnchorsPopover(),
    )
    syncFloatingResizeObserver = elementResizeObserver.syncFloatingObserver

    let cleaned = false

    return () => {
        if (cleaned) {
            return
        }
        cleaned = true

        if (rafId !== undefined) {
            cancelAnimationFrame(rafId)
            rafId = undefined
        }
        cancelMotionRestore()

        window.removeEventListener('resize', scheduleUpdate)
        visualViewport?.removeEventListener('resize', scheduleUpdate)
        cleanupReferenceVisibilityObserver()
        elementResizeObserver.cleanup()
        removeScrollListeners()
        restoreParkedPopover(false)
        cancelMotionRestore()
        restoreParkedMotionStyles()
        parkedStyles = undefined

        const anchorClass = findAnchorClass(floating)
        if (anchorClass) {
            cleanupAnchorPositioning(reference, floating, anchorClass)
        }
    }
}
