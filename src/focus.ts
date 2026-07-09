function isDisabledElement(element: HTMLElement): boolean {
    return 'disabled' in element && (element as HTMLButtonElement | HTMLInputElement).disabled === true
}

export function focusFirstEnabledElement(elements: Array<HTMLElement | null | undefined>): boolean {
    const control = elements.find((candidate) => candidate && !isDisabledElement(candidate))

    if (control) {
        control.focus()
        return true
    }

    return false
}
