import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { type AppContextMenuHandler, type AppContextMenuRequest } from '../app/appContextMenu.ts'
import { COMMAND_PALETTE_SHORTCUT_LABEL } from '../app/commandPaletteShortcut.ts'
import { handleDirectionalFocusNavigation } from '../app/directionalFocusNavigation.ts'
import CompactContextMenu, { type ContextMenuItem, type ContextMenuPosition } from '../components/CompactContextMenu.tsx'
import '../styles/screens/start.css'
import AnimatedButton from '../motion/AnimatedButton.tsx'
import AnimatedReveal from '../motion/AnimatedReveal.tsx'
import AnimatedStaggerGroup from '../motion/AnimatedStaggerGroup.tsx'
import StartScreenIcon from '../components/StartScreenIcon.tsx'
import StartScreenAnimatedBoard from '../components/StartScreenAnimatedBoard.tsx'
import { shouldPreserveNativeContextMenu } from '../utils/contextWindow.ts'

interface StartScreenProps {
  onStart: () => void
  onResumeSession?: () => void
  onQuit: () => void
  onOpenHelp: () => void
  quitHint: string | null
  heroImage: string | null
  registerAppContextMenuHandler: (handler: AppContextMenuHandler | null) => void
  resumeActionLabel?: string | null
  resumeActionDetail?: string | null
  savedGamesCount: number
  solvedCount: number
  galleryCount: number
}

const FEATURE_TAGLINE = ['3x3-6x6', '15 Musikstile', 'Eigenes Bild & Zufall']

const START_FEATURE_LIST = [
  {
    title: 'Upload, Zufallsbild und Zuschnitt',
    copy: 'Eigene Motive laden, Quellen wechseln und den Ausschnitt frei setzen.',
    icon: 'crop',
  },
  {
    title: 'Hinweise, Solver, Undo und Redo',
    copy: 'Beim Knobeln helfen lassen, Zuege zuruecknehmen und sauber weiterdenken.',
    icon: 'wandSparkles',
  },
  {
    title: 'Spielstaende, Statistik und Galerie',
    copy: 'Fortschritt sichern, geloeste Runden vergleichen und Motive wiederfinden.',
    icon: 'barChart2',
  },
  {
    title: 'Backup, Import und Musik',
    copy: 'Lokale Daten sichern, wiederherstellen und mit 15 Musikstilen spielen.',
    icon: 'archiveRestore',
  },
] satisfies Array<{
  title: string
  copy: string
  icon: 'archiveRestore' | 'barChart2' | 'crop' | 'wandSparkles'
}>

const formatStatValue = (value: number) => (value > 0 ? value.toString() : 'Noch keine')

const getCountLabel = (value: number, singular: string, plural: string) => (
  value === 1 ? singular : plural
)

function StartScreenFallbackIllustration() {
  return (
    <svg
      className="start-screen-visual-image"
      viewBox="0 0 720 760"
      role="img"
      aria-labelledby="start-screen-visual-title"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="start-screen-visual-title">
        Illustration aus Fotokarte, Puzzle-Teilen und leuchtender Spieloberflaeche
      </title>
      <defs>
        <linearGradient id="start-bg" x1="72" y1="48" x2="648" y2="712" gradientUnits="userSpaceOnUse">
          <stop stopColor="#17315D" />
          <stop offset="1" stopColor="#081020" />
        </linearGradient>
        <linearGradient id="start-card" x1="126" y1="116" x2="584" y2="640" gradientUnits="userSpaceOnUse">
          <stop stopColor="#26467D" />
          <stop offset="1" stopColor="#11203F" />
        </linearGradient>
        <linearGradient id="start-photo" x1="148" y1="172" x2="336" y2="420" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F5FAFF" />
          <stop offset="1" stopColor="#CCDCF6" />
        </linearGradient>
        <linearGradient id="start-tile" x1="360" y1="200" x2="542" y2="442" gradientUnits="userSpaceOnUse">
          <stop stopColor="#95D5FF" />
          <stop offset="1" stopColor="#4B74FF" />
        </linearGradient>
        <linearGradient id="start-piece" x1="320" y1="430" x2="470" y2="612" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9EF6D8" />
          <stop offset="1" stopColor="#279889" />
        </linearGradient>
      </defs>

      <rect width="720" height="760" rx="40" fill="url(#start-bg)" />
      <circle cx="148" cy="130" r="110" fill="#68C3FF" fillOpacity="0.14" />
      <circle cx="596" cy="620" r="140" fill="#6EE7B7" fillOpacity="0.12" />

      <rect x="108" y="116" width="504" height="528" rx="38" fill="url(#start-card)" />
      <rect x="108.75" y="116.75" width="502.5" height="526.5" rx="37.25" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />

      <g transform="translate(138 162) rotate(-5 104 130)">
        <rect width="208" height="260" rx="26" fill="url(#start-photo)" />
        <rect x="16" y="16" width="176" height="188" rx="18" fill="#70BDFE" />
        <path
          d="M16 206C44 166 74 144 108 146C144 149 170 173 192 204H16V206Z"
          fill="#24467B"
          fillOpacity="0.52"
        />
        <path
          d="M44 182C68 140 96 118 128 122C154 126 174 152 192 204H16C24 198 34 191 44 182Z"
          fill="#B5FF86"
          fillOpacity="0.62"
        />
        <circle cx="150" cy="70" r="20" fill="#FFF5C8" />
        <rect x="20" y="220" width="96" height="16" rx="8" fill="#3A5EA5" fillOpacity="0.22" />
      </g>

      <g transform="translate(352 184)">
        <rect width="216" height="216" rx="30" fill="#0D1730" fillOpacity="0.82" />
        <rect x="0.75" y="0.75" width="214.5" height="214.5" rx="29.25" stroke="white" strokeOpacity="0.08" strokeWidth="1.5" />
        <rect x="18" y="18" width="56" height="56" rx="16" fill="url(#start-tile)" />
        <rect x="80" y="18" width="56" height="56" rx="16" fill="#A5C8FF" />
        <rect x="142" y="18" width="56" height="56" rx="16" fill="#5B86FF" />
        <rect x="18" y="80" width="56" height="56" rx="16" fill="#5B86FF" />
        <rect x="80" y="80" width="56" height="56" rx="16" fill="#F6FAFF" />
        <rect x="142" y="80" width="56" height="56" rx="16" fill="#214896" />
        <rect x="18" y="142" width="56" height="56" rx="16" fill="#A5C8FF" />
        <rect x="80" y="142" width="56" height="56" rx="16" fill="#214896" />
      </g>

      <path
        d="M354 418C345.163 418 338 425.163 338 434V447.186C338 451.501 334.501 455 330.186 455H322V541H330.186C334.501 541 338 544.499 338 548.814V562C338 570.837 345.163 578 354 578H383.186C387.501 578 391 574.501 391 570.186C391 564.008 396.008 559 402.186 559C408.364 559 413.372 564.008 413.372 570.186C413.372 574.501 416.871 578 421.186 578H458C466.837 578 474 570.837 474 562V527.186C474 522.871 470.501 519.372 466.186 519.372C460.008 519.372 455 514.364 455 508.186C455 502.008 460.008 497 466.186 497C470.501 497 474 493.501 474 489.186V434C474 425.163 466.837 418 458 418H424.814C420.499 418 417 414.501 417 410.186C417 404.008 411.992 399 405.814 399C399.636 399 394.628 404.008 394.628 410.186C394.628 414.501 391.129 418 386.814 418H354Z"
        fill="url(#start-piece)"
      />

      <g transform="translate(394 476)">
        <rect width="166" height="92" rx="22" fill="#0C1630" fillOpacity="0.78" />
        <rect x="0.75" y="0.75" width="164.5" height="90.5" rx="21.25" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />
        <rect x="20" y="20" width="66" height="14" rx="7" fill="#68B9FF" />
        <rect x="20" y="44" width="112" height="10" rx="5" fill="#2E569F" />
        <rect x="20" y="60" width="88" height="10" rx="5" fill="#2E569F" fillOpacity="0.76" />
        <circle cx="132" cy="46" r="18" fill="#B0FF8C" fillOpacity="0.26" />
        <rect x="124" y="38" width="16" height="16" rx="4" fill="#CCFF95" />
      </g>
    </svg>
  )
}

export default function StartScreen({
  onStart,
  onResumeSession,
  onQuit,
  onOpenHelp,
  quitHint,
  heroImage,
  registerAppContextMenuHandler,
  resumeActionLabel = null,
  resumeActionDetail = null,
  savedGamesCount,
  solvedCount,
  galleryCount,
}: StartScreenProps) {
  const startButtonRef = useRef<HTMLButtonElement | null>(null)
  const resumeDetailId = useId()
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null)
  const hasResumeAction = Boolean(onResumeSession && resumeActionLabel)
  const startStats = useMemo(() => [
    {
      key: 'saved-games',
      value: savedGamesCount,
      displayValue: formatStatValue(savedGamesCount),
      label: getCountLabel(savedGamesCount, 'Spiel', 'Spiele'),
      icon: 'folderOpen' as const,
    },
    {
      key: 'solved',
      value: solvedCount,
      displayValue: formatStatValue(solvedCount),
      label: getCountLabel(solvedCount, 'Sieg', 'Siege'),
      icon: 'barChart2' as const,
    },
    {
      key: 'gallery',
      value: galleryCount,
      displayValue: formatStatValue(galleryCount),
      label: getCountLabel(galleryCount, 'Motiv', 'Motive'),
      icon: 'image' as const,
    },
  ], [galleryCount, savedGamesCount, solvedCount])

  const openContextWindow = useCallback((request: AppContextMenuRequest) => {
    if (shouldPreserveNativeContextMenu(request.target)) return

    request.preventDefault?.()
    setContextMenuPosition({ x: request.clientX, y: request.clientY })
  }, [])

  useEffect(() => {
    registerAppContextMenuHandler(openContextWindow)
    return () => registerAppContextMenuHandler(null)
  }, [openContextWindow, registerAppContextMenuHandler])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      startButtonRef.current?.focus({ preventScroll: true })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  const handleOpenContextWindow = useCallback((event: React.MouseEvent<HTMLElement>) => {
    openContextWindow({
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target,
      preventDefault: () => event.preventDefault(),
    })
  }, [openContextWindow])

  const startActions = useMemo<ContextMenuItem[]>(() => [
    {
      groupTitle: 'Aktionen',
    },
    ...(hasResumeAction ? [{
      label: resumeActionLabel ?? 'Letzte Sitzung fortsetzen',
      icon: 'play',
      meta: 'Zuletzt',
      onClick: onResumeSession!,
    } satisfies ContextMenuItem] : []),
    {
      label: 'Spiel starten',
      icon: 'play',
      meta: 'Los',
      onClick: onStart,
    },
    {
      groupTitle: 'App',
    },
    {
      label: 'Hilfe und Shortcuts',
      icon: 'helpCircle',
      meta: 'F1',
      onClick: onOpenHelp,
    },
    {
      label: 'Beenden',
      icon: 'power',
      meta: 'Fenster',
      onClick: onQuit,
    },
  ], [hasResumeAction, onOpenHelp, onQuit, onResumeSession, onStart, resumeActionLabel])

  return (
    <section className="start-screen" data-page-focus-root="true" onContextMenu={handleOpenContextWindow}>
      <div className="start-screen-shell">
        <AnimatedStaggerGroup className="start-screen-copy" level="strong">
          <AnimatedReveal as="article" className="start-screen-hero-panel" level="strong">
            <div className="start-screen-hero">
              <span className="start-screen-kicker">
                <StartScreenIcon name="sparkles" className="start-screen-kicker-icon" />
                <span>Foto rein. Puzzle los.</span>
              </span>
              <h1 className="start-screen-title">Schiebepuzzle</h1>
              <p className="start-screen-lead">
                Eigene Bilder oder Zufallsbild laden, frei zuschneiden und mit Spielstaenden,
                Statistik und Galerie dranbleiben.
              </p>
            </div>

            {hasResumeAction && (
              <AnimatedButton
                ref={startButtonRef}
                className="start-screen-resume-card"
                interaction="card"
                data-page-primary-focus="true"
                aria-label={resumeActionLabel ?? undefined}
                aria-describedby={resumeActionDetail ? resumeDetailId : undefined}
                onClick={onResumeSession}
                reveal
                revealLevel="medium"
              >
                <span className="start-screen-resume-icon-shell">
                  <StartScreenIcon name="play" className="start-screen-resume-icon" />
                </span>
                <span className="start-screen-resume-copy">
                  <span className="start-screen-resume-label">{resumeActionLabel}</span>
                  {resumeActionDetail && (
                    <span id={resumeDetailId} className="start-screen-resume-detail">{resumeActionDetail}</span>
                  )}
                </span>
              </AnimatedButton>
            )}

            <div className="start-screen-actions-block">
              <AnimatedStaggerGroup
                className="start-screen-actions"
                level="subtle"
                onKeyDown={handleDirectionalFocusNavigation}
              >
                <AnimatedButton
                  ref={hasResumeAction ? undefined : startButtonRef}
                  className="start-screen-button start-screen-button-primary"
                  data-page-primary-focus={hasResumeAction ? undefined : 'true'}
                  onClick={onStart}
                  reveal
                  revealLevel="subtle"
                >
                  <StartScreenIcon name="play" className="start-screen-button-icon" />
                  Spiel starten
                </AnimatedButton>
                <AnimatedButton
                  className="start-screen-button start-screen-button-secondary"
                  onClick={onQuit}
                  reveal
                  revealLevel="subtle"
                >
                  <StartScreenIcon name="power" className="start-screen-button-icon" />
                  Beenden
                </AnimatedButton>
              </AnimatedStaggerGroup>
            </div>
          </AnimatedReveal>

          {quitHint && (
            <p className="start-screen-quit-hint" aria-live="polite">
              {quitHint}
            </p>
          )}

          <AnimatedReveal as="section" className="start-screen-progress-panel" level="strong" aria-label="Dein Fortschritt und wichtige Features">
            <AnimatedStaggerGroup className="start-screen-stat-row" level="medium">
              {startStats.map((stat) => (
                <AnimatedReveal
                  key={stat.key}
                  as="article"
                  className={`start-screen-stat-tile${stat.value === 0 ? ' is-empty' : ''}`}
                  level="medium"
                >
                  <StartScreenIcon name={stat.icon} className="start-screen-stat-icon" />
                  <strong className="start-screen-stat-value">{stat.displayValue}</strong>
                  <span className="start-screen-stat-label">{stat.label}</span>
                </AnimatedReveal>
              ))}
            </AnimatedStaggerGroup>

            <div className="start-screen-shortcuts" aria-label="Shortcuts">
              <div className="start-screen-shortcut">
                <StartScreenIcon name="helpCircle" className="start-screen-shortcut-icon" />
                <span><kbd>F1</kbd> Hilfe & Shortcuts</span>
              </div>
              <div className="start-screen-shortcut">
                <StartScreenIcon name="keyboard" className="start-screen-shortcut-icon" />
                <span><kbd>{COMMAND_PALETTE_SHORTCUT_LABEL}</kbd> Schnellaktionen</span>
              </div>
            </div>

            <section className="start-screen-feature-overview" aria-labelledby="start-screen-feature-overview-title">
              <div className="start-screen-feature-overview-head">
                <span id="start-screen-feature-overview-title" className="start-screen-feature-overview-kicker">
                  Wichtigste Features
                </span>
              </div>

              <ul className="start-screen-feature-list">
                {START_FEATURE_LIST.map((feature) => (
                  <li key={feature.title} className="start-screen-feature-item">
                    <StartScreenIcon name={feature.icon} className="start-screen-feature-item-icon" />
                    <span className="start-screen-feature-item-copy">
                      <strong>{feature.title}</strong>
                      <span>{feature.copy}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </AnimatedReveal>
        </AnimatedStaggerGroup>

        <div className="start-screen-visual">
          <AnimatedStaggerGroup className="start-screen-visual-stack" level="strong">
            <AnimatedReveal className="start-screen-visual-frame" level="strong">
              <div className="start-screen-visual-glow" aria-hidden="true" />
              {heroImage ? (
                <StartScreenAnimatedBoard imageSrc={heroImage} />
              ) : (
                <StartScreenFallbackIllustration />
              )}
            </AnimatedReveal>

            <p className="start-screen-feature-tagline" aria-label="Puzzle-Funktionen">
              {FEATURE_TAGLINE.map((feature, index) => (
                <span key={feature}>
                  {index > 0 && <span className="start-screen-feature-separator" aria-hidden="true">.</span>}
                  {feature}
                </span>
              ))}
            </p>
          </AnimatedStaggerGroup>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {contextMenuPosition && (
          <CompactContextMenu
            position={contextMenuPosition}
            items={startActions}
            onClose={() => setContextMenuPosition(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
