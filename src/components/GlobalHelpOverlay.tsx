import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ALL_HELP_CONTEXTS, getHelpView, type HelpContext, type HelpSection } from '../app/helpRegistry.ts'
import { useAccessibilityAnnouncer } from '../app/accessibilityAnnouncer.tsx'
import GlobalUiIcon from './GlobalUiIcon.tsx'
import AnimatedButton from '../motion/AnimatedButton.tsx'
import AnimatedReveal from '../motion/AnimatedReveal.tsx'
import AnimatedStaggerGroup from '../motion/AnimatedStaggerGroup.tsx'
import AnimatedWorkspaceWindow from '../motion/AnimatedWorkspaceWindow.tsx'
import '../styles/components/global-help-overlay.css'

interface GlobalHelpOverlayProps {
  helpContext: HelpContext
  onClose: () => void
  paletteStyle?: CSSProperties
}

function toHelpSectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function matchesSearch(section: HelpSection, query: string): HelpSection | null {
  if (!query) return section

  const lowerQuery = query.toLowerCase()
  const matchingItems = section.items.filter(
    (item) =>
      item.label.toLowerCase().includes(lowerQuery)
      || item.detail?.toLowerCase().includes(lowerQuery)
      || item.keys?.some((key) => key.toLowerCase().includes(lowerQuery))
  )

  if (matchingItems.length === 0) {
    if (section.title.toLowerCase().includes(lowerQuery)) {
      return section
    }
    return null
  }

  return { ...section, items: matchingItems }
}

export default function GlobalHelpOverlay({ helpContext, onClose, paletteStyle }: GlobalHelpOverlayProps) {
  const announceAccessibility = useAccessibilityAnnouncer()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const scrollRegionRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeContext, setActiveContext] = useState<HelpContext>(helpContext)

  const helpView = useMemo(() => getHelpView(activeContext), [activeContext])

  const contextOptions = useMemo(
    () =>
      ALL_HELP_CONTEXTS.map((ctx) => {
        const view = getHelpView(ctx)
        return { value: ctx, label: `${view.kicker}: ${view.title}` }
      }),
    []
  )

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return helpView.sections
    return helpView.sections
      .map((section) => matchesSearch(section, searchQuery.trim()))
      .filter((section): section is HelpSection => section !== null)
  }, [helpView.sections, searchQuery])

  const contextSections = useMemo(
    () => filteredSections.filter((section) => !section.isGlobal),
    [filteredSections]
  )

  const globalSections = useMemo(
    () => filteredSections.filter((section) => section.isGlobal),
    [filteredSections]
  )

  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())

  const handleSectionRef = useCallback((title: string, element: HTMLElement | null) => {
    if (element) {
      sectionRefs.current.set(title, element)
    } else {
      sectionRefs.current.delete(title)
    }
  }, [])

  const scrollToSection = useCallback((title: string) => {
    const element = sectionRefs.current.get(title)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const handleContextChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextContext = event.target.value as HelpContext
    const nextView = getHelpView(nextContext)
    setActiveContext(nextContext)
    setSearchQuery('')
    announceAccessibility(`Hilfekontext gewechselt: ${nextView.kicker}. ${nextView.title}.`)
    const scrollRegion = scrollRegionRef.current
    if (scrollRegion) {
      scrollRegion.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [announceAccessibility])

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
  }, [])

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && searchQuery) {
      event.preventDefault()
      event.stopPropagation()
      setSearchQuery('')
    }
  }, [searchQuery])

  const handleScrollRegionKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const scrollRegion = scrollRegionRef.current
    if (!scrollRegion) {
      return
    }

    const lineStep = 72
    const pageStep = Math.max(160, Math.round(scrollRegion.clientHeight * 0.85))
    let nextScrollTop: number | null = null

    switch (event.key) {
      case 'ArrowDown':
        nextScrollTop = scrollRegion.scrollTop + lineStep
        break
      case 'ArrowUp':
        nextScrollTop = scrollRegion.scrollTop - lineStep
        break
      case 'PageDown':
        nextScrollTop = scrollRegion.scrollTop + pageStep
        break
      case 'PageUp':
        nextScrollTop = scrollRegion.scrollTop - pageStep
        break
      case 'Home':
        nextScrollTop = 0
        break
      case 'End':
        nextScrollTop = scrollRegion.scrollHeight
        break
      case ' ':
      case 'Spacebar':
        nextScrollTop = scrollRegion.scrollTop + (event.shiftKey ? -pageStep : pageStep)
        break
      default:
        return
    }

    event.preventDefault()
    scrollRegion.scrollTo({
      top: Math.max(0, nextScrollTop),
      behavior: 'smooth',
    })
  }, [])

  const showToc = contextSections.length >= 3 && !searchQuery

  return (
    <AnimatedWorkspaceWindow
      overlayClassName="global-help-overlay"
      shellClassName="global-help-shell"
      titleId="global-help-title"
      descriptionId="global-help-description"
      onClose={onClose}
      closeOnOverlayClick
      closeOnEscape
      trapFocus
      restoreFocus
      lockScroll
      initialFocusRef={closeButtonRef}
      overlayStyle={paletteStyle}
    >
      <div className="global-help-view">
        <p id="global-help-search-hint" className="visually-hidden">
          Gib hier Shortcuts, Funktionen oder Bereichsnamen ein, um die Hilfe zu filtern.
        </p>
        <p id="global-help-context-hint" className="visually-hidden">
          Wechselt die Hilfe zwischen Auswahl, Spielstaenden, Statistik, Galerie, Crop und Puzzle.
        </p>
        <p id="global-help-scroll-hint" className="visually-hidden">
          Mit Pfeiltasten, Bild hoch, Bild runter, Pos1, Ende und Leertaste kannst du den Hilfeinhalt scrollen.
        </p>
        <div className="global-help-toolbar">
          <div
            className="global-help-search-shell"
            data-app-tooltip="Hilfeeintraege nach Shortcut, Bereich oder Funktion filtern."
            data-app-tooltip-align="start"
          >
            <GlobalUiIcon name="helpCircle" className="global-help-search-icon" />
            <input
              ref={searchInputRef}
              type="search"
              className="global-help-search"
              placeholder="Shortcut oder Funktion suchen ..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              aria-label="Shortcuts und Funktionen durchsuchen"
              aria-describedby="global-help-search-hint"
            />
          </div>
          <select
            className="global-help-context-select"
            value={activeContext}
            onChange={handleContextChange}
            aria-label="Hilfekontext wechseln"
            aria-describedby="global-help-context-hint"
            data-app-tooltip="Hilfethema manuell wechseln."
            data-app-tooltip-align="end"
          >
            {contextOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div
          ref={scrollRegionRef}
          className="global-help-view-inner"
          tabIndex={0}
          role="region"
          aria-labelledby="global-help-title"
          aria-describedby="global-help-description global-help-scroll-hint"
          aria-label="Hilfeinhalt scrollen"
          onKeyDown={handleScrollRegionKeyDown}
        >
          <AnimatedStaggerGroup className="global-help-view-content" level="medium">
            <AnimatedReveal className="global-help-header" level="medium">
              <div className="global-help-heading">
                <span className="global-help-kicker">Hilfe</span>
                <h2 id="global-help-title">Shortcuts und Bedienung</h2>
                <p id="global-help-description">
                  {helpView.kicker}: {helpView.title}. {helpView.description}
                </p>
              </div>
              <div className="global-help-header-actions">
                <span className="global-help-context-badge">{helpView.kicker}</span>
                <AnimatedButton
                  ref={closeButtonRef}
                  className="secondary global-help-close"
                  data-page-primary-focus="true"
                  onClick={onClose}
                  data-app-tooltip="Hilfe schliessen."
                  data-app-tooltip-align="end"
                  reveal
                  revealLevel="subtle"
                >
                  Schliessen
                </AnimatedButton>
              </div>
            </AnimatedReveal>

            {showToc && (
              <nav className="global-help-toc" aria-label="Inhaltsverzeichnis">
                <span className="global-help-toc-label">Direkt zu:</span>
                <div className="global-help-toc-links">
                  {contextSections.map((section) => (
                    <button
                      key={section.title}
                      type="button"
                      className="global-help-toc-link"
                      onClick={() => scrollToSection(section.title)}
                      aria-label={`${section.title} im Hilfeinhalt anzeigen`}
                      data-app-tooltip={`${section.title} im Hilfeinhalt anzeigen.`}
                      data-app-tooltip-position="top"
                    >
                      <GlobalUiIcon name={section.icon} className="global-help-toc-icon" />
                      {section.title}
                    </button>
                  ))}
                </div>
              </nav>
            )}

            {filteredSections.length === 0 && searchQuery && (
              <div className="global-help-empty">
                <p>Keine Treffer fuer <strong>„{searchQuery}"</strong>.</p>
                <p>Versuche einen anderen Suchbegriff oder loesche das Suchfeld.</p>
              </div>
            )}

            {contextSections.length > 0 && (
              <div className="global-help-sections">
                {contextSections.map((section) => (
                  <AnimatedReveal
                    key={section.title}
                    className="global-help-section"
                    interaction="surface"
                    level="medium"
                  >
                    <section aria-labelledby={`${toHelpSectionId(section.title)}-title`}>
                      <div
                        className="global-help-section-head"
                        ref={(el) => handleSectionRef(section.title, el)}
                      >
                        <span className="global-help-section-icon-shell" aria-hidden="true">
                          <GlobalUiIcon name={section.icon} className="global-help-section-icon" />
                        </span>
                        <h3 id={`${toHelpSectionId(section.title)}-title`} className="global-help-section-title">
                          {section.title}
                        </h3>
                      </div>
                      <ul className="global-help-list">
                        {section.items.map((item) => (
                          <li key={`${section.title}-${item.label}`} className="global-help-row">
                            <div className="global-help-row-keys" aria-hidden={item.keys ? undefined : 'true'}>
                              {item.keys?.length
                                ? item.keys.map((key) => (
                                    <kbd key={key} className="global-help-key">
                                      {key}
                                    </kbd>
                                  ))
                                : <span className="global-help-bullet" />}
                            </div>
                            <div className="global-help-row-copy">
                              <strong>{item.label}</strong>
                              {item.detail ? <span>{item.detail}</span> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </AnimatedReveal>
                ))}
              </div>
            )}

            {globalSections.length > 0 && contextSections.length > 0 && (
              <div className="global-help-divider" role="separator">
                <span className="global-help-divider-line" />
                <span className="global-help-divider-label">Gilt ueberall</span>
                <span className="global-help-divider-line" />
              </div>
            )}

            {globalSections.length > 0 && (
              <div className="global-help-sections global-help-sections--global">
                {globalSections.map((section) => (
                  <AnimatedReveal
                    key={section.title}
                    className="global-help-section global-help-section--global"
                    interaction="surface"
                    level="medium"
                  >
                    <section aria-labelledby={`${toHelpSectionId(section.title)}-title`}>
                      <div
                        className="global-help-section-head"
                        ref={(el) => handleSectionRef(section.title, el)}
                      >
                        <span className="global-help-section-icon-shell" aria-hidden="true">
                          <GlobalUiIcon name={section.icon} className="global-help-section-icon" />
                        </span>
                        <h3 id={`${toHelpSectionId(section.title)}-title`} className="global-help-section-title">
                          {section.title}
                        </h3>
                      </div>
                      <ul className="global-help-list">
                        {section.items.map((item) => (
                          <li key={`${section.title}-${item.label}`} className="global-help-row">
                            <div className="global-help-row-keys" aria-hidden={item.keys ? undefined : 'true'}>
                              {item.keys?.length
                                ? item.keys.map((key) => (
                                    <kbd key={key} className="global-help-key">
                                      {key}
                                    </kbd>
                                  ))
                                : <span className="global-help-bullet" />}
                            </div>
                            <div className="global-help-row-copy">
                              <strong>{item.label}</strong>
                              {item.detail ? <span>{item.detail}</span> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </AnimatedReveal>
                ))}
              </div>
            )}
          </AnimatedStaggerGroup>
        </div>
      </div>
    </AnimatedWorkspaceWindow>
  )
}
