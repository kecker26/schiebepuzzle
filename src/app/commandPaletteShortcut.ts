export const COMMAND_PALETTE_SHORTCUT_LABEL = 'F8'
export const COMMAND_PALETTE_SHORTCUT_ACCESSIBLE_LABEL = 'F8'

export function isCommandPaletteShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === 'F8'
}
