export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest(
      'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'
    )
  )
}
