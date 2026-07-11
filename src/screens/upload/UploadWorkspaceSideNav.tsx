import { type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'
import UploadScreenIcon, { type UploadScreenIconName } from '../../components/UploadScreenIcon.tsx'
import { UploadWorkspaceWindow } from './uploadUtils.ts'

type WorkspacePage = Exclude<UploadWorkspaceWindow, 'start'>

interface WorkspaceNavItem {
  window: UploadWorkspaceWindow
  label: string
  iconName: UploadScreenIconName
  copy: string
  buttonRef?: RefObject<HTMLButtonElement>
  isReturn?: boolean
}

interface UploadWorkspaceSideNavProps {
  activeWindow: WorkspacePage
  savedGamesCount: number
  statsTotalSolved: number
  galleryCardCount: number
  collectionsCount: number
  startNavButtonRef: RefObject<HTMLButtonElement>
  savedGamesNavButtonRef: RefObject<HTMLButtonElement>
  statsNavButtonRef: RefObject<HTMLButtonElement>
  collectionsNavButtonRef: RefObject<HTMLButtonElement>
  galleryNavButtonRef: RefObject<HTMLButtonElement>
  focusShortcutLabel: string
  onWindowChange: (window: UploadWorkspaceWindow) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
}

export default function UploadWorkspaceSideNav({
  activeWindow,
  savedGamesCount,
  statsTotalSolved,
  galleryCardCount,
  collectionsCount,
  startNavButtonRef,
  savedGamesNavButtonRef,
  statsNavButtonRef,
  collectionsNavButtonRef,
  galleryNavButtonRef,
  focusShortcutLabel,
  onWindowChange,
  onKeyDown,
}: UploadWorkspaceSideNavProps) {
  const items: WorkspaceNavItem[] = [
    {
      window: 'start',
      label: 'Auswahl',
      iconName: 'home',
      copy: 'Zur Auswahlseite',
      buttonRef: startNavButtonRef,
      isReturn: true,
    },
    {
      window: 'savedGames',
      label: 'Spielstände',
      iconName: 'folder',
      copy: `${savedGamesCount} Partien`,
      buttonRef: savedGamesNavButtonRef,
    },
    {
      window: 'stats',
      label: 'Statistik',
      iconName: 'barChart2',
      copy: `${statsTotalSolved} Siege`,
      buttonRef: statsNavButtonRef,
    },
    {
      window: 'gallery',
      label: 'Galerie',
      iconName: 'gallery',
      copy: `${galleryCardCount} Motive`,
      buttonRef: galleryNavButtonRef,
    },
    {
      window: 'collections',
      label: 'Sammlungen',
      iconName: 'folderHeart',
      copy: `${collectionsCount} ${collectionsCount === 1 ? 'Sammlung' : 'Sammlungen'}`,
      buttonRef: collectionsNavButtonRef,
    },
  ]

  return (
    <AnimatedStaggerGroup
      className="workspace-window-nav workspace-window-side-nav"
      as="nav"
      aria-label="Bereiche wechseln"
      aria-keyshortcuts={focusShortcutLabel}
      level="subtle"
      onKeyDown={onKeyDown}
    >
      <div className="workspace-window-side-nav-header">
        <span className="saved-games-kicker">Navigation</span>
        <span
          className="workspace-window-side-nav-shortcut"
          aria-label={`Shortcut ${focusShortcutLabel}`}
          data-app-tooltip="Fokus auf die Workspace-Navigation setzen."
          data-app-tooltip-align="start"
        >
          {focusShortcutLabel}
        </span>
      </div>

      {items.map((item) => (
        <AnimatedButton
          key={item.window}
          ref={item.buttonRef}
          className={`workspace-window-nav-button${activeWindow === item.window ? ' is-active' : ''}${item.isReturn ? ' is-return' : ''}`}
          interaction="surface"
          data-workspace-window-nav={item.window}
          aria-current={activeWindow === item.window ? 'page' : undefined}
          onClick={() => onWindowChange(item.window)}
          data-app-tooltip={item.isReturn ? 'Zum Auswahl-Dashboard zurückkehren.' : `${item.label} öffnen: ${item.copy}.`}
          data-app-tooltip-position="right"
          reveal
          revealLevel="subtle"
        >
          <span className="workspace-window-nav-head">
            <UploadScreenIcon name={item.iconName} className="workspace-window-nav-icon" />
            <span className="workspace-window-nav-label">{item.label}</span>
          </span>
          <span className="workspace-window-nav-copy">{item.copy}</span>
        </AnimatedButton>
      ))}
    </AnimatedStaggerGroup>
  )
}
