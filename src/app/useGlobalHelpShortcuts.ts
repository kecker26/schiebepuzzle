import { useEffect } from 'react'
import { isEditableTarget } from './keyboardShortcutUtils.ts'

interface UseGlobalHelpShortcutsOptions {
  isHelpOpen: boolean
  onOpenHelp: () => void
  onCloseHelp: () => void
}

function isQuestionMarkShortcut(event: KeyboardEvent): boolean {
  return event.key === '?' || (event.key === '/' && event.shiftKey)
}

function isCtrlSlashShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.code === 'Slash'
}

export function useGlobalHelpShortcuts({
  isHelpOpen,
  onOpenHelp,
  onCloseHelp,
}: UseGlobalHelpShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return

      const shouldToggleHelp = event.key === 'F1'
        || isCtrlSlashShortcut(event)
        || (!isEditableTarget(event.target) && isQuestionMarkShortcut(event))

      if (!shouldToggleHelp) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (isHelpOpen) {
        onCloseHelp()
        return
      }

      onOpenHelp()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isHelpOpen, onCloseHelp, onOpenHelp])
}
