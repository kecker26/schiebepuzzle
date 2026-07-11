import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { COMMAND_PALETTE_SHORTCUT_LABEL } from '../app/commandPaletteShortcut.ts'
import type { GlobalUiIconName } from './GlobalUiIcon.tsx'
import GlobalUiIcon from './GlobalUiIcon.tsx'
import AnimatedButton from '../motion/AnimatedButton.tsx'
import AnimatedWorkspaceWindow from '../motion/AnimatedWorkspaceWindow.tsx'
import '../styles/components/command-palette.css'

export interface CommandPaletteCommand {
  id: string
  title: string
  detail: string
  section: string
  icon: GlobalUiIconName
  shortcut?: string
  keywords?: string[]
  onSelect: () => void | Promise<void>
}

interface CommandPaletteProps {
  commands: CommandPaletteCommand[]
  contextLabel: string
  onClose: () => void
  paletteStyle?: CSSProperties
}

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export default function CommandPalette({ commands, contextLabel, onClose, paletteStyle }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const resultRefs = useRef(new Map<string, HTMLButtonElement>())
  const resultsContainerRef = useRef<HTMLDivElement>(null)
  const searchInputId = useId()
  const resultsListId = useId()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const filteredCommands = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query)
    if (!normalizedQuery) {
      return commands
    }

    return commands.filter((command) => {
      const searchParts = [
        command.title,
        command.detail,
        command.section,
        command.shortcut,
        ...(command.keywords ?? []),
      ]

      return normalizeSearchValue(searchParts.join(' ')).includes(normalizedQuery)
    })
  }, [commands, query])

  const groupedCommands = useMemo(() => {
    const groups = new Map<string, CommandPaletteCommand[]>()
    filteredCommands.forEach((command) => {
      const currentGroup = groups.get(command.section)
      if (currentGroup) {
        currentGroup.push(command)
        return
      }

      groups.set(command.section, [command])
    })

    return Array.from(groups.entries())
  }, [filteredCommands])

  const activeCommandId =
    filteredCommands.length > 0 && activeIndex >= 0 && activeIndex < filteredCommands.length
      ? `command-palette-option-${filteredCommands[activeIndex]?.id}`
      : undefined

  useEffect(() => {
    setActiveIndex(0)
  }, [query, commands])

  useEffect(() => {
    if (activeIndex < filteredCommands.length) {
      return
    }

    setActiveIndex(0)
  }, [activeIndex, filteredCommands.length])

  const setResultRef = useCallback((commandId: string, node: HTMLButtonElement | null) => {
    if (node) {
      resultRefs.current.set(commandId, node)
      return
    }

    resultRefs.current.delete(commandId)
  }, [])

  const focusCommandAtIndex = useCallback((index: number) => {
    const command = filteredCommands[index]
    if (!command) {
      return
    }

    setActiveIndex(index)
    const target = resultRefs.current.get(command.id)
    target?.focus({ preventScroll: true })
  }, [filteredCommands])

  const moveActiveIndex = useCallback((direction: 1 | -1) => {
    if (filteredCommands.length === 0) {
      return
    }

    const nextIndex = (activeIndex + direction + filteredCommands.length) % filteredCommands.length
    focusCommandAtIndex(nextIndex)
  }, [activeIndex, filteredCommands.length, focusCommandAtIndex])

  const selectCommandAtIndex = useCallback((index: number) => {
    const command = filteredCommands[index]
    if (!command) {
      return
    }

    onClose()
    void command.onSelect()
  }, [filteredCommands, onClose])

  useEffect(() => {
    const activeCommand = filteredCommands[activeIndex]
    if (!activeCommand) {
      return
    }

    const activeButton = resultRefs.current.get(activeCommand.id)
    const container = resultsContainerRef.current
    if (!activeButton || !container) {
      return
    }

    const containerRect = container.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()
    const scrollPadding = 8

    if (buttonRect.top < containerRect.top + scrollPadding) {
      container.scrollTo({
        top: container.scrollTop + (buttonRect.top - containerRect.top) - scrollPadding,
        behavior: 'smooth',
      })
    } else if (buttonRect.bottom > containerRect.bottom - scrollPadding) {
      container.scrollTo({
        top: container.scrollTop + (buttonRect.bottom - containerRect.bottom) + scrollPadding,
        behavior: 'smooth',
      })
    }
  }, [activeIndex, filteredCommands])

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusCommandAtIndex(activeIndex === 0 ? 0 : Math.min(activeIndex + 1, filteredCommands.length - 1))
        return
      case 'ArrowUp':
        event.preventDefault()
        focusCommandAtIndex(activeIndex <= 0 ? Math.max(filteredCommands.length - 1, 0) : activeIndex - 1)
        return
      case 'Home':
        event.preventDefault()
        focusCommandAtIndex(0)
        return
      case 'End':
        event.preventDefault()
        focusCommandAtIndex(Math.max(filteredCommands.length - 1, 0))
        return
      case 'Enter':
        if (filteredCommands.length === 0) {
          return
        }

        event.preventDefault()
        selectCommandAtIndex(activeIndex)
        return
    }
  }, [activeIndex, filteredCommands.length, focusCommandAtIndex, selectCommandAtIndex])

  const handleCommandKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveActiveIndex(1)
        return
      case 'ArrowUp':
        event.preventDefault()
        moveActiveIndex(-1)
        return
      case 'Home':
        event.preventDefault()
        focusCommandAtIndex(0)
        return
      case 'End':
        event.preventDefault()
        focusCommandAtIndex(Math.max(filteredCommands.length - 1, 0))
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        selectCommandAtIndex(index)
        return
    }
  }, [filteredCommands.length, focusCommandAtIndex, moveActiveIndex, selectCommandAtIndex])

  return (
    <AnimatedWorkspaceWindow
      overlayClassName="command-palette-overlay"
      shellClassName="command-palette-shell"
      titleId="command-palette-title"
      descriptionId="command-palette-description"
      onClose={onClose}
      closeOnOverlayClick
      closeOnEscape
      trapFocus
      restoreFocus
      lockScroll
      initialFocusRef={inputRef}
      overlayStyle={paletteStyle}
    >
      <div className="command-palette-view">
        <div className="command-palette-header">
          <div className="command-palette-heading">
            <span className="command-palette-kicker">Schnellaktionen</span>
            <h2 id="command-palette-title">Command Palette</h2>
            <p id="command-palette-description">
              Suche nach Ansichten, Hilfe, Musik und den wichtigsten Aktionen der App. Kontext: {contextLabel}.
            </p>
          </div>
          <div className="command-palette-header-actions">
            <span className="command-palette-context-badge">{contextLabel}</span>
            <AnimatedButton
              ref={closeButtonRef}
              type="button"
              className="secondary command-palette-close"
              onClick={onClose}
              data-app-tooltip="Command Palette schließen."
              data-app-tooltip-align="end"
              reveal
              revealLevel="subtle"
            >
              Schließen
            </AnimatedButton>
          </div>
        </div>

        <div
          className="command-palette-search"
          data-app-tooltip="Aktionen filtern. Enter führt den aktiven Treffer aus."
          data-app-tooltip-align="start"
        >
          <label className="visually-hidden" htmlFor={searchInputId}>
            Schnellaktionen durchsuchen
          </label>
          <input
            ref={inputRef}
            id={searchInputId}
            className="command-palette-search-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Suche nach Start, Statistik, Musikstil, Hilfe ..."
            value={query}
            data-page-primary-focus="true"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={filteredCommands.length > 0}
            aria-controls={resultsListId}
            aria-activedescendant={activeCommandId}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <span className="command-palette-search-hint" aria-hidden="true">
            {COMMAND_PALETTE_SHORTCUT_LABEL}
          </span>
        </div>

        <div
          ref={resultsContainerRef}
          id={resultsListId}
          className="command-palette-results"
          role="listbox"
          aria-label="Schnellaktionen"
        >
          {groupedCommands.length === 0 ? (
            <div className="command-palette-empty" role="status" aria-live="polite">
              <span className="command-palette-empty-title">Keine passende Aktion gefunden</span>
              <span className="command-palette-empty-copy">
                Versuche es mit Begriffen wie Hilfe, Spielstände, Statistik, Galerie oder Musik.
              </span>
            </div>
          ) : (
            groupedCommands.map(([section, sectionCommands]) => (
              <div
                key={section}
                className="command-palette-group"
                role="group"
                aria-labelledby={`command-palette-group-${section}`}
              >
                <div className="command-palette-group-head" id={`command-palette-group-${section}`}>
                  <span>{section}</span>
                  <span>{sectionCommands.length}</span>
                </div>
                <div className="command-palette-group-list">
                  {sectionCommands.map((command) => {
                    const commandIndex = filteredCommands.findIndex((entry) => entry.id === command.id)
                    const isActive = commandIndex === activeIndex

                    return (
                      <button
                        key={command.id}
                        ref={(node) => setResultRef(command.id, node)}
                        id={`command-palette-option-${command.id}`}
                        type="button"
                        className={`command-palette-item${isActive ? ' is-active' : ''}`}
                        role="option"
                        aria-selected={isActive}
                        tabIndex={isActive ? 0 : -1}
                        onFocus={() => setActiveIndex(commandIndex)}
                        onMouseEnter={() => setActiveIndex(commandIndex)}
                        onClick={() => {
                          onClose()
                          void command.onSelect()
                        }}
                        onKeyDown={(event) => handleCommandKeyDown(event, commandIndex)}
                        data-app-tooltip={command.detail}
                        data-app-tooltip-align="start"
                      >
                        <span className="command-palette-item-icon-shell" aria-hidden="true">
                          <GlobalUiIcon name={command.icon} className="command-palette-item-icon" />
                        </span>
                        <span className="command-palette-item-copy">
                          <span className="command-palette-item-title">{command.title}</span>
                          <span className="command-palette-item-detail">{command.detail}</span>
                        </span>
                        {command.shortcut ? (
                          <span className="command-palette-item-shortcut" aria-hidden="true">
                            {command.shortcut}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AnimatedWorkspaceWindow>
  )
}
