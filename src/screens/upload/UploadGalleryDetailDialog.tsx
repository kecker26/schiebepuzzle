import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { GitBranch, Medal, Plus, Search, Sparkles, Target, Trophy, X } from 'lucide-react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import { FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE } from '../../app/focusVisibility.ts'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'
import AsyncStatusPanel from '../../motion/AsyncStatusPanel.tsx'
import BusyIndicator from '../../motion/BusyIndicator.tsx'
import { type AiMetadataProvider, type ImageThemePalette, type SolvedGalleryEntry } from '../../types/index'
import { hasGalleryChallengeSetup } from '../../utils/galleryReplaySetup.ts'
import { formatChallengeMedalLabel } from '../../utils/galleryChallenge.ts'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import {
  buildGalleryChallengeSeries,
  buildGalleryTimelineRelations,
  GalleryDisplayEntry,
  formatGallerySolveCount,
} from './UploadGalleryDisplayUtils.ts'
import { getGalleryTimelineComparisonHints } from './galleryComparisonHints.ts'
import {
  formatAssistanceModeLabel,
  formatDate,
  formatProfileSourceLabel,
  formatTime,
} from './uploadUtils.ts'
import type { GalleryReplayRequestHandler } from './galleryReplayRequest.ts'
import GalleryStartBoardPreview from './GalleryStartBoardPreview.tsx'
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
  allTagLabels?: string[]
  onEditTags?: (entryIds: string[], add?: string[], remove?: string[]) => Promise<void>
  isEditingTags?: boolean
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

function formatChallengeDelta(value: number, unit: string): string {
  if (value === 0) return `gleich viele ${unit}`
  return `${Math.abs(value)} ${unit} ${value < 0 ? 'weniger' : 'mehr'}`
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
  allTagLabels = [],
  onEditTags,
  isEditingTags = false,
  onClose,
}: UploadGalleryDetailDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const replayButtonRef = useRef<HTMLButtonElement>(null)
  const collectButtonRef = useRef<HTMLButtonElement>(null)
  const [manualTagInput, setManualTagInput] = useState('')
  const representativeEntry = entry.representativeEntry
  const detailImage = representativeEntry.sourceImage ?? representativeEntry.previewImage
  const storedPalette = useMemo(() => findStoredDetailPalette(entry), [entry])
  const { activePalette, paletteStyle: detailPaletteStyle } = useUploadImagePalette({
    paletteSource: representativeEntry.previewImage ?? representativeEntry.sourceImage,
    storedPalette,
  })
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
  const timelineEntries = motifReplaySummary.allEntries.length > 0
    ? motifReplaySummary.allEntries
    : entry.allEntries
  const challengeSeries = useMemo(
    () => buildGalleryChallengeSeries(timelineEntries),
    [timelineEntries]
  )
  const timelineRelations = useMemo(
    () => buildGalleryTimelineRelations(timelineEntries),
    [timelineEntries]
  )
  const standaloneTimelineEntries = useMemo(
    () => timelineEntries.filter(
      (timelineEntry) =>
        !timelineRelations.attemptsByEntryId.has(timelineEntry.id)
        && !timelineRelations.targetsByEntryId.has(timelineEntry.id)
    ),
    [timelineEntries, timelineRelations]
  )
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
  const canEditTags = Boolean(onEditTags)
  const motifEntryIds = useMemo(() => entry.allEntries.map((galleryEntry) => galleryEntry.id), [entry.allEntries])
  const normalizedManualTagInput = manualTagInput.replace(/^#+/, '').replace(/\s+/g, ' ').trim()
  const canAddManualTag = Boolean(
    canEditTags &&
    normalizedManualTagInput &&
    !aiTags.some((tag) => tag.label.localeCompare(normalizedManualTagInput, 'de', { sensitivity: 'accent' }) === 0)
  )

  const handleAddManualTag = useCallback(async () => {
    if (!canAddManualTag || !onEditTags) return
    await onEditTags(motifEntryIds, [normalizedManualTagInput], [])
    setManualTagInput('')
  }, [canAddManualTag, motifEntryIds, normalizedManualTagInput, onEditTags])

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

  return (
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
            data-app-tooltip="Motiv neu in den Zuschnitt laden. Schwierigkeit und Ausschnitt koennen angepasst werden."
            data-app-tooltip-align="start"
          >
            <span className="gallery-detail-motif-replay-kicker">Motiv</span>
            <strong>Neu spielen</strong>
            <span>
              Schwierigkeit im Zuschnitt frei waehlen
            </span>
          </button>

          {similarEntries.length > 0 ? (
            <section className="gallery-detail-similar-motifs" aria-labelledby="gallery-detail-similar-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-similar-title" className="saved-games-kicker">Aehnliche Motive</span>
                <p className="gallery-detail-replay-copy">
                  Motive mit ueberschneidenden Tags aus deiner lokalen Galerie.
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
                      data-app-tooltip="Aehnliches Motiv aus der Galerie anzeigen."
                      data-app-tooltip-position="top"
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

          {aiTags.length > 0 || aiTagging || canEditTags ? (
            <section className="gallery-detail-ai" aria-labelledby="gallery-detail-ai-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-ai-title" className="saved-games-kicker">Tags & Sortierung</span>
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
                    data-app-tooltip={aiTagging.error || 'KI-Tagging fuer dieses Motiv erneut anfragen.'}
                    data-app-tooltip-position="top"
                  >
                    {isRetryingTagging ? <BusyIndicator label="Prueft ..." /> : 'KI-Tagging erneut versuchen'}
                  </button>
                ) : null}
                {isRetryingTagging ? (
                  <AsyncStatusPanel
                    compact
                    title="KI analysiert das Galeriebild"
                    phase="Bildinhalt, Tags und Sammlungsvorschlaege werden geprueft."
                    longWaitDetail="Die Bildanalyse laeuft noch. Das Motiv bleibt waehrenddessen in der Galerie erhalten."
                  />
                ) : null}
              </div>

              {aiTags.length > 0 ? (
                <div className="gallery-detail-ai-tags" aria-label="Bild-Tags" onKeyDown={handleDirectionalFocusNavigation}>
                  {aiTags.map((tag) => (
                    <span
                      key={tag.label}
                      className={`gallery-detail-ai-tag-chip${tag.source === 'manual' ? ' is-manual' : ''}`}
                      title={tag.source === 'manual' ? 'Manueller Tag' : tag.source === 'imported' ? 'Importierter Tag' : 'KI-Tag'}
                    >
                      <button
                        type="button"
                        className="gallery-detail-ai-tag-filter"
                        {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-detail-ai' }}
                        onClick={() => onTagFilter?.(tag.label)}
                        disabled={!canUseInteractiveTags}
                        data-app-tooltip={`Galerie nach #${tag.label} filtern.`}
                        data-app-tooltip-position="top"
                      >
                        #{tag.label}
                      </button>
                      <button
                        type="button"
                        className="gallery-detail-ai-tag-search"
                        {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-detail-ai' }}
                        onClick={() => onFetchRandomImage?.(tag.label)}
                        disabled={!canSearchTags}
                        aria-label={`Neues Online-Motiv zu ${tag.label} suchen`}
                        data-app-tooltip={`Online nach einem neuen Motiv zu #${tag.label} suchen.`}
                        data-app-tooltip-position="top"
                      >
                        <Search aria-hidden="true" size={13} strokeWidth={2.4} />
                        <span className="gallery-detail-ai-tag-search-label">Online</span>
                      </button>
                      {canEditTags ? (
                        <button
                          type="button"
                          className="gallery-detail-ai-tag-remove"
                          {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-detail-ai' }}
                          onClick={() => void onEditTags?.(motifEntryIds, [], [tag.label])}
                          disabled={isEditingTags}
                          aria-label={`Tag ${tag.label} entfernen`}
                          data-app-tooltip={`#${tag.label} von diesem Motiv entfernen.`}
                          data-app-tooltip-position="top"
                        >
                          <X aria-hidden="true" size={13} strokeWidth={2.5} />
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}

              {canEditTags ? (
                <form
                  className="gallery-detail-manual-tag-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleAddManualTag()
                  }}
                >
                  <label htmlFor="gallery-detail-manual-tag">Eigenen Tag hinzufuegen</label>
                  <div>
                    <input
                      id="gallery-detail-manual-tag"
                      list="gallery-detail-tag-suggestions"
                      value={manualTagInput}
                      onChange={(event) => setManualTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if ((event.key === ',' || event.key === ';') && canAddManualTag) {
                          event.preventDefault()
                          void handleAddManualTag()
                        }
                      }}
                      placeholder="Zum Beispiel Lieblingsbild"
                      maxLength={40}
                      disabled={isEditingTags}
                    />
                    <datalist id="gallery-detail-tag-suggestions">
                      {allTagLabels.map((label) => <option key={label} value={label} />)}
                    </datalist>
                    <button
                      type="submit"
                      className="secondary"
                      disabled={isEditingTags || !canAddManualTag}
                      aria-label="Eigenen Tag hinzufuegen"
                    >
                      <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
                      {isEditingTags ? <BusyIndicator label="Speichert ..." /> : 'Hinzufuegen'}
                    </button>
                  </div>
                  <small>Manuelle Tags bleiben bei einer neuen KI-Analyse erhalten.</small>
                </form>
              ) : null}
            </section>
          ) : null}

          {challengeSeries.length > 0 ? (
            <section className="gallery-detail-challenge-series" aria-labelledby="gallery-detail-challenge-series-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-challenge-series-title" className="saved-games-kicker">Challenge-Serien</span>
                <p className="gallery-detail-replay-copy">
                  Jede Farbe verbindet genau eine Vorlage mit allen direkten Versuchen gegen diesen Lauf.
                </p>
              </div>

              <div className="gallery-detail-challenge-series-list">
                {challengeSeries.map((series, seriesIndex) => {
                  const target = series.targetEntry
                  const bestAttempt = series.bestAttempt
                  const targetOrigin = timelineRelations.attemptsByEntryId.get(series.targetId) ?? null
                  const canChallengeAgain = Boolean(
                    target
                    && hasGalleryChallengeSetup(target)
                    && (target.sourceImage ?? target.previewImage)
                  )
                  const bestTimeDelta = target ? bestAttempt.time - target.time : null
                  const bestMovesDelta = target ? bestAttempt.moves - target.moves : null
                  const chronologicalAttempts = [...series.attempts].sort(
                    (a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt)
                  )

                  return (
                    <article
                      key={series.targetId}
                      className={`gallery-detail-challenge-card series-tone-${seriesIndex % 4}`}
                    >
                      <div className="gallery-detail-challenge-card-head">
                        <span className="gallery-detail-challenge-medal" aria-hidden="true">
                          <GitBranch size={22} strokeWidth={2.3} />
                        </span>
                        <div>
                          <span className="saved-games-kicker">Challenge-Serie {seriesIndex + 1}</span>
                          <strong>
                            {target
                              ? `${formatDifficultyLabel(target.config)} vom ${formatDate(target.completedAt)}`
                              : 'Vorlagenlauf nicht mehr vorhanden'}
                          </strong>
                          {targetOrigin ? (
                            <small className="gallery-detail-challenge-origin">
                              Entstanden aus Versuch {targetOrigin.attemptNumber} der Challenge-Serie {targetOrigin.seriesNumber}.
                            </small>
                          ) : null}
                        </div>
                        <span className={`gallery-detail-challenge-best-medal is-${series.bestMedal}`}>
                          <Medal aria-hidden="true" size={15} strokeWidth={2.4} />
                          {formatChallengeMedalLabel(series.bestMedal)}
                        </span>
                      </div>

                      <div className="gallery-detail-challenge-target">
                        <GalleryStartBoardPreview
                          entry={target}
                          className="gallery-detail-challenge-start-board"
                        />
                        <div className="gallery-detail-challenge-target-copy">
                          <div className="gallery-detail-challenge-target-heading">
                            <span className="gallery-detail-challenge-target-icon" aria-hidden="true">
                              <Target size={17} strokeWidth={2.5} />
                            </span>
                            <span>Vorlage dieser Serie</span>
                          </div>
                          {target ? (
                            <div className="gallery-detail-challenge-target-metrics" aria-label="Werte der Challenge-Vorlage">
                              <span>
                                <small>Zeit</small>
                                <strong>{formatTime(target.time)}</strong>
                              </span>
                              <span>
                                <small>Netto-Zuege</small>
                                <strong>{target.moves}</strong>
                              </span>
                            </div>
                          ) : (
                            <strong>Nicht mehr vorhanden</strong>
                          )}
                          <small>
                            {target
                              ? `${series.attempts.length} direkte ${series.attempts.length === 1 ? 'Herausforderung' : 'Herausforderungen'} gegen genau diesen Lauf.`
                              : 'Historische Challenge-Serie ohne vorhandene Vorlage.'}
                          </small>
                          <button
                            type="button"
                            className="gallery-detail-challenge-replay"
                            disabled={!canChallengeAgain || !target}
                            onClick={() => {
                              if (target) {
                                onReplayEntry(target, 'run')
                              }
                            }}
                            onKeyDown={handleActionKeyDown}
                            data-app-tooltip={canChallengeAgain
                              ? 'Nur diese Vorlage mit demselben gespeicherten Startzustand erneut herausfordern.'
                              : 'Die Vorlage kann nicht erneut als Challenge gestartet werden.'}
                            data-app-tooltip-position="top"
                          >
                            Vorlage herausfordern
                          </button>
                        </div>
                      </div>

                      <div className="gallery-detail-challenge-comparison">
                        <div>
                          <span>Bester Versuch</span>
                          <strong>{formatTime(bestAttempt.time)} · {bestAttempt.moves} Netto</strong>
                          {bestTimeDelta !== null && bestMovesDelta !== null ? (
                            <small>
                              {formatChallengeDelta(bestTimeDelta, 'Sek.')} · {formatChallengeDelta(bestMovesDelta, 'Zuege')}
                            </small>
                          ) : null}
                        </div>
                        <div>
                          <span>Serie</span>
                          <strong>{series.attempts.length} {series.attempts.length === 1 ? 'Versuch' : 'Versuche'}</strong>
                          <small>{series.improvedAttemptCount} mit verbessertem Zielwert</small>
                        </div>
                      </div>

                      <div className="gallery-detail-challenge-attempts">
                        <div className="gallery-detail-challenge-attempts-head">
                          <Trophy aria-hidden="true" size={16} strokeWidth={2.4} />
                          <span>Zugehoerige Versuche</span>
                          <strong>{series.attempts.length}</strong>
                        </div>
                        <div className="gallery-detail-challenge-attempt-list">
                            {chronologicalAttempts.map((attempt, index) => {
                              const timeDelta = target ? attempt.time - target.time : null
                              const movesDelta = target ? attempt.moves - target.moves : null
                              const isBestAttempt = attempt.id === bestAttempt.id
                              const followUpSeries = timelineRelations.targetsByEntryId.get(attempt.id) ?? null

                              return (
                                <div key={attempt.id} className={`gallery-detail-challenge-attempt is-${attempt.challengeMedal ?? 'bronze'}`}>
                                  <span className="gallery-detail-challenge-attempt-node" aria-hidden="true">
                                    <Medal size={14} strokeWidth={2.5} />
                                  </span>
                                  <div>
                                    <span>Versuch {index + 1} von {series.attempts.length}</span>
                                    <strong>
                                      {formatChallengeMedalLabel(attempt.challengeMedal ?? 'bronze')}
                                      {isBestAttempt ? ' · Bester Versuch' : ''}
                                    </strong>
                                    <small>{formatDate(attempt.completedAt)}</small>
                                  </div>
                                  <div>
                                    <strong>{formatTime(attempt.time)} · {attempt.moves} Netto</strong>
                                    {timeDelta !== null && movesDelta !== null ? (
                                      <small>
                                        {formatChallengeDelta(timeDelta, 'Sek.')} · {formatChallengeDelta(movesDelta, 'Zuege')}
                                      </small>
                                    ) : null}
                                    {followUpSeries ? (
                                      <small className="is-follow-up-series">
                                        Danach Vorlage der Challenge-Serie {followUpSeries.seriesNumber}
                                      </small>
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}

          {standaloneTimelineEntries.length > 0 ? (
            <section className="gallery-detail-timeline" aria-labelledby="gallery-detail-timeline-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-timeline-title" className="saved-games-kicker">Eigenstaendige Laeufe</span>
                <p className="gallery-detail-replay-copy">
                  Eigene Startzustaende ohne Verbindung zu einer bestehenden Challenge-Serie.
                </p>
              </div>

              <div className="gallery-detail-timeline-list" data-gallery-detail-action-group="true">
                {standaloneTimelineEntries.map((timelineEntry) => {
                  const isCurrentEntry = timelineEntry.id === representativeEntry.id
                  const isDifferentDifficulty = getConfigKey(timelineEntry) !== getConfigKey(representativeEntry)
                  const hasChallengeSetup = hasGalleryChallengeSetup(timelineEntry)
                  const timelineMarkers = [
                    isCurrentEntry ? 'Aktuell' : null,
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
                  return (
                    <article
                      key={timelineEntry.id}
                      className={`gallery-detail-timeline-item is-standalone${isCurrentEntry ? ' is-current' : ''}`}
                    >
                      <div className="gallery-detail-timeline-content">
                        <div className="gallery-detail-timeline-role">
                          <span><Sparkles aria-hidden="true" size={13} strokeWidth={2.5} /> Eigenstaendiger Lauf</span>
                          <small>Komplett neuer Lauf ohne Challenge-Bezug.</small>
                        </div>

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
                          <div className="gallery-detail-timeline-chip-section">
                            <span className="gallery-detail-timeline-chip-label">Status</span>
                            <div className="gallery-detail-timeline-markers" aria-label="Laufmarkierungen">
                              {timelineMarkers.map((marker) => (
                                <span
                                  key={marker}
                                  data-app-tooltip={
                                    marker === 'Aktuell'
                                      ? 'Dieser Lauf ist gerade im Detaildialog ausgewaehlt.'
                                      : marker === 'Bestzeit'
                                        ? 'Schnellster gespeicherter Lauf fuer dieses Motiv.'
                                        : marker === 'Bestweg'
                                          ? 'Wenigste Netto-Zuege fuer dieses Motiv.'
                                          : marker === 'Clean'
                                            ? 'Bester Lauf ohne Hinweise, Auto-Zuege oder Solver.'
                                            : marker === 'Archiv'
                                              ? 'Bilddaten sind nicht mehr fuer Replay verfuegbar.'
                                              : 'Dieser Lauf liegt auf einer anderen Schwierigkeit.'
                                  }
                                  data-app-tooltip-position="top"
                                >
                                  {marker}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {comparisonHints.length > 0 ? (
                          <div className="gallery-detail-timeline-chip-section">
                            <span className="gallery-detail-timeline-chip-label">Vergleich</span>
                            <div className="gallery-detail-timeline-insights" aria-label="Laufvergleich">
                              {comparisonHints.map((hint) => (
                                <span
                                  key={hint.label}
                                  className={`is-${hint.tone}`}
                                  data-app-tooltip={hint.label}
                                  data-app-tooltip-position="top"
                                >
                                  {hint.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="gallery-detail-timeline-action-stack">
                        <GalleryStartBoardPreview
                          entry={timelineEntry}
                          className="gallery-detail-timeline-preview"
                        />

                        <div className="gallery-detail-timeline-action-buttons">
                          <button
                            type="button"
                            className="gallery-detail-timeline-action"
                            disabled={!canReplayTimelineEntry}
                            onClick={() => onReplayEntry(timelineEntry, 'run')}
                            onKeyDown={handleActionKeyDown}
                            aria-label={`Lauf ${formatDifficultyLabel(timelineEntry.config)} vom ${formatDate(timelineEntry.completedAt)} spielen`}
                            data-app-tooltip={
                              canReplayTimelineEntry
                                ? hasChallengeSetup
                                  ? 'Diesen Lauf mit seinem gespeicherten Startzustand wiederholen.'
                                  : (timelineEntry.cropTransform ? 'Gespeicherten Ausschnitt erneut spielen.' : 'Motiv neu laden und spielen.')
                                : 'Archivierter Lauf ohne verfuegbare Bilddaten.'
                            }
                            data-app-tooltip-position="top"
                          >
                            {canReplayTimelineEntry
                              ? hasChallengeSetup
                                ? 'Challenge starten'
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
                data-app-tooltip="Dieses Motiv zu einer Sammlung hinzufuegen."
                data-app-tooltip-position="top"
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
              data-app-tooltip="Galerie-Detaildialog schliessen."
              data-app-tooltip-position="top"
            >
              Schliessen
            </button>
          </div>
        </div>
    </AnimatedDialog>
  )
}
