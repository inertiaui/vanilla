# Inertia UI Vanilla

A lightweight vanilla TypeScript library providing UI utilities for dialogs, animations, focus management, menu/listbox navigation, click outside detection, floating and native popover positioning, reorder interactions, visibility logic, color parsing, debounced remote interactions, and common helper functions. Framework-agnostic and designed to integrate seamlessly with Vue, React, or any JavaScript application.

This package is part of the [Inertia UI](https://inertiaui.com) suite. Check out our other packages:

- **[Inertia Modal](https://inertiaui.com/inertia-modal/docs/)**: Turn any Laravel route into a modal or slideover with a single component. No backend changes needed, with support for nested/stacked modals and inter-modal communication. Works with Vue and React.
- **[Inertia Table](https://inertiaui.com/inertia-table)**: The most complete data table package for Laravel and Inertia.js. Sorting, searching, and filtering across relationships, bulk actions, CSV/Excel/PDF exports, sticky headers, and much more. Works with Vue and React.

[![Inertia UI](https://inertiaui.com/visit-card.jpg)](https://inertiaui.com)

## Installation

```bash
npm install @inertiaui/vanilla
```

## Table of Contents

- [Scroll Locking](#scroll-locking)
- [Focus Management](#focus-management)
- [Keyboard Events](#keyboard-events)
- [Click Outside](#click-outside)
- [Menu Navigation](#menu-navigation)
- [Listbox Helpers](#listbox-helpers)
- [Reorder](#reorder)
- [Positioning](#positioning)
- [Native Popovers](#native-popovers)
- [Accessibility](#accessibility)
- [Animation](#animation)
- [Dark Mode Detection](#dark-mode-detection)
- [RTL Support](#rtl-support)
- [Debounce](#debounce)
- [Remote Requests](#remote-requests)
- [Color](#color)
- [Visibility](#visibility)
- [Helpers](#helpers)
  - [generateId](#generateid)
  - [blank](#blank)
  - [onceChildrenRendered](#oncechildrenrendered)
  - [Object Filtering](#object-filtering)
  - [String Utilities](#string-utilities)
  - [URL Utilities](#url-utilities)

## Scroll Locking

The `lockScroll` function prevents body scroll while dialogs or modals are open, with reference counting support for nested dialogs.

### Basic Usage

```typescript
import { lockScroll } from '@inertiaui/vanilla'

const unlock = lockScroll()

// Later, unlock
unlock()
```

The function:

- Sets `document.body.style.overflow` to `'hidden'`
- Uses `scrollbar-gutter: stable` when supported, otherwise adds body padding to compensate for scrollbar width
- Returns a cleanup function that can only unlock once

### Reference Counting

Multiple calls to `lockScroll` are reference counted. The body scroll is only restored when all locks are released:

```typescript
import { lockScroll } from '@inertiaui/vanilla'

const unlock1 = lockScroll()
const unlock2 = lockScroll()

// Body is locked

unlock1()
// Body is still locked (one reference remaining)

unlock2()
// Body scroll is restored
```

### Idempotent Unlock

Each cleanup function can only unlock once, preventing accidental double-unlocking:

```typescript
const unlock = lockScroll()
unlock() // Decrements count
unlock() // No effect
unlock() // No effect
```

## Focus Management

Focus management utilities help create accessible dialogs by trapping focus and managing focusable elements.

### createFocusTrap

Creates a focus trap within a container element.

```typescript
import { createFocusTrap } from '@inertiaui/vanilla'

const cleanup = createFocusTrap(dialogElement)

// Later, remove the focus trap
cleanup()
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialFocus` | `boolean` | `true` | Focus first element immediately |
| `initialFocusElement` | `HTMLElement \| null` | `null` | Specific element to focus initially |
| `returnFocus` | `boolean` | `true` | Return focus to previous element on cleanup |

#### Behavior

The focus trap:

- Listens for Tab key and wraps focus at container boundaries
- Prevents focus from leaving the container via Tab or Shift+Tab
- Catches focus that escapes (e.g., via mouse click outside)
- Optionally focuses the first focusable element on creation
- Optionally returns focus to the previously focused element on cleanup
- Supports nesting: when multiple traps are active, only the most recently created trap receives focus. Cleaning up the inner trap restores the outer trap.

```typescript
const container = document.getElementById('dialog')!
const submitButton = document.getElementById('submit')

const cleanup = createFocusTrap(container, {
    initialFocusElement: submitButton, // Focus submit button instead of first element
})
```

#### Focusable Elements

The focus trap recognizes these elements as focusable:

- `a[href]`
- `button:not([disabled])`
- `textarea:not([disabled])`
- `input:not([disabled])`
- `select:not([disabled])`
- `[tabindex]:not([tabindex="-1"])`

Elements with `aria-hidden="true"` are excluded. (Elements with `disabled` are already filtered by the selectors above.)

### focusFirstEnabledElement

Focuses the first non-disabled element in a list of candidates. Nullish values are ignored, and the function returns whether anything was focused.

```typescript
import { focusFirstEnabledElement } from '@inertiaui/vanilla'

const focused = focusFirstEnabledElement([
    document.getElementById('primary') as HTMLButtonElement | null,
    document.getElementById('fallback') as HTMLButtonElement | null,
])

// true when an enabled element was focused
```

## Keyboard Events

### onEscapeKey

Registers an Escape key handler.

```typescript
import { onEscapeKey } from '@inertiaui/vanilla'

const cleanup = onEscapeKey((event) => {
    console.log('Escape pressed!')
})

// Later, remove the handler
cleanup()
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preventDefault` | `boolean` | `false` | Call `event.preventDefault()` |
| `stopPropagation` | `boolean` | `false` | Call `event.stopPropagation()` |

```typescript
const cleanup = onEscapeKey(handleEscape, {
    preventDefault: true,
    stopPropagation: true,
})
```

### Cleanup Pattern

The cleanup function pattern integrates well with framework lifecycle hooks:

```typescript
// Vue (<script setup>)
const cleanup = onEscapeKey(closeDialog)
onUnmounted(() => cleanup())

// React
useEffect(() => {
    return onEscapeKey(closeDialog)
}, [])
```

## Click Outside

The `onClickOutside` function detects clicks outside one or more elements and calls a callback. Useful for closing dropdowns, popovers, and modals when the user clicks elsewhere.

### Basic Usage

```typescript
import { onClickOutside } from '@inertiaui/vanilla'

const cleanup = onClickOutside(dropdownElement, (event) => {
    closeDropdown()
})

// Later, remove the listener
cleanup()
```

### Multiple Elements

Pass an array of elements to ignore clicks inside any of them:

```typescript
const cleanup = onClickOutside([triggerButton, dropdownPanel], () => {
    closeDropdown()
})
```

### Portal Support

Clicks inside elements with the `data-inertiaui-portal` attribute (or their descendants) are automatically ignored. This prevents portalled content like dropdown menus from being considered "outside":

```html
<div data-inertiaui-portal>
    <!-- Clicks here won't trigger the callback -->
</div>
```

### Same-Tick Protection

The listener registration is deferred by one tick, so the click that triggered the element to open won't immediately close it:

```typescript
openButton.addEventListener('click', () => {
    dropdown.hidden = false
    // The click on openButton won't trigger the outside handler
    onClickOutside(dropdown, () => { dropdown.hidden = true })
})
```

## Menu Navigation

The `createMenuNavigation` function adds keyboard navigation to menu containers, implementing the [WAI-ARIA Menu Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu/). It supports arrow key navigation, roving tabindex, type-ahead search, and item activation.

### Basic Usage

```typescript
import { createMenuNavigation } from '@inertiaui/vanilla'

const cleanup = createMenuNavigation(menuElement)

// Later, remove navigation
cleanup()
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `itemSelector` | `string` | `'[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'` | CSS selector for menu items |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Arrow key direction |
| `loop` | `boolean` | `true` | Wrap focus from last to first item |
| `typeAhead` | `boolean` | `true` | Enable type-ahead character search |
| `onActivate` | `(item: HTMLElement) => void` | `undefined` | Called when an item is activated via Enter or Space |

### Keyboard Support

| Key | Action |
|-----|--------|
| `ArrowDown` / `ArrowRight` | Focus next item (depending on orientation) |
| `ArrowUp` / `ArrowLeft` | Focus previous item (depending on orientation) |
| `Home` | Focus first item |
| `End` | Focus last item |
| `Enter` / `Space` | Activate (click) the focused item |
| Any character | Type-ahead: focus the first item whose text starts with the typed characters |

### Roving Tabindex

The focused item receives `tabindex="0"` while all other items receive `tabindex="-1"`. This allows the menu to participate in the page's tab order with a single tab stop:

```typescript
const cleanup = createMenuNavigation(menuElement)

// First item has tabindex="0", rest have tabindex="-1"
// Arrow keys move focus and update tabindex accordingly
```

### Horizontal Menus

For horizontal menus like toolbars, use `orientation: 'horizontal'`:

```typescript
const cleanup = createMenuNavigation(toolbar, {
    orientation: 'horizontal',
})
// ArrowRight/ArrowLeft navigate instead of ArrowDown/ArrowUp
```

### Custom Item Selector

Use a custom selector for non-standard menu structures:

```typescript
const cleanup = createMenuNavigation(container, {
    itemSelector: '.menu-item:not(.disabled)',
})
```

### Full Example

```typescript
import { createMenuNavigation, onClickOutside, onEscapeKey } from '@inertiaui/vanilla'

function openMenu(menuElement: HTMLElement) {
    menuElement.hidden = false

    const cleanups = [
        createMenuNavigation(menuElement, {
            onActivate: (item) => {
                handleMenuAction(item.dataset.action!)
                closeMenu()
            },
        }),
        onClickOutside(menuElement, closeMenu),
        onEscapeKey(closeMenu),
    ]

    function closeMenu() {
        cleanups.forEach((fn) => fn())
        menuElement.hidden = true
    }
}
```

## Listbox Helpers

Lower-level utilities for combobox/listbox-style controls.

### resolveListboxNavigation

Resolves common listbox navigation keys (`ArrowDown`, `ArrowUp`, `Home`, `End`) to a new active index.

```typescript
import { resolveListboxNavigation } from '@inertiaui/vanilla'

const result = resolveListboxNavigation({
    items,
    currentIndex,
    key: event.key,
    isItemDisabled: (item) => item.disabled,
})

if (result.handled) {
    event.preventDefault()
    currentIndex = result.index
}
```

### createFocusOutDismiss

Schedules dismissal when focus leaves a container. This is useful for comboboxes and popovers where blur should dismiss after the browser has moved focus.

```typescript
import { createFocusOutDismiss } from '@inertiaui/vanilla'

const focusOut = createFocusOutDismiss({
    container: () => popoverElement,
    onDismiss: closePopover,
    delay: 150,
    shouldIgnore: () => isPointerDownInsideScrollbar,
})

popoverElement.addEventListener('focusout', (event) => {
    focusOut.schedule(event)
})

// Call when opening to invalidate an old scheduled dismissal.
focusOut.markOpen()

// Later
focusOut.cleanup()
```

## Reorder

Framework-neutral helpers for keyboard and pointer reordering.

### createReorderableList

Use `createReorderableList` when you want a headless list controller that owns item registration, live pointer preview state, keyboard moves, pointer commits, optional bounds, optional auto-scroll, and cleanup. Rendering, announcements, focus handling, and animations stay in your package or framework adapter.

```typescript
import { createReorderableList, REORDERABLE_LIST_HANDLE_ATTRIBUTE } from '@inertiaui/vanilla'

let items = ['Apple', 'Banana', 'Cherry']

const controller = createReorderableList({
    getItems: () => items,
    setItems: (nextItems) => {
        items = nextItems
        render()
    },
    getBounds: () => listElement.getBoundingClientRect(),
    autoScroll: true,
    onChange: () => render(),
    onBeforeReorder: (move, context) => {
        if (!context.alreadyPreviewed) {
            captureAnimationSnapshot()
        }
    },
    onReorder: (move) => {
        announce(`Moved ${move.item}`)
    },
})

controller.setListElement(listElement)

items.forEach((_, index) => {
    controller.setItemElement(index, itemElements[index])
    handles[index].setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
    handles[index].addEventListener('pointerdown', (event) => controller.pointerDown(index, event))
})

moveUpButton.addEventListener('click', () => controller.moveItem(index, 'up'))
```

Use `getPreviewOrder()` or `getPreviewItems()` during pointer dragging when your renderer needs to show the future order before release. The reorder detail includes `alreadyPreviewed`, so consumers can avoid replaying the same release animation when the list already animated into the committed position.

#### Reorderable List Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `getItems` | `() => readonly T[]` | Required | Current ordered items |
| `setItems` | `(items: T[]) => void` | `undefined` | Optional writer used by `moveItem` and pointer commits |
| `canReorder` | `() => boolean` | `true` | Guard before starting or committing a reorder |
| `getBounds` | `() => ReorderBounds \| null` | Registered list rect | Optional outer active area |
| `autoScroll` | `boolean \| AutoScrollerOptions` | `false` | Edge auto-scroll while dragging |
| `onChange` | `(state) => void` | `undefined` | Called when pointer drag state changes |
| `onBeforeReorder` | `(move, context) => void` | `undefined` | Called before writing items or firing `onReorder` |
| `onReorder` | `(move, context) => void` | `undefined` | Called after a valid keyboard or pointer reorder |

## Positioning

Utilities for positioning floating elements (dropdowns, tooltips, popovers) relative to a reference element. Uses [CSS Anchor Positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning) when supported, with an automatic JavaScript fallback.

### supportsAnchorPositioning

Check if the browser supports CSS Anchor Positioning:

```typescript
import { supportsAnchorPositioning } from '@inertiaui/vanilla'

if (supportsAnchorPositioning()) {
    // Browser handles positioning via CSS
} else {
    // JavaScript fallback is used
}
```

The result is cached after the first call.

### computePosition

Position a floating element relative to a reference element:

```typescript
import { computePosition } from '@inertiaui/vanilla'

const result = computePosition(referenceElement, floatingElement)
// { x: 100, y: 140, placement: 'bottom-start' }
```

The function applies positioning styles to the floating element automatically (`position: fixed` with `top` and `left` values).

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `placement` | `Placement` | `'bottom-start'` | Where to position the floating element |
| `offset` | `number` | `0` | Distance in pixels between reference and floating element |
| `flip` | `boolean` | `true` | Flip to opposite side when overflowing viewport |
| `autoSize` | `boolean` | `false` | Constrain the floating element to the available viewport space (sets `max-height` and `overflow-y: auto`) |

#### Placements

Twelve placement options are available, combining a side with an optional alignment:

| Side | Center | Start | End |
|------|--------|-------|-----|
| `top` | `top` | `top-start` | `top-end` |
| `bottom` | `bottom` | `bottom-start` | `bottom-end` |
| `left` | `left` | `left-start` | `left-end` |
| `right` | `right` | `right-start` | `right-end` |

The `start` and `end` alignments are RTL-aware for `top` and `bottom` placements.

#### Flip Behavior

When the floating element would overflow the viewport, it automatically flips to the opposite side:

```typescript
// If there's no room below, flips to top
const result = computePosition(reference, floating, {
    placement: 'bottom-start',
})
// result.placement may be 'top-start' if it flipped
```

Disable flipping to keep the element on the specified side:

```typescript
const result = computePosition(reference, floating, {
    placement: 'bottom-start',
    flip: false,
})
```

#### Viewport Clamping

The floating element is always clamped to stay within the viewport with a 4px margin, even after flipping.

#### Auto Sizing

Enable `autoSize` to cap the floating element's height to the space between its anchored edge and the viewport edge, adding a scrollbar when the content is taller. Useful for long menus that would otherwise overflow.

```typescript
computePosition(reference, floating, {
    placement: 'bottom-start',
    offset: 8,
    autoSize: true,
})
```

This sets `max-height` and `overflow-y: auto` on the floating element. Cap the height further via the `--iui-max-height` CSS variable (mirrors Headless UI's `--anchor-max-height`):

```css
.menu {
    --iui-max-height: 20rem;
}
```

### autoUpdate

Automatically reposition the floating element when the layout changes:

```typescript
import { computePosition, autoUpdate } from '@inertiaui/vanilla'

const cleanup = autoUpdate(referenceElement, floatingElement, () => {
    computePosition(referenceElement, floatingElement, {
        placement: 'bottom-start',
        offset: 8,
    })
})

// Later, stop updating
cleanup()
```

`autoUpdate` listens for:

- Window `resize` events
- Window `scroll` events (including nested scrollable containers)
- Size changes on both the reference and floating elements (via `ResizeObserver`)

Updates are batched using `requestAnimationFrame` to avoid layout thrashing.

### CSS Anchor Positioning

When the browser supports CSS Anchor Positioning, `computePosition` uses native CSS for positioning. This provides better performance and handles edge cases like scrolling and resizing without JavaScript recalculation. The `autoUpdate` cleanup function automatically removes CSS anchor styles when called.

Use `supportsTopLayerAnchorPositioning()` to check whether the browser also supports anchor positioning/sizing for top-layer popovers:

```typescript
import { supportsTopLayerAnchorPositioning } from '@inertiaui/vanilla'

if (supportsTopLayerAnchorPositioning()) {
    // Native anchor positioning can be used for popover/top-layer content.
}
```

### positionTopLayerPopover

Position a native top-layer popover (`popover="manual"` or `popover="auto"`) relative to a reference element. This helper uses CSS Anchor Positioning when available and falls back to manual fixed positioning.

```typescript
import { positionTopLayerPopover } from '@inertiaui/vanilla'

popover.showPopover()

const result = positionTopLayerPopover(button, popover, {
    placement: 'bottom-start',
    offset: 4,
    matchReferenceWidth: true,
    viewportMargin: 8,
})
```

#### Top-Layer Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `placement` | `Placement` | `'bottom-start'` | Preferred placement |
| `offset` | `number` | `4` | Distance from the reference |
| `flip` | `boolean` | `true` | Flip when the preferred side overflows |
| `matchReferenceWidth` | `boolean` | `false` | Set width to the reference width, clamped to viewport |
| `viewportMargin` | `number` | `8` | Space kept between the popover and viewport edge |
| `anchorPositioning` | `boolean` | `true` | Use CSS Anchor Positioning when supported |

The helper also sets safe overflow styles (`max-width`, `max-height`, `overflow`, and `overscroll-behavior`) so long top-layer menus scroll instead of overflowing the viewport.

### autoUpdateTopLayerPopover

Like `autoUpdate`, but also listens to `visualViewport` scroll/resize events, which are important for top-layer popovers on mobile browsers.

```typescript
import { autoUpdateTopLayerPopover, positionTopLayerPopover } from '@inertiaui/vanilla'

const cleanup = autoUpdateTopLayerPopover(button, popover, () => {
    positionTopLayerPopover(button, popover, {
        placement: 'bottom-start',
        matchReferenceWidth: true,
    })
})

cleanup()
```

### Full Example

```typescript
import { computePosition, autoUpdate } from '@inertiaui/vanilla'

function setupTooltip(trigger: HTMLElement, tooltip: HTMLElement) {
    tooltip.style.display = 'block'

    const cleanup = autoUpdate(trigger, tooltip, () => {
        computePosition(trigger, tooltip, {
            placement: 'top',
            offset: 8,
        })
    })

    // Initial position
    computePosition(trigger, tooltip, {
        placement: 'top',
        offset: 8,
    })

    return cleanup
}
```

## Native Popovers

`createNativePopoverDisclosure` coordinates open state, native `showPopover()`/`hidePopover()`, top-layer positioning, auto-updates, toggle-event sync, and optional focus-out dismissal.

```typescript
import { createNativePopoverDisclosure } from '@inertiaui/vanilla'

const disclosure = createNativePopoverDisclosure({
    reference: () => button,
    popover: () => popover,
    position: {
        placement: 'bottom-start',
        offset: 4,
        matchReferenceWidth: true,
    },
    focusOut: {
        container: () => popover,
        onDismiss: () => disclosure.closePopover(),
    },
    onOpenChange: (open) => {
        button.setAttribute('aria-expanded', String(open))
    },
})

button.addEventListener('click', () => {
    disclosure.togglePopover(
        () => {
            disclosure.openPopover()
            disclosure.showPopover()
            disclosure.updatePosition()
            disclosure.startAutoUpdate()
        },
        () => {
            disclosure.closePopover()
        },
    )
})

popover.addEventListener('toggle', (event) => {
    disclosure.handlePopoverToggle(event)
})

popover.addEventListener('focusout', (event) => {
    disclosure.handleFocusOut(event)
})
```

### Controller Methods

| Method | Description |
|--------|-------------|
| `openPopover({ onBeforeOpen })` | Marks the controller open and cancels pending focus-out dismissal |
| `closePopover({ onClose, hide })` | Marks closed, optionally hides natively, and stops auto-updates |
| `togglePopover(open, close)` | Calls one of two callbacks based on current state |
| `showPopover()` / `hidePopover()` | Delegates to native popover methods |
| `handlePopoverToggle(event, { onClose })` | Syncs controller state when the browser closes the native popover |
| `handleFocusOut(event)` | Delegates to the configured focus-out dismiss controller |
| `updatePosition()` | Runs `positionTopLayerPopover` |
| `startAutoUpdate()` | Starts `autoUpdateTopLayerPopover` |
| `cleanupPopover()` | Cleans focus-out and positioning listeners |

## Accessibility

Accessibility utilities for managing `aria-hidden` attributes with reference counting support.

### markAriaHidden

Marks an element as `aria-hidden="true"` and returns a cleanup function.

```typescript
import { markAriaHidden } from '@inertiaui/vanilla'

const cleanup = markAriaHidden('#app')

// Later, restore
cleanup()
```

Accepts either an element or a CSS selector:

```typescript
// Using selector
const cleanup1 = markAriaHidden('#app')

// Using element
const element = document.getElementById('app')!
const cleanup2 = markAriaHidden(element)
```

### Reference Counting

Like scroll locking, `aria-hidden` management uses reference counting for nested dialogs:

```typescript
import { markAriaHidden } from '@inertiaui/vanilla'

const cleanup1 = markAriaHidden('#app')
const cleanup2 = markAriaHidden('#app')

// Element is aria-hidden="true"

cleanup1()
// Element is still aria-hidden="true" (one reference remaining)

cleanup2()
// Element's aria-hidden is restored to original value
```

### Original Value Preservation

The original `aria-hidden` value is preserved and restored:

```typescript
const element = document.getElementById('sidebar')!
element.setAttribute('aria-hidden', 'false')

const cleanup = markAriaHidden(element)
element.getAttribute('aria-hidden') // 'true'

cleanup()
element.getAttribute('aria-hidden') // 'false' (restored)
```

If the element had no `aria-hidden` attribute, the attribute is removed on cleanup:

```typescript
const element = document.getElementById('main')!
// No aria-hidden attribute

const cleanup = markAriaHidden(element)
element.getAttribute('aria-hidden') // 'true'

cleanup()
element.getAttribute('aria-hidden') // null (removed)
```

### markInert

Marks an element as inert and returns a cleanup function. Native `HTMLElement.inert` is used when available; older browsers fall back to `aria-hidden="true"`.

```typescript
import { markInert } from '@inertiaui/vanilla'

const cleanup = markInert('#app')

// Later, restore the original inert/aria-hidden state
cleanup()
```

Like `markAriaHidden`, this accepts either an element or selector and uses reference counting. Original `aria-hidden` and native `inert` values are restored after the final cleanup.

### Use with Dialogs

When a dialog opens, the main content should be marked as `aria-hidden` to prevent screen readers from reading background content:

```typescript
import { markInert, lockScroll, createFocusTrap, onEscapeKey } from '@inertiaui/vanilla'

function openDialog(dialogElement: HTMLElement) {
    const closeDialog = () => cleanups.forEach(fn => fn())

    const cleanups = [
        markInert('#app'),
        lockScroll(),
        createFocusTrap(dialogElement),
        onEscapeKey(closeDialog),
    ]

    return closeDialog
}
```

## Animation

The animation module provides a simple wrapper around the Web Animations API with Tailwind CSS-compatible easing functions.

### animate

Animate an element using the Web Animations API. Returns a promise that resolves when the animation completes. If the animation is cancelled (e.g., by calling `cancelAnimations`), the promise resolves with the `Animation` object instead of rejecting.

```typescript
import { animate } from '@inertiaui/vanilla'

await animate(element, [
    { transform: 'scale(0.95)', opacity: 0 },
    { transform: 'scale(1)', opacity: 1 }
])
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `duration` | `number` | `300` | Animation duration in milliseconds |
| `easing` | `string \| EasingName` | `'inOut'` | Easing function (see below) |
| `fill` | `FillMode` | `'forwards'` | Animation fill mode |

```typescript
await animate(element, keyframes, { duration: 200, easing: 'out' })
```

### easings

Pre-defined easing functions matching Tailwind CSS:

```typescript
import { easings } from '@inertiaui/vanilla'

// Available easings:
easings.linear  // 'linear'
easings.in      // 'cubic-bezier(0.4, 0, 1, 1)'
easings.out     // 'cubic-bezier(0, 0, 0.2, 1)'
easings.inOut   // 'cubic-bezier(0.4, 0, 0.2, 1)'
```

You can use easing names directly:

```typescript
await animate(element, keyframes, { easing: 'out' })
```

Or provide a custom easing string:

```typescript
await animate(element, keyframes, { easing: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)' })
```

### cancelAnimations

Cancel any running animations on an element:

```typescript
import { cancelAnimations } from '@inertiaui/vanilla'

cancelAnimations(element)
```

### Full Example

```typescript
import { animate, cancelAnimations } from '@inertiaui/vanilla'

async function showModal(modal: HTMLElement) {
    modal.hidden = false

    await animate(modal, [
        { transform: 'scale(0.95)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 }
    ], { duration: 150, easing: 'out' })
}

async function hideModal(modal: HTMLElement) {
    await animate(modal, [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.95)', opacity: 0 }
    ], { duration: 100, easing: 'in' })

    modal.hidden = true
}

function forceHideModal(modal: HTMLElement) {
    cancelAnimations(modal)
    modal.hidden = true
}
```

## Dark Mode Detection

The `prefersDarkMode` function detects whether the user prefers dark mode, with support for multiple detection strategies.

### Basic Usage

```typescript
import { prefersDarkMode } from '@inertiaui/vanilla'

const isDark = prefersDarkMode()
```

### Strategies

| Strategy | Behavior |
|----------|----------|
| `'auto'` (default) | Checks `<html class="dark">` first, then `prefers-color-scheme: dark` media query |
| `'class'` / `'selector'` | Checks `<html class="dark">` |
| `'media'` | Checks `prefers-color-scheme: dark` media query |
| Custom function | Called directly for full control |

```typescript
// Class-based detection (e.g., Tailwind dark mode)
prefersDarkMode('class')

// Media query only
prefersDarkMode('media')

// Custom logic
prefersDarkMode(() => document.body.dataset.theme === 'dark')
```

## RTL Support

Utilities for detecting and observing right-to-left document direction.

### isRtl

Check whether the document is currently in RTL direction:

```typescript
import { isRtl } from '@inertiaui/vanilla'

if (isRtl()) {
    // Document is right-to-left
}
```

### onRtlChange

Observe changes to the document's `dir` attribute and invoke a callback whenever it changes. Returns a cleanup function.

```typescript
import { onRtlChange } from '@inertiaui/vanilla'

const cleanup = onRtlChange((rtl) => {
    console.log('RTL changed:', rtl)
})

// Later, stop observing
cleanup()
```

## Debounce

### debounce

Debounce a function using `requestAnimationFrame`. Ensures the function runs at most once per animation frame.

```typescript
import { debounce } from '@inertiaui/vanilla'

const handleScroll = debounce(() => {
    updatePosition()
})

window.addEventListener('scroll', handleScroll)
```

### detectFramerate

Detect the browser's current framerate. Returns a Promise that resolves with the detected FPS (capped to the 30–240 range). Falls back to 60 if `requestAnimationFrame` is unavailable or detection times out.

```typescript
import { detectFramerate } from '@inertiaui/vanilla'

const fps = await detectFramerate()
console.log(`Running at ${fps} FPS`)
```

## Remote Requests

Small helpers for debounced remote requests, useful for typeahead, async search, and remote option loading.

### createDebouncer

Create a debouncer with an explicit millisecond delay.

```typescript
import { createDebouncer } from '@inertiaui/vanilla'

const debouncer = createDebouncer(250)

input.addEventListener('input', () => {
    debouncer.schedule(() => {
        search(input.value)
    })
})

// Cancel a pending scheduled call
debouncer.cancel()
```

## Color

Convert colors between hex and HSL.

### hexToHsl

Convert a hex color string to HSL values. Accepts the string with or without a leading `#`. Returns an `HslColor` object (`{ h, s, l }`) with `h` in `0–360` and `s`/`l` in `0–100`. Invalid input falls back to `{ h: 0, s: 100, l: 50 }`.

```typescript
import { hexToHsl } from '@inertiaui/vanilla'

hexToHsl('#3490dc') // { h: 207, s: 71, l: 53 }
hexToHsl('3490dc')  // same — leading '#' is optional
```

### hslToHex

Convert HSL values to a hex color string (with leading `#`). Expects `h: 0–360`, `s: 0–100`, `l: 0–100`.

```typescript
import { hslToHex } from '@inertiaui/vanilla'

hslToHex(207, 71, 53) // '#3290dc'
```

The `HslColor` type is also exported:

```typescript
import type { HslColor } from '@inertiaui/vanilla'
```

### RGB and Normalization Helpers

```typescript
import {
    formatAlpha,
    hexToRgb,
    normalizeAlpha,
    normalizeHue,
    normalizePercent,
    rgbToHex,
} from '@inertiaui/vanilla'

hexToRgb('#3490dc')       // { r: 52, g: 144, b: 220 }
rgbToHex(52, 144, 220)    // '#3490dc'
normalizeHue(-10)         // 350
normalizePercent(120)     // 100
normalizeAlpha(1.5)       // 1
formatAlpha(0.5)          // '0.5'
```

### Color Parsing

Parse hex, RGB/RGBA, or HSL/HSLA strings into a normalized `ParsedColor`.

```typescript
import {
    parseColorString,
    parseHexColor,
    parseHslColor,
    parseRgbColor,
} from '@inertiaui/vanilla'

parseColorString('#3490dc')
// { hex: '#3490dc', h: 207, s: 71, l: 53, alpha: 1 }

parseColorString('rgba(52, 144, 220, 0.5)')
// { hex: '#3490dc', h: 207, s: 71, l: 53, alpha: 0.5 }

parseColorString('hsla(207, 71%, 53%, 50%)')
// { hex: '#3290dc', h: 207, s: 71, l: 53, alpha: 0.5 }
```

The lower-level parsers return `null` when the input is invalid:

```typescript
parseHexColor('#fff')
parseRgbColor('rgb(52, 144, 220)')
parseHslColor('hsl(207, 71%, 53%)')
```

### Channel Parsing

```typescript
import { parseAlphaChannel, parseRgbChannel } from '@inertiaui/vanilla'

parseRgbChannel('50%')     // 128
parseRgbChannel('255')     // 255
parseAlphaChannel('50%')   // 0.5
parseAlphaChannel('0.25')  // 0.25
```

### formatColor

Format a parsed color as hex, RGB/RGBA, or HSL/HSLA. Alpha is included automatically when `alpha < 1`, or explicitly via `includeAlpha`.

```typescript
import { formatColor, parseColorString } from '@inertiaui/vanilla'

const color = parseColorString('rgba(52, 144, 220, 0.5)')!

formatColor(color, 'hex') // '#3490dc80'
formatColor(color, 'rgb') // 'rgba(52, 144, 220, 0.5)'
formatColor(color, 'hsl') // 'hsla(207, 71%, 53%, 0.5)'

formatColor(color, 'hex', { includeAlpha: false })
// '#3490dc'
```

Types exported by the color module include `HslColor`, `RgbColor`, `ParsedColor`, `ColorFormat`, and `FormatColorOptions`.

## Visibility

Evaluate declarative visibility rules against arbitrary data. This is useful for form builders and conditional field rendering.

### resolveVisibilityPath

Resolve a visibility path against local data, with `$`/`$.path` pointing at root data.

```typescript
import { resolveVisibilityPath } from '@inertiaui/vanilla'

resolveVisibilityPath('name', { name: 'Jane Appleseed' })
// 'Jane Appleseed'

resolveVisibilityPath('$.account.plan', { name: 'Jane Appleseed' }, { account: { plan: 'pro' } })
// 'pro'
```

### evaluateVisibility

Evaluate a visibility condition or group. `null` and `undefined` visibility rules return `true`.

```typescript
import { evaluateVisibility, resolveVisibilityPath } from '@inertiaui/vanilla'
import type { Visibility } from '@inertiaui/vanilla'

const visibility: Visibility = {
    operator: 'and',
    conditions: [
        { field: 'account.plan', operator: '=', value: 'pro' },
        { field: 'users', operator: '>', value: 5 },
    ],
}

const visible = evaluateVisibility(visibility, (path) => resolveVisibilityPath(path, data))
```

#### Operators

| Operator | Description |
|----------|-------------|
| `=` / `!=` | Equality with numeric-string normalization |
| `>` / `>=` / `<` / `<=` | Numeric comparisons |
| `in` / `not_in` | Check membership in an expected array |
| `contains` | Check whether an array contains a value |
| `empty` / `not_empty` | Check empty strings, arrays, nullish values, and empty objects |
| `truthy` / `falsy` | Check JavaScript truthiness |

Groups support `and`, `or`, and `not`.

## Helpers

### generateId

Generates a unique ID using `crypto.randomUUID()` with a fallback for environments where it's not available.

```typescript
import { generateId } from '@inertiaui/vanilla'

const id = generateId()
// 'inertiaui_550e8400-e29b-41d4-a716-446655440000'
```

#### Custom Prefix

```typescript
generateId('modal_')
// 'modal_550e8400-e29b-41d4-a716-446655440000'

generateId('dialog-')
// 'dialog-550e8400-e29b-41d4-a716-446655440000'
```

#### Fallback

In environments where `crypto.randomUUID()` is not available, the function falls back to a combination of timestamp and random string:

```typescript
// Fallback format:
// '{prefix}{timestamp}_{random}'
// 'inertiaui_m5x2k9p_7h3j5k9a2'
```

#### Use Cases

Useful for generating unique IDs for:

- Dialog instances
- Form elements requiring unique IDs
- Accessibility attributes (`aria-labelledby`, `aria-describedby`)
- Tracking modal instances

```typescript
const dialogId = generateId('dialog_')
const titleId = generateId('title_')
const descId = generateId('desc_')

dialog.setAttribute('aria-labelledby', titleId)
dialog.setAttribute('aria-describedby', descId)
title.id = titleId
description.id = descId
```

### blank

A port of Laravel's `blank` function. Returns `true` if the value is "empty" — `null`, `undefined`, empty string (or whitespace-only), empty array, or empty object.

```typescript
import { blank } from '@inertiaui/vanilla'

blank(null)        // true
blank(undefined)   // true
blank('')          // true
blank('  ')        // true
blank([])          // true
blank('hello')     // false
blank(0)           // false
blank(false)       // false
```

### onceChildrenRendered

Invokes a callback once the given element has child elements. If the element already has children, the callback fires immediately. Otherwise, it uses a `MutationObserver` to wait for children to appear.

```typescript
import { onceChildrenRendered } from '@inertiaui/vanilla'

onceChildrenRendered(containerElement, () => {
    // Children are now present in the DOM
    initializeContent()
})
```

### Object Filtering

#### except

Returns an object or array without the specified keys/elements.

**Objects:**

```typescript
import { except } from '@inertiaui/vanilla'

const obj = { a: 1, b: 2, c: 3 }
except(obj, ['b'])
// { a: 1, c: 3 }
```

**Arrays:**

```typescript
const arr = ['a', 'b', 'c', 'd']
except(arr, ['b', 'd'])
// ['a', 'c']
```

**Case-Insensitive Matching:**

```typescript
const obj = { Name: 1, AGE: 2, city: 3 }
except(obj, ['name', 'age'], true)
// { city: 3 }

const arr = ['Name', 'AGE', 'city']
except(arr, ['name', 'age'], true)
// ['city']
```

#### only

Returns an object or array with only the specified keys/elements.

**Objects:**

```typescript
import { only } from '@inertiaui/vanilla'

const obj = { a: 1, b: 2, c: 3 }
only(obj, ['a', 'c'])
// { a: 1, c: 3 }
```

**Arrays:**

```typescript
const arr = ['a', 'b', 'c', 'd']
only(arr, ['b', 'd'])
// ['b', 'd']
```

**Case-Insensitive Matching:**

```typescript
const obj = { Name: 1, AGE: 2, city: 3 }
only(obj, ['name', 'city'], true)
// { Name: 1, city: 3 }
```

#### rejectNullValues

Removes null values from an object or array.

**Objects:**

```typescript
import { rejectNullValues } from '@inertiaui/vanilla'

const obj = { a: 1, b: null, c: 3 }
rejectNullValues(obj)
// { a: 1, c: 3 }
```

**Arrays:**

```typescript
const arr = [1, null, 3, null, 5]
rejectNullValues(arr)
// [1, 3, 5]
```

> **Note:** `rejectNullValues` only removes `null` values, not `undefined`. Use this when you want to keep `undefined` values but remove explicit nulls.

### String Utilities

#### kebabCase

Converts a string to kebab-case.

```typescript
import { kebabCase } from '@inertiaui/vanilla'

kebabCase('camelCase')       // 'camel-case'
kebabCase('PascalCase')      // 'pascal-case'
kebabCase('snake_case')      // 'snake-case'
kebabCase('already-kebab')   // 'already-kebab'
```

**Handling Special Cases:**

```typescript
kebabCase('user123Name')           // 'user123-name'
kebabCase('multiple__underscores') // 'multiple-underscores'
kebabCase('UPPERCASE')             // 'uppercase'
kebabCase('XMLDocument')           // 'xml-document'
kebabCase('hello world')           // 'hello-world'
```

#### isStandardDomEvent

Checks if an event name is a standard DOM event.

```typescript
import { isStandardDomEvent } from '@inertiaui/vanilla'

isStandardDomEvent('onClick')     // true
isStandardDomEvent('onMouseOver') // true
isStandardDomEvent('onKeyDown')   // true
isStandardDomEvent('onCustom')    // false
```

**Supported Event Categories:**

- Mouse events: `click`, `dblclick`, `mousedown`, `mouseup`, `mouseover`, `mouseout`, `mousemove`, `mouseenter`, `mouseleave`
- Keyboard events: `keydown`, `keyup`, `keypress`
- Form events: `focus`, `blur`, `change`, `input`, `submit`, `reset`
- Window events: `load`, `unload`, `error`, `resize`, `scroll`
- Touch events: `touchstart`, `touchend`, `touchmove`, `touchcancel`
- Pointer events: `pointerdown`, `pointerup`, `pointermove`, `pointerenter`, `pointerleave`, `pointercancel`
- Drag events: `drag`, `dragstart`, `dragend`, `dragenter`, `dragleave`, `dragover`, `drop`
- Animation events: `animationstart`, `animationend`, `animationiteration`
- Transition events: `transitionstart`, `transitionend`, `transitionrun`, `transitioncancel`

**Case Insensitive:**

```typescript
isStandardDomEvent('onclick')  // true
isStandardDomEvent('ONCLICK')  // true
isStandardDomEvent('OnClick')  // true
```

**Use Case:**

Useful for distinguishing between standard DOM events and custom events when processing event handlers:

```typescript
const props: Record<string, Function> = {
    onClick: handleClick,
    onMouseOver: handleHover,
    onModalReady: handleModalReady,
    onUserUpdated: handleUserUpdated,
}

const domEvents: Record<string, Function> = {}
const customEvents: Record<string, Function> = {}

for (const [key, value] of Object.entries(props)) {
    if (isStandardDomEvent(key)) {
        domEvents[key] = value
    } else {
        customEvents[key] = value
    }
}

// domEvents: { onClick, onMouseOver }
// customEvents: { onModalReady, onUserUpdated }
```

### URL Utilities

#### sameUrlPath

Compares two URLs to determine if they have the same origin and pathname, ignoring query strings and hash fragments.

```typescript
import { sameUrlPath } from '@inertiaui/vanilla'

sameUrlPath('/users/1', '/users/1')           // true
sameUrlPath('/users/1', '/users/1?tab=posts') // true
sameUrlPath('/users/1', '/users/2')           // false
sameUrlPath('/users', '/posts')               // false
```

**Accepts URL objects:**

```typescript
const url1 = new URL('https://example.com/users/1')
const url2 = new URL('https://example.com/users/1?page=2')

sameUrlPath(url1, url2) // true
```

**Handles null/undefined:**

```typescript
sameUrlPath(null, '/users')      // false
sameUrlPath('/users', undefined) // false
sameUrlPath(null, null)          // false
```

**Use Case:**

Useful for determining active navigation states or comparing the current route with a link destination:

```typescript
const isActive = sameUrlPath(window.location.href, linkHref)
```

## Development

### Running the dev server

Start Vite to browse the interactive test pages:

```bash
pnpm exec vite --port 3333
```

Then open `http://localhost:3333` for an overview linking to all test pages.

### Running E2E tests

The test suite uses Playwright with Chromium. It automatically starts a Vite dev server:

```bash
pnpm test:e2e
```

Run a single spec:

```bash
pnpm exec playwright test e2e/menu.spec.ts
```

Run tests matching a name:

```bash
pnpm exec playwright test -g "ArrowDown"
```

### Test structure

Each feature has a spec file and a matching HTML page:

```
e2e/click-outside.spec.ts  →  e2e/pages/click-outside.html
e2e/menu.spec.ts           →  e2e/pages/menu.html
e2e/focus-trap.spec.ts     →  e2e/pages/focus-trap.html
...
```

The mapping is handled by a custom fixture in `e2e/test.ts`. HTML pages import directly from the TypeScript source via Vite.

## TypeScript

This library is written in TypeScript and exports the following types:

```typescript
import type {
    AnimateOptions,
    AutoScrollAxis,
    AutoScrollContainer,
    AutoScrollerOptions,
    CleanupFunction,
    ColorFormat,
    DarkModeStrategy,
    Debouncer,
    EscapeKeyOptions,
    FocusOutDismissController,
    FocusOutDismissOptions,
    FocusTrapOptions,
    EasingName,
    FormatColorOptions,
    HslColor,
    ListboxNavigationOptions,
    ListboxNavigationResult,
    MenuNavigationOptions,
    NativePopoverCloseOptions,
    NativePopoverDisclosureController,
    NativePopoverDisclosureOptions,
    NativePopoverOpenOptions,
    NativePopoverToggleOptions,
    Placement,
    ParsedColor,
    PositionOptions,
    PositionResult,
    ReorderBounds,
    ReorderCommitContext,
    ReorderDirection,
    ReorderMove,
    ReorderPreviewItem,
    ReorderableListController,
    ReorderableListOptions,
    ReorderableListState,
    ReorderSource,
    RgbColor,
    TopLayerPopoverPositionOptions,
    Visibility,
    VisibilityComparisonOperator,
    VisibilityCondition,
    VisibilityGroup,
    VisibilityGroupOperator,
    VisibilityLeaf,
    VisibilityMetadata,
    VisibilityResolver,
} from '@inertiaui/vanilla'
```

## License

MIT
