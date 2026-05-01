const NATIVE_CONTEXT_MENU_SELECTORS = [
  'input:not([type="hidden"])',
  'textarea',
  'select',
  'option',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
].join(', ')

export function shouldPreserveNativeContextMenu(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(NATIVE_CONTEXT_MENU_SELECTORS) !== null
}
