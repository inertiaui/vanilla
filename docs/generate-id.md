# generateId

Generates a unique ID using `crypto.randomUUID()` with a fallback for environments where it's not available.

## Usage

```typescript
import { generateId } from '@inertiaui/vanilla'

const id = generateId()
// 'inertiaui_550e8400-e29b-41d4-a716-446655440000'
```

## Custom Prefix

```typescript
const id = generateId('modal_')
// 'modal_550e8400-e29b-41d4-a716-446655440000'

const id = generateId('dialog-')
// 'dialog-550e8400-e29b-41d4-a716-446655440000'
```

## Fallback

In environments where `crypto.randomUUID()` is not available, the function falls back to a combination of timestamp and random string:

```typescript
// Fallback format:
// '{prefix}{timestamp}_{random}'
// 'inertiaui_m5x2k9p_7h3j5k9a2'
```

## Use Cases

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
