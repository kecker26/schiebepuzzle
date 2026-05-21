import { AnimatePresence, motion } from 'motion/react'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  CircleHelp,
  Command,
  Home,
  Moon,
  Music2,
  Palette,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
  COMMAND_PALETTE_SHORTCUT_ACCESSIBLE_LABEL,
  COMMAND_PALETTE_SHORTCUT_LABEL,
} from '../app/commandPaletteShortcut.ts'
import MusicStylePicker from './MusicStylePicker.tsx'
import MusicVolumeControl from './MusicVolumeControl.tsx'
import { getPanelVariants } from '../motion/variants.ts'
import { addUiLayer, isTopUiLayer, removeUiLayer } from '../motion/uiLayerStack.ts'
import { useTheme } from '../contexts/ThemeContext'
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference.ts'
import audioService from '../services/AudioService.ts'
import { getMusicStyleDefinition } from '../services/musicStyles.ts'
import '../styles/components/theme-switcher.css'

export interface ThemeSwitcherSaveStatus {
  kind: 'saved' | 'saving' | 'pending' | 'error' | 'active'
  label: string
  detail: string
}

interface ThemeSwitcherProps {
  layout?: 'floating' | 'welcome'
  onGoToStartScreen?: () => void
  onOpenCommandPalette?: () => void
  onOpenHelp?: () => void
  saveStatus?: ThemeSwitcherSaveStatus | null
}

type ThemeSwitcherPopover = 'music' | 'style' | null
type ThemeSwitcherPopoverKind = Exclude<ThemeSwitcherPopover, null>
type PopoverFocusPlacement = 'first' | 'last' | 'selected'

const THEME_SWITCHER_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isVisibleFocusableElement(element: HTMLElement): boolean {
  if (element.matches('[disabled], [aria-hidden="true"], [inert]')) {
    return false
  }

  if (element.tabIndex < 0) {
    return false
  }

  return element.getClientRects().length > 0
}

function useMusicMuted(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return audioService.subscribeToMusicMuted(onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => audioService.getMusicMuted(), [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

function useSelectedMusicStyle() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return audioService.subscribeToSelectedMusicStyle(onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => audioService.getSelectedMusicStyle(), [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

export default function ThemeSwitcher({
  layout = 'floating',
  onGoToStartScreen,
  onOpenCommandPalette,
  onOpenHelp,
  saveStatus = null,
}: ThemeSwitcherProps) {
  const { emotionThemeEnabled, imagePalette, mode, toggleEmotionTheme, toggleMode } = useTheme()
  const isMusicMuted = useMusicMuted()
  const selectedMusicStyle = useSelectedMusicStyle()
  const [activePopover, setActivePopover] = useState<ThemeSwitcherPopover>(null)
  const switcherRef = useRef<HTMLDivElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const musicTriggerRef = useRef<HTMLButtonElement | null>(null)
  const styleTriggerRef = useRef<HTMLButtonElement | null>(null)
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const pendingRestoreFocusRef = useRef<HTMLElement | null>(null)
  const popoverFocusPlacementRef = useRef<PopoverFocusPlacement>('selected')
  const layerIdRef = useRef(Symbol('theme-switcher-popover'))
  const selectedMusicStyleDefinition = getMusicStyleDefinition(selectedMusicStyle)
  const moodLabel = imagePalette?.moodLabel ?? 'Standard'
  const moodSourceLabel = imagePalette?.source === 'local-color' ? 'lokale Analyse' : 'Fallback'
  const shouldReduceMotion = useReducedMotionPreference()
  const isMusicPopoverOpen = activePopover === 'music'
  const isStylePickerOpen = activePopover === 'style'
  const musicPopoverId = useId()
  const musicPopoverTitleId = useId()
  const stylePopoverId = useId()
  const stylePopoverTitleId = useId()

  const handleToggleMusic = useCallback(() => {
    audioService.setMusicMuted(!isMusicMuted)
  }, [isMusicMuted])

  const handleOpenHelp = useCallback(() => {
    pendingRestoreFocusRef.current = null
    setActivePopover(null)
    onOpenHelp?.()
  }, [onOpenHelp])

  const handleOpenCommandPalette = useCallback(() => {
    pendingRestoreFocusRef.current = null
    setActivePopover(null)
    onOpenCommandPalette?.()
  }, [onOpenCommandPalette])

  const getTriggerElement = useCallback((popover: ThemeSwitcherPopoverKind) => {
    return popover === 'music' ? musicTriggerRef.current : styleTriggerRef.current
  }, [])

  const getToolbarButtons = useCallback(() => {
    if (!switcherRef.current) {
      return []
    }

    return Array.from(
      switcherRef.current.querySelectorAll<HTMLButtonElement>('.theme-switcher-controls .theme-toggle-btn:not([disabled])')
    ).filter(isVisibleFocusableElement)
  }, [])

  const getPopoverFocusableElements = useCallback(() => {
    if (!popoverRef.current) {
      return []
    }

    return Array.from(popoverRef.current.querySelectorAll<HTMLElement>(THEME_SWITCHER_FOCUSABLE_SELECTOR))
      .filter(isVisibleFocusableElement)
  }, [])

  const focusToolbarButton = useCallback((target: HTMLButtonElement | null) => {
    target?.focus({ preventScroll: true })
  }, [])

  const moveToolbarFocus = useCallback((direction: 1 | -1) => {
    const toolbarButtons = getToolbarButtons()
    if (toolbarButtons.length === 0) {
      return
    }

    const activeElement = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null
    const currentIndex = activeElement ? toolbarButtons.indexOf(activeElement) : -1
    const startIndex = currentIndex >= 0 ? currentIndex : 0
    const nextIndex = (startIndex + direction + toolbarButtons.length) % toolbarButtons.length
    focusToolbarButton(toolbarButtons[nextIndex] ?? null)
  }, [focusToolbarButton, getToolbarButtons])

  const focusPopoverByPlacement = useCallback((placement: PopoverFocusPlacement) => {
    const popoverElement = popoverRef.current
    if (!popoverElement) {
      return
    }

    const focusableElements = getPopoverFocusableElements()
    if (focusableElements.length === 0) {
      popoverElement.focus({ preventScroll: true })
      return
    }

    const selectedStyleButton = popoverElement.querySelector<HTMLElement>('.music-style-picker-button[aria-pressed="true"]')
    const firstMusicControl = popoverElement.querySelector<HTMLElement>('.theme-switcher-settings-toggle')
      ?? popoverElement.querySelector<HTMLElement>('.music-volume-control-input')

    let target: HTMLElement | null = null
    if (placement === 'last') {
      target = focusableElements[focusableElements.length - 1] ?? null
    } else if (placement === 'selected') {
      target = selectedStyleButton ?? firstMusicControl ?? focusableElements[0] ?? null
    } else {
      target = firstMusicControl ?? selectedStyleButton ?? focusableElements[0] ?? null
    }

    target?.focus({ preventScroll: true })
  }, [getPopoverFocusableElements])

  const openPopover = useCallback((popover: ThemeSwitcherPopoverKind, placement?: PopoverFocusPlacement) => {
    const nextPlacement = placement ?? (popover === 'style' ? 'selected' : 'first')
    popoverFocusPlacementRef.current = nextPlacement
    pendingRestoreFocusRef.current = null

    if (activePopover === popover) {
      window.requestAnimationFrame(() => {
        focusPopoverByPlacement(nextPlacement)
      })
      return
    }

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setActivePopover(popover)
  }, [activePopover, focusPopoverByPlacement])

  const isTargetWithinPopoverLayer = useCallback((target: Node) => {
    const activeTrigger = activePopover ? getTriggerElement(activePopover) : null
    return Boolean(popoverRef.current?.contains(target) || activeTrigger?.contains(target))
  }, [activePopover, getTriggerElement])

  const requestClosePopover = useCallback((options: { restoreFocus?: boolean, focusTarget?: HTMLElement | null } = {}) => {
    if (!activePopover) {
      pendingRestoreFocusRef.current = null
      return
    }

    pendingRestoreFocusRef.current = options.restoreFocus
      ? options.focusTarget ?? getTriggerElement(activePopover) ?? previouslyFocusedElementRef.current
      : null
    setActivePopover(null)
  }, [activePopover, getTriggerElement])

  const togglePopover = useCallback((popover: ThemeSwitcherPopoverKind) => {
    setActivePopover((previous) => {
      if (previous === popover) {
        pendingRestoreFocusRef.current = null
        return null
      }

      previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      pendingRestoreFocusRef.current = null
      popoverFocusPlacementRef.current = popover === 'style' ? 'selected' : 'first'
      return popover
    })
  }, [])

  useLayoutEffect(() => {
    if (!activePopover) {
      return
    }

    const layerId = layerIdRef.current
    addUiLayer(layerId, popoverRef.current)
    return () => {
      removeUiLayer(layerId)
    }
  }, [activePopover])

  useLayoutEffect(() => {
    if (activePopover) {
      return
    }

    const restoreTarget = pendingRestoreFocusRef.current
    pendingRestoreFocusRef.current = null

    if (restoreTarget?.isConnected) {
      restoreTarget.focus({ preventScroll: true })
      return
    }

    const previousElement = previouslyFocusedElementRef.current
    if (previousElement?.isConnected && switcherRef.current?.contains(previousElement)) {
      previousElement.focus({ preventScroll: true })
    }
  }, [activePopover])

  useLayoutEffect(() => {
    if (!activePopover) {
      return
    }

    const animationFrame = window.requestAnimationFrame(() => {
      focusPopoverByPlacement(popoverFocusPlacementRef.current)
      popoverFocusPlacementRef.current = activePopover === 'style' ? 'selected' : 'first'
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [activePopover, focusPopoverByPlacement])

  const handleToolbarKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const target = event.target
    if (!(target instanceof HTMLButtonElement) || !target.classList.contains('theme-toggle-btn')) {
      return
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        moveToolbarFocus(-1)
        return
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        moveToolbarFocus(1)
        return
      case 'Home': {
        const toolbarButtons = getToolbarButtons()
        if (toolbarButtons.length === 0) {
          return
        }

        event.preventDefault()
        focusToolbarButton(toolbarButtons[0] ?? null)
        return
      }
      case 'End': {
        const toolbarButtons = getToolbarButtons()
        if (toolbarButtons.length === 0) {
          return
        }

        event.preventDefault()
        focusToolbarButton(toolbarButtons[toolbarButtons.length - 1] ?? null)
        return
      }
      case 'PageDown':
        if (target === musicTriggerRef.current) {
          event.preventDefault()
          openPopover('music', 'first')
          return
        }

        if (target === styleTriggerRef.current) {
          event.preventDefault()
          openPopover('style', 'selected')
        }
        return
      case 'PageUp':
        if (target === musicTriggerRef.current) {
          event.preventDefault()
          openPopover('music', 'last')
          return
        }

        if (target === styleTriggerRef.current) {
          event.preventDefault()
          openPopover('style', 'last')
        }
        return
    }
  }, [focusToolbarButton, getToolbarButtons, moveToolbarFocus, openPopover])

  useEffect(() => {
    if (!activePopover) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!isTopUiLayer(layerIdRef.current)) {
        return
      }

      const target = event.target
      if (!(target instanceof Node) || isTargetWithinPopoverLayer(target)) {
        return
      }

      requestClosePopover()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      if (!isTopUiLayer(layerIdRef.current)) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        requestClosePopover({ restoreFocus: true })
        return
      }

      const popoverElement = popoverRef.current
      if (!popoverElement) {
        return
      }

      const focusableElements = getPopoverFocusableElements()
      if (event.key === 'Tab') {
        if (focusableElements.length === 0) {
          event.preventDefault()
          popoverElement.focus({ preventScroll: true })
          return
        }

        const firstFocusableElement = focusableElements[0]
        const lastFocusableElement = focusableElements[focusableElements.length - 1]
        const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const isFocusInsidePopover = activeElement ? popoverElement.contains(activeElement) : false

        if (event.shiftKey) {
          if (!isFocusInsidePopover || activeElement === firstFocusableElement || activeElement === popoverElement) {
            event.preventDefault()
            lastFocusableElement.focus({ preventScroll: true })
          }
          return
        }

        if (!isFocusInsidePopover || activeElement === lastFocusableElement) {
          event.preventDefault()
          firstFocusableElement.focus({ preventScroll: true })
        }
        return
      }

      const target = event.target
      if (target instanceof HTMLInputElement && target.type === 'range') {
        return
      }

      if (focusableElements.length === 0) {
        return
      }

      const currentIndex = focusableElements.findIndex((element) => element === document.activeElement)
      const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0
      const moveFocus = (nextIndex: number) => {
        focusableElements[nextIndex]?.focus({ preventScroll: true })
      }

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          event.stopPropagation()
          moveFocus((safeCurrentIndex + 1) % focusableElements.length)
          return
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          event.stopPropagation()
          moveFocus((safeCurrentIndex - 1 + focusableElements.length) % focusableElements.length)
          return
        case 'Home':
          event.preventDefault()
          event.stopPropagation()
          moveFocus(0)
          return
        case 'End':
          event.preventDefault()
          event.stopPropagation()
          moveFocus(focusableElements.length - 1)
          return
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (!isTopUiLayer(layerIdRef.current)) {
        return
      }

      const target = event.target
      if (!(target instanceof Node) || isTargetWithinPopoverLayer(target)) {
        return
      }

      requestClosePopover()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('focusin', handleFocusIn, true)
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('focusin', handleFocusIn, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [activePopover, getPopoverFocusableElements, isTargetWithinPopoverLayer, requestClosePopover])

  useEffect(() => {
    if (onGoToStartScreen) {
      return
    }

    pendingRestoreFocusRef.current = null
    setActivePopover(null)
  }, [onGoToStartScreen])

  const pickerVariant = 'popover'
  const hasPrimaryControls = Boolean(onGoToStartScreen || onOpenCommandPalette || onOpenHelp)
  const switcherClassName = [
    'theme-switcher',
    `theme-switcher--${layout}`,
    activePopover ? 'has-open-popover' : '',
  ].filter(Boolean).join(' ')

  const switcher = (
    <div className={switcherClassName} ref={switcherRef}>
      <div className="theme-switcher-shell">
        <div className="theme-switcher-rail-head">
          <span className="theme-switcher-rail-mark" aria-hidden="true">SP</span>
          <span className="theme-switcher-rail-title">Menue</span>
        </div>

        <div
          className="theme-switcher-controls"
          role="toolbar"
          aria-label="App-Navigation, Hilfe, Musik und Darstellung"
          onKeyDown={handleToolbarKeyDown}
        >
          {hasPrimaryControls && (
            <div className="theme-switcher-control-group" aria-label="Navigation und Hilfe">
            {onGoToStartScreen && (
              <button
                type="button"
                className="theme-toggle-btn theme-toggle-btn-style theme-toggle-btn-home"
                onClick={() => {
                  setActivePopover(null)
                  onGoToStartScreen()
                }}
                title="Zur Startseite wechseln"
                aria-label="Zur Startseite wechseln"
              >
                <Home className="theme-toggle-icon" />
                <span className="theme-toggle-btn-label">Start</span>
              </button>
            )}
            {onOpenCommandPalette && (
              <button
                type="button"
                className="theme-toggle-btn theme-toggle-btn-style"
                onClick={handleOpenCommandPalette}
                title={`Command Palette oeffnen (${COMMAND_PALETTE_SHORTCUT_LABEL})`}
                aria-label="Command Palette oeffnen"
                aria-keyshortcuts={COMMAND_PALETTE_SHORTCUT_ACCESSIBLE_LABEL}
              >
                <Command className="theme-toggle-icon" />
                <span className="theme-toggle-btn-label">Palette</span>
                <span className="theme-toggle-btn-shortcut theme-toggle-btn-shortcut--inline" aria-hidden="true">{COMMAND_PALETTE_SHORTCUT_LABEL}</span>
              </button>
            )}
            {onOpenHelp && (
              <button
                type="button"
                className="theme-toggle-btn theme-toggle-btn-style"
                onClick={handleOpenHelp}
                title="Hilfe und Tastaturbefehle anzeigen (F1 oder ?)"
                aria-label="Hilfe und Tastaturbefehle anzeigen"
                aria-keyshortcuts="F1"
              >
                <CircleHelp className="theme-toggle-icon" />
                <span className="theme-toggle-btn-label">Hilfe</span>
                <span className="theme-toggle-btn-shortcut theme-toggle-btn-shortcut--inline" aria-hidden="true">F1</span>
              </button>
            )}
            </div>
          )}

          <div className="theme-switcher-control-group" aria-label="Musik und Darstellung">
          {saveStatus && (
            <div className="theme-switcher-save-status-wrap">
              <div
                className={`theme-switcher-save-status theme-switcher-save-status--${saveStatus.kind}`}
                role={saveStatus.kind === 'error' ? 'alert' : 'status'}
                aria-live={saveStatus.kind === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
                title={`${saveStatus.label}: ${saveStatus.detail}`}
              >
                <span className="theme-switcher-save-status-indicator" aria-hidden="true" />
                <span className="theme-switcher-save-status-copy">
                  <span className="theme-switcher-save-status-label">{saveStatus.label}</span>
                  <span className="theme-switcher-save-status-detail">{saveStatus.detail}</span>
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            className={`theme-toggle-btn${isMusicPopoverOpen ? ' is-active' : ''}`}
            ref={musicTriggerRef}
            onClick={() => togglePopover('music')}
            title={isMusicMuted ? 'Musik einschalten oder anpassen' : 'Musik ausschalten oder anpassen'}
            aria-label={isMusicMuted ? 'Musikeinstellungen oeffnen. Musik ist ausgeschaltet.' : 'Musikeinstellungen oeffnen. Musik ist eingeschaltet.'}
            aria-expanded={isMusicPopoverOpen}
            aria-haspopup="dialog"
            aria-controls={musicPopoverId}
          >
            {isMusicMuted ? <VolumeX className="theme-toggle-icon" /> : <Volume2 className="theme-toggle-icon" />}
            <span className="theme-toggle-btn-label">Musik</span>
            <span className="theme-toggle-btn-shortcut" aria-hidden="true">PgDn</span>
          </button>
          <button
            type="button"
            className={`theme-toggle-btn theme-toggle-btn-style${isStylePickerOpen ? ' is-active' : ''}`}
            ref={styleTriggerRef}
            onClick={() => togglePopover('style')}
            title={`Musikstil waehlen (${selectedMusicStyleDefinition.label})`}
            aria-label={`Musikstil waehlen. Aktuell: ${selectedMusicStyleDefinition.label}`}
            aria-expanded={isStylePickerOpen}
            aria-haspopup="dialog"
            aria-controls={stylePopoverId}
          >
            <Music2 className="theme-toggle-icon" />
            <span className="theme-toggle-btn-label">{selectedMusicStyleDefinition.shortLabel}</span>
            <span className="theme-toggle-btn-shortcut" aria-hidden="true">PgDn</span>
          </button>
          <button
            type="button"
            className={`theme-toggle-btn theme-toggle-btn-style theme-toggle-btn-emotion${emotionThemeEnabled ? ' is-active' : ''}`}
            onClick={toggleEmotionTheme}
            title={emotionThemeEnabled
              ? `Emotion-Theme deaktivieren. Aktuell: ${moodLabel} (${moodSourceLabel}).`
              : 'Emotion-Theme aktivieren'}
            aria-label={emotionThemeEnabled
              ? `Emotion-Theme deaktivieren. Aktuelle Bildstimmung: ${moodLabel}. Quelle: ${moodSourceLabel}.`
              : 'Emotion-Theme aktivieren. Standard-Farbgebung ist aktiv.'}
            aria-pressed={emotionThemeEnabled}
          >
            <Palette className="theme-toggle-icon" />
            <span className="theme-toggle-btn-label">{emotionThemeEnabled ? moodLabel : 'Standard'}</span>
          </button>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleMode}
            title={mode === 'light' ? 'Dunkelmodus aktivieren' : 'Hellmodus aktivieren'}
            aria-label={mode === 'light' ? 'Dunkelmodus aktivieren' : 'Hellmodus aktivieren'}
          >
            {mode === 'light' ? <Moon className="theme-toggle-icon" /> : <Sun className="theme-toggle-icon" />}
            <span className="theme-toggle-btn-label">{mode === 'light' ? 'Dunkel' : 'Hell'}</span>
          </button>
          </div>
        </div>
      </div>

        <AnimatePresence initial={false}>
          {activePopover && (
            <motion.div
              ref={popoverRef}
              id={isMusicPopoverOpen ? musicPopoverId : stylePopoverId}
              className={
                `theme-switcher-popover theme-switcher-popover--${activePopover}`
                + (layout === 'welcome' ? ' theme-switcher-popover--welcome' : '')
              }
              role="dialog"
              aria-labelledby={isMusicPopoverOpen ? musicPopoverTitleId : stylePopoverTitleId}
              tabIndex={-1}
              variants={getPanelVariants(shouldReduceMotion)}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="theme-switcher-popover-head">
                <span className="theme-switcher-popover-kicker">{isMusicPopoverOpen ? 'Wiedergabe' : 'Musik'}</span>
                <p
                  id={isMusicPopoverOpen ? musicPopoverTitleId : stylePopoverTitleId}
                  className="theme-switcher-popover-title"
                >
                  {isMusicPopoverOpen ? 'Musik einstellen' : 'Musikstil waehlen'}
                </p>
              </div>
              {isMusicPopoverOpen && (
                <div className="theme-switcher-settings">
                  <div className="theme-switcher-settings-row">
                    <div className="theme-switcher-settings-copy">
                      <span className="theme-switcher-settings-label">Wiedergabe</span>
                      <p>Schalte die Musik ein oder aus und passe danach die Lautstaerke an.</p>
                    </div>
                    <button
                      type="button"
                      className={`theme-switcher-settings-toggle${isMusicMuted ? '' : ' is-active'}`}
                      onClick={handleToggleMusic}
                    >
                      <span aria-hidden="true">{isMusicMuted ? '\u{1F507}' : '\u{1F50A}'}</span>
                      <span>{isMusicMuted ? 'Aus' : 'An'}</span>
                    </button>
                  </div>
                  <MusicVolumeControl variant={pickerVariant} />
                </div>
              )}
              {isStylePickerOpen && (
                <MusicStylePicker
                  variant={pickerVariant}
                  onSelect={() => {
                    requestClosePopover({ restoreFocus: true })
                  }}
                />
              )}
              <div className="theme-switcher-popover-shortcuts" aria-hidden="true">
                <span className="theme-switcher-popover-shortcut">
                  <span className="theme-switcher-popover-shortcut-key">Esc</span>
                  <span>Schliessen</span>
                </span>
                <span className="theme-switcher-popover-shortcut">
                  <span className="theme-switcher-popover-shortcut-key">Tab</span>
                  <span>Im Fenster</span>
                </span>
                <span className="theme-switcher-popover-shortcut">
                  <span className="theme-switcher-popover-shortcut-key">Pfeile</span>
                  <span>Wechseln</span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  )

  if (typeof document === 'undefined') {
    return switcher
  }

  return createPortal(switcher, document.body)
}
