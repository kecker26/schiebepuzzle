import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'
import { type AiMetadataProvider, type ImageThemePalette, type SolvedGalleryEntry } from '../../types/index'
import { hasGalleryChallengeSetup } from '../../utils/galleryReplaySetup.ts'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import { GalleryDisplayEntry, formatGallerySolveCount } from './UploadGalleryDisplayUtils.ts'
import { getGalleryTimelineComparisonHints } from './galleryComparisonHints.ts'
import {
  formatAssistanceModeLabel,
  formatDate,
  formatProfileSourceLabel,
  formatTime,
} from './uploadUtils.ts'
import type { GalleryReplayRequestHandler } from './galleryReplayRequest.ts'
import { useUploadImagePalette } from './uploadImagePalette.ts'

interface UploadGalleryDetailDialogProps {
  entry: GalleryDisplayEntry
  onReplayEntry: GalleryReplayRequestHandler
  onCollectEntry?: (entry: GalleryDisplayEntry) => void
  onTagFilter?: (tagLabel: string) => void
  onFetchRandomImage?: (tagLabel: string) => void
  onOpenSimilarEntry?: (entry: GalleryDisplayEntry) => void
  similarEntries?: GalleryDisplayEntry[]
  onRetryTagging?: (entry: SolvedGalleryEntry) => Promise<void>
  isRetryingTagging?: boolean
  onClose: () => void
}

function getConfigKey(entry: SolvedGalleryEntry): string {
  return `${entry.config.rows}x${entry.config.cols}`
}

function findStoredDetailPalette(entry: GalleryDisplayEntry): ImageThemePalette | null {
  return (
    entry.representativeEntry.imageTheme
    ?? entry.visibleEntries.find((galleryEntry) => galleryEntry.imageTheme)?.imageTheme
    ?? entry.allEntries.find((galleryEntry) => galleryEntry.imageTheme)?.imageTheme
    ?? null
  )
}

function formatAiProviderLabel(provider?: AiMetadataProvider | null): string {
  if (provider === 'openrouter') return 'OpenRouter'
  if (provider === 'openai-compatible') return 'der LLM-Dienst'
  if (provider === 'groq') return 'Groq'
  return 'Gemini'
}

export default function UploadGalleryDetailDialog({
  entry,
  onReplayEntry,
  onCollectEntry,
  onTagFilter,
  onFetchRandomImage,
  onOpenSimilarEntry,
  similarEntries = [],
  onRetryTagging,
  isRetryingTagging = false,
  onClose,
}: UploadGalleryDetailDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const replayButtonRef = useRef<HTMLButtonElement>(null)
  const collectButtonRef = useRef<HTMLButtonElement>(null)
  const representativeEntry = entry.representativeEntry
  const detailImage = representativeEntry.sourceImage ?? representativeEntry.previewImage
  const storedPalette = useMemo(() => findStoredDetailPalette(entry), [entry])
  const { activePalette, paletteStyle: detailPaletteStyle } = useUploadImagePalette({
    paletteSource: representativeEntry.previewImage ?? representativeEntry.sourceImage,
    storedPalette,
  })
  const assistanceLabel = representativeEntry.hasDetailedProfile
    ? formatAssistanceModeLabel(representativeEntry.assistanceMode)
    : formatProfileSourceLabel(false)
  const solveCountLabel = formatGallerySolveCount(entry.totalSolveCount, entry.visibleSolveCount)
  const motifReplaySummary = entry.motifReplaySummary
  const motifDifficultyCount = motifReplaySummary.difficultyVariants.length
  const motifSolveCountLabel = formatGallerySolveCount(motifReplaySummary.totalSolveCount)
  const motifReplayableCount = motifReplaySummary.replayableSolveCount
  const motifBestTimeLabel = motifReplaySummary.bestTimeEntry
    ? formatTime(motifReplaySummary.bestTimeEntry.time)
    : null
  const motifBestCleanTimeLabel = motifReplaySummary.bestCleanTimeEntry
    ? formatTime(motifReplaySummary.bestCleanTimeEntry.time)
    : null
  const solveCountCopy = entry.visibleSolveCount === entry.totalSolveCount
    ? `Dieses Motiv wurde insgesamt ${entry.totalSolveCount} Mal geloest.`
    : `Dieses Motiv wurde insgesamt ${entry.totalSolveCount} Mal geloest; ${entry.visibleSolveCount} Loesungen passen aktuell zu deiner Auswahl.`
  const motifReplayCopy =
    motifReplayableCount > 0
      ? `Motivweit ueber alle Stufen liegen ${motifSolveCountLabel} auf ${motifDifficultyCount} ${motifDifficultyCount === 1 ? 'Stufe' : 'Stufen'} vor; ${motifReplayableCount} davon haben ein Replay-Bild.`
      : `Motivweit ueber alle Stufen liegen ${motifSolveCountLabel} vor, derzeit aber ohne gespeichertes Replay-Bild.`
  const aiTags = representativeEntry.tags ?? []
  const aiTagging = representativeEntry.aiTagging ?? null
  const aiProviderLabel = formatAiProviderLabel(aiTagging?.provider)
  const canRetryAiTagging = aiTagging?.status === 'failed' || aiTagging?.status === 'unavailable'
  const aiCollectionSuggestions = aiTagging?.collectionSuggestions ?? []
  const timelineEntries = motifReplaySummary.allEntries.length > 0
    ? motifReplaySummary.allEntries
    : entry.allEntries
  const motifReplayEntry = representativeEntry.sourceImage || representativeEntry.previewImage
    ? representativeEntry
    : motifReplaySummary.lastReplayableEntry
  const canReplayMotif = Boolean(motifReplayEntry?.sourceImage ?? motifReplayEntry?.previewImage)
  const descriptionId = 'gallery-detail-description'
  const initialFocusRef = canReplayMotif
    ? replayButtonRef
    : onCollectEntry
      ? collectButtonRef
    : closeButtonRef
  const canUseInteractiveTags = Boolean(onTagFilter)
  const canSearchTags = Boolean(onFetchRandomImage)

  const handleActionKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const actionRow = event.currentTarget.closest<HTMLElement>('[data-gallery-detail-action-group="true"]')
    if (!actionRow) {
      return
    }

    const buttons = Array.from(actionRow.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
    const currentIndex = buttons.indexOf(event.currentTarget)
    if (currentIndex < 0) {
      return
    }

    const focusButtonAtIndex = (nextIndex: number) => {
      const targetButton = buttons[nextIndex]
      if (!targetButton) {
        return
      }

      event.preventDefault()
      targetButton.focus({ preventScroll: true })
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        if (currentIndex > 0) {
          focusButtonAtIndex(currentIndex - 1)
        }
        return
      case 'ArrowRight':
      case 'ArrowDown':
        if (currentIndex < buttons.length - 1) {
          focusButtonAtIndex(currentIndex + 1)
        }
        return
      case 'Home':
        focusButtonAtIndex(0)
        return
      case 'End':
        focusButtonAtIndex(buttons.length - 1)
        return
    }
  }, [])

  useEffect(() => {
    if (!canReplayMotif || typeof window === 'undefined') {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      replayButtonRef.current?.focus({ preventScroll: true })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [canReplayMotif])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <AnimatedDialog
      overlayClassName="gallery-detail-overlay"
      dialogClassName="gallery-detail-dialog"
      overlayStyle={detailPaletteStyle}
      dialogStyle={detailPaletteStyle}
      titleId="gallery-detail-title"
      descriptionId={descriptionId}
      onClose={onClose}
      closeOnOverlayClick
      closeOnEscape
      trapFocus
      restoreFocus
      lockScroll
      initialFocusRef={initialFocusRef}
    >
        {activePalette ? (
          <span className="image-card-palette gallery-detail-palette" aria-hidden="true">
            <span className="image-card-palette-swatch image-card-palette-swatch-primary" />
            <span className="image-card-palette-swatch image-card-palette-swatch-accent" />
            <span className="image-card-palette-swatch image-card-palette-swatch-glow" />
          </span>
        ) : null}
        <div className="gallery-detail-media-shell">
          {detailImage ? (
            <img
              src={detailImage}
              alt={`Geloestes Puzzle ${formatDifficultyLabel(representativeEntry.config)} vom ${formatDate(representativeEntry.completedAt)}`}
              className="gallery-detail-image"
            />
          ) : (
            <div className="gallery-detail-image-placeholder" aria-hidden="true">
              <span className="gallery-detail-image-mark">Bild</span>
            </div>
          )}
          <button
            ref={canReplayMotif ? replayButtonRef : undefined}
            type="button"
            className="gallery-detail-motif-replay-tile"
            disabled={!canReplayMotif || !motifReplayEntry}
            onClick={() => {
              if (motifReplayEntry) {
                onReplayEntry(motifReplayEntry, 'motif')
              }
            }}
            aria-label={
              motifReplayEntry
                ? `Motiv ${formatDifficultyLabel(motifReplayEntry.config)} vom ${formatDate(motifReplayEntry.completedAt)} komplett neu spielen`
                : 'Motiv neu spielen derzeit nicht verfuegbar'
            }
            data-page-primary-focus={canReplayMotif ? 'true' : undefined}
          >
            <span className="gallery-detail-motif-replay-kicker">Motiv</span>
            <strong>Neu spielen</strong>
            <span>
              Schwierigkeit im Zuschnitt frei waehlen
            </span>
          </button>
        </div>

        <div className="gallery-detail-body">
          <div className="gallery-detail-header">
            <span className="saved-games-kicker">Galerie-Detail</span>
            <h3 id="gallery-detail-title" className="gallery-detail-title">
              {formatDifficultyLabel(representativeEntry.config)}
            </h3>
            <p id={descriptionId} className="gallery-detail-copy">
              {solveCountCopy} Gezeigt wird der juengste Lauf, der zu deiner aktuellen Auswahl passt,
              vom {formatDate(representativeEntry.completedAt)}. {motifReplayCopy}
            </p>
          </div>

          <div className="dashboard-inline-chips">
            <span className="saved-game-chip">{formatPuzzleSize(representativeEntry.config)}</span>
            <span className="saved-game-chip">Auswahl {solveCountLabel}</span>
            <span className="saved-game-chip">
              Motiv {motifDifficultyCount} {motifDifficultyCount === 1 ? 'Stufe' : 'Stufen'}
            </span>
            <span className="saved-game-chip">
              {motifReplayableCount > 0 ? `Replay ${motifReplayableCount}` : 'Archiv'}
            </span>
            {motifBestTimeLabel ? <span className="saved-game-chip">Rekord {motifBestTimeLabel}</span> : null}
            {motifBestCleanTimeLabel ? (
              <span className="saved-game-chip">Clean {motifBestCleanTimeLabel}</span>
            ) : null}
            {!representativeEntry.hasDetailedProfile ? <span className="saved-game-chip">Legacy-Profil</span> : null}
          </div>

          {aiTags.length > 0 || aiTagging ? (
            <section className="gallery-detail-ai" aria-labelledby="gallery-detail-ai-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-ai-title" className="saved-games-kicker">KI-Sortierung</span>
                <p className="gallery-detail-replay-copy">
                  {aiTagging?.status === 'tagged'
                    ? `${aiProviderLabel} hat Tags und passende Sammlungsvorschlaege fuer dieses Motiv erstellt.`
                    : aiTagging?.status === 'unavailable'
                      ? `${aiProviderLabel}-Tagging ist noch nicht konfiguriert.`
                      : `${aiProviderLabel} konnte dieses Motiv noch nicht taggen.`}
                </p>
                {aiTagging?.status === 'failed' && aiTagging.error && (
                  <div className="gallery-detail-ai-error">
                    <strong>Fehler:</strong> {aiTagging.error}
                  </div>
                )}
                {canRetryAiTagging ? (
                  <button
                    type="button"
                    className="secondary gallery-detail-ai-retry"
                    onClick={() => {
                      void onRetryTagging?.(representativeEntry)
                    }}
                    disabled={isRetryingTagging || !onRetryTagging}
                    title={aiTagging.error ?? undefined}
                  >
                    {isRetryingTagging ? 'Prueft ...' : 'KI-Tagging erneut versuchen'}
                  </button>
                ) : null}
              </div>

              {aiTags.length > 0 ? (
                <div className="gallery-detail-ai-tags" aria-label="KI-Tags">
                  {aiTags.map((tag) => (
                    <span key={tag.label} className="gallery-detail-ai-tag-chip">
                      <button
                        type="button"
                        className="gallery-detail-ai-tag-filter"
                        onClick={() => onTagFilter?.(tag.label)}
                        disabled={!canUseInteractiveTags}
                        title={`Galerie nach ${tag.label} filtern`}
                      >
                        #{tag.label}
                      </button>
                      <button
                        type="button"
                        className="gallery-detail-ai-tag-search"
                        onClick={() => onFetchRandomImage?.(tag.label)}
                        disabled={!canSearchTags}
                        title={`Neues Online-Motiv zu ${tag.label} suchen`}
                        aria-label={`Neues Online-Motiv zu ${tag.label} suchen`}
                      >
                        <Search aria-hidden="true" size={13} strokeWidth={2.4} />
                        <span className="gallery-detail-ai-tag-search-label">Online</span>
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              {aiCollectionSuggestions.length > 0 ? (
                <div className="gallery-detail-ai-suggestions" aria-label="KI-Sammlungsvorschlaege">
                  {aiCollectionSuggestions.map((suggestion) => (
                    <span key={suggestion.collectionId}>
                      {suggestion.collectionName}
                      {suggestion.reason ? `: ${suggestion.reason}` : ''}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {similarEntries.length > 0 ? (
            <section className="gallery-detail-similar-motifs" aria-labelledby="gallery-detail-similar-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-similar-title" className="saved-games-kicker">Aehnliche Motive</span>
                <p className="gallery-detail-replay-copy">
                  Motive mit ueberschneidenden KI-Tags aus deiner lokalen Galerie.
                </p>
              </div>

              <div className="gallery-detail-similar-strip" aria-label="Aehnliche Galerie-Motive">
                {similarEntries.map((similarEntry) => {
                  const similarRepresentativeEntry = similarEntry.representativeEntry
                  const similarImage = similarRepresentativeEntry.previewImage ?? similarRepresentativeEntry.sourceImage
                  const similarTags = (similarRepresentativeEntry.tags ?? []).slice(0, 3)

                  return (
                    <button
                      key={similarEntry.id}
                      type="button"
                      className="gallery-detail-similar-motif"
                      onClick={() => onOpenSimilarEntry?.(similarEntry)}
                      aria-label={`Aehnliches Motiv ${formatDifficultyLabel(similarRepresentativeEntry.config)} vom ${formatDate(similarRepresentativeEntry.completedAt)} anzeigen`}
                    >
                      {similarImage ? (
                        <img
                          src={similarImage}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="gallery-detail-similar-placeholder">Archiv</span>
                      )}
                      <span className="gallery-detail-similar-overlay">
                        <strong>{formatDifficultyLabel(similarRepresentativeEntry.config)}</strong>
                        <span>{formatGallerySolveCount(similarEntry.totalSolveCount)}</span>
                        {similarTags.length > 0 ? (
                          <small>{similarTags.map((tag) => `#${tag.label}`).join(' ')}</small>
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          <div className="gallery-detail-metrics">
            <article className="gallery-detail-metric">
              <span className="gallery-detail-metric-label">Zeit</span>
              <strong className="gallery-detail-metric-value">{formatTime(representativeEntry.time)}</strong>
              <span className="gallery-detail-metric-copy">Gemessene Abschlusszeit des angezeigten Laufs.</span>
            </article>
            <article className="gallery-detail-metric">
              <span className="gallery-detail-metric-label">Netto-Zuege</span>
              <strong className="gallery-detail-metric-value">{representativeEntry.moves}</strong>
              <span className="gallery-detail-metric-copy">Direkter geloester Zugweg ohne Umwege.</span>
            </article>
            <article className="gallery-detail-metric">
              <span className="gallery-detail-metric-label">Aktionen</span>
              <strong className="gallery-detail-metric-value">{representativeEntry.hasDetailedProfile ? representativeEntry.actionMoves : '--'}</strong>
              <span className="gallery-detail-metric-copy">
                {representativeEntry.hasDetailedProfile
                  ? 'Alle wirklich gespielten Schritte dieses angezeigten Laufs.'
                  : 'Bei Legacy-Daten wurden Aktionen damals noch nicht gespeichert.'}
              </span>
            </article>
            <article className="gallery-detail-metric">
              <span className="gallery-detail-metric-label">Laufart</span>
              <strong className="gallery-detail-metric-value">{assistanceLabel}</strong>
              <span className="gallery-detail-metric-copy">
                {representativeEntry.hasDetailedProfile
                  ? 'Zeigt, ob der Lauf clean, mit Hinweisen oder mit Auto-Zug beendet wurde.'
                  : 'Aelterer Eintrag ohne vollstaendiges Laufprofil.'}
              </span>
            </article>
          </div>

          {timelineEntries.length > 0 ? (
            <section className="gallery-detail-timeline" aria-labelledby="gallery-detail-timeline-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-timeline-title" className="saved-games-kicker">Laufverlauf</span>
                <p className="gallery-detail-replay-copy">
                  {timelineEntries.length} gespeicherte {timelineEntries.length === 1 ? 'Runde' : 'Runden'} fuer
                  dieses Motiv.
                </p>
              </div>

              <div className="gallery-detail-timeline-list" data-gallery-detail-action-group="true">
                {timelineEntries.map((timelineEntry) => {
                  const isCurrentEntry = timelineEntry.id === representativeEntry.id
                  const isDifferentDifficulty = getConfigKey(timelineEntry) !== getConfigKey(representativeEntry)
                  const hasChallengeSetup = hasGalleryChallengeSetup(timelineEntry)
                  const timelineMarkers = [
                    isCurrentEntry ? 'Aktuell' : null,
                    hasChallengeSetup ? 'Challenge-Start' : null,
                    motifReplaySummary.bestTimeEntry?.id === timelineEntry.id ? 'Bestzeit' : null,
                    motifReplaySummary.bestMovesEntry?.id === timelineEntry.id ? 'Bestweg' : null,
                    motifReplaySummary.bestCleanTimeEntry?.id === timelineEntry.id ? 'Clean' : null,
                    isDifferentDifficulty ? 'Andere Stufe' : null,
                    timelineEntry.sourceImage || timelineEntry.previewImage ? null : 'Archiv',
                  ].filter((marker): marker is string => Boolean(marker))
                  const canReplayTimelineEntry = Boolean(timelineEntry.sourceImage ?? timelineEntry.previewImage)
                  const profileLabel = timelineEntry.hasDetailedProfile
                    ? formatAssistanceModeLabel(timelineEntry.assistanceMode)
                    : formatProfileSourceLabel(timelineEntry.hasDetailedProfile)
                  const comparisonHints = getGalleryTimelineComparisonHints(
                    timelineEntry,
                    timelineEntries,
                    motifReplaySummary,
                    representativeEntry
                  )
                  const timelinePreviewImage = timelineEntry.previewImage ?? timelineEntry.sourceImage

                  return (
                    <article
                      key={timelineEntry.id}
                      className={`gallery-detail-timeline-item${isCurrentEntry ? ' is-current' : ''}`}
                    >
                      <div className="gallery-detail-timeline-content">
                        <div className="gallery-detail-timeline-main">
                          <span>{isCurrentEntry ? 'Angezeigt' : 'Lauf'}</span>
                          <strong>{formatDifficultyLabel(timelineEntry.config)}</strong>
                          <small>{formatDate(timelineEntry.completedAt)}</small>
                        </div>

                        <div className="gallery-detail-timeline-meta" aria-label="Laufwerte">
                          <span>{formatTime(timelineEntry.time)}</span>
                          <span>{timelineEntry.moves} Netto</span>
                          <span>{profileLabel}</span>
                        </div>

                        {timelineMarkers.length > 0 ? (
                          <div className="gallery-detail-timeline-markers" aria-label="Laufmarkierungen">
                            {timelineMarkers.map((marker) => (
                              <span key={marker}>{marker}</span>
                            ))}
                          </div>
                        ) : null}

                        {comparisonHints.length > 0 ? (
                          <div className="gallery-detail-timeline-insights" aria-label="Laufvergleich">
                            {comparisonHints.map((hint) => (
                              <span key={hint.label} className={`is-${hint.tone}`}>
                                {hint.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="gallery-detail-timeline-action-stack">
                        <div className="gallery-detail-timeline-preview" aria-hidden="true">
                          {timelinePreviewImage ? (
                            <img
                              src={timelinePreviewImage}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span>Archiv</span>
                          )}
                        </div>

                        <div className="gallery-detail-timeline-action-buttons">
                          <button
                            type="button"
                            className="gallery-detail-timeline-action"
                            disabled={!canReplayTimelineEntry}
                            onClick={() => onReplayEntry(timelineEntry, 'run')}
                            onKeyDown={handleActionKeyDown}
                            aria-label={`Lauf ${formatDifficultyLabel(timelineEntry.config)} vom ${formatDate(timelineEntry.completedAt)} spielen`}
                          >
                            {canReplayTimelineEntry
                              ? hasChallengeSetup
                                ? 'Diesen Lauf spielen'
                                : (timelineEntry.cropTransform ? 'Ausschnitt spielen' : 'Motiv spielen')
                              : 'Archiv'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}

          <div className="gallery-detail-actions" data-gallery-detail-action-group="true">
            {onCollectEntry ? (
              <button
                ref={collectButtonRef}
                type="button"
                className="secondary"
                data-page-primary-focus={canReplayMotif ? undefined : 'true'}
                onClick={() => onCollectEntry(entry)}
                onKeyDown={handleActionKeyDown}
                aria-label={`Galerie-Bild ${formatDifficultyLabel(representativeEntry.config)} vom ${formatDate(representativeEntry.completedAt)} zu einer Sammlung hinzufuegen`}
              >
                Sammeln
              </button>
            ) : null}
            <button
              ref={closeButtonRef}
              type="button"
              className="secondary"
              data-page-primary-focus={canReplayMotif || onCollectEntry ? undefined : 'true'}
              onClick={onClose}
              onKeyDown={handleActionKeyDown}
            >
              Schliessen
            </button>
          </div>
        </div>
    </AnimatedDialog>,
    document.body
  )
}
