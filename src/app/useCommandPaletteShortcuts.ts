import { useEffect } from 'react'
import { isCommandPaletteShortcut } from './commandPaletteShortcut.ts'
import { isEditableTarget } from './keyboardShortcutUtils.ts'

interface UseCommandPaletteShortcutsOptions {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

export function useCommandPaletteShortcuts({
  isOpen,
  onOpen,
  onClose,
}: UseCommandPaletteShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      if (!isCommandPaletteShortcut(event)) {
        return
      }

      if (!isOpen && isEditableTarget(event.target)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (isOpen) {
        onClose()
        return
      }

      onOpen()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, onClose, onOpen])
}
