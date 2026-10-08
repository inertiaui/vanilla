function isDisabledElement(element: HTMLElement): boolean {
    return 'disabled' in element && (element as HTMLButtonElement | HTMLInputElement).disabled === true
}

export function focusFirstEnabledElement(
    elements: Array<HTMLElement | null | undefined>,
    options?: FocusOptions,
): boolean {
    const control = elements.find((candidate) => candidate && !isDisabledElement(candidate))

    if (control) {
        if (options) control.focus(options)
        else control.focus()
        return true
    }

    return false
}
