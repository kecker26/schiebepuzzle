import type { KeyboardEvent } from 'react'

type PickerEnabledSelect = HTMLSelectElement & {
  showPicker?: () => void
}

export function handleSelectEnterKeyDown(event: KeyboardEvent<HTMLSelectElement>): void {
  if (event.key !== 'Enter' && event.key !== 'NumpadEnter') {
    return
  }

  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return
  }

  event.preventDefault()

  const select = event.currentTarget as PickerEnabledSelect

  try {
    if (typeof select.showPicker === 'function') {
      select.showPicker()
      return
    }
  } catch {
    // Fallback below for browsers without picker support.
  }

  select.click()
}
