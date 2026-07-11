import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ChevronDown, GitBranch, Medal, Plus, Search, Sparkles, Target, Trophy, X } from 'lucide-react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import { FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE } from '../../app/focusVisibility.ts'
import AnimatedCollapse from '../../motion/AnimatedCollapse.tsx'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'
import AsyncStatusPanel from '../../motion/AsyncStatusPanel.tsx'
import BusyIndicator from '../../motion/BusyIndicator.tsx'
import { type AiMetadataProvider, type ImageThemePalette, type SolvedGalleryEntry } from '../../types/index'
import {
  hasGalleryChallengeSetup,
  isGalleryChallengeTargetEligible,
} from '../../utils/galleryReplaySetup.ts'
import { formatChallengeMedalLabel, getChallengeMedalEmoji } from '../../utils/galleryChallenge.ts'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import {
  buildGalleryChallengeSeries,
  buildGalleryStartStateRelations,
  buildGalleryStartStateSeries,
  buildGalleryTimelineRelations,
  type GalleryDisplayEntry,
  type GalleryStartStateSeries,
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
import GalleryChallengeStartDialog from './GalleryChallengeStartDialog.tsx'
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

function getPreTemplateEntryComment(entry: SolvedGalleryEntry): string {
  if (entry.qualificationResult === 'failed') return 'Qualifikation: kein echtes Ziel erzeugt.'
  if (entry.qualificationResult === 'created-template') return 'Vorlage: machte aus der Schätzung ein echtes Ziel.'
  if (entry.challengeRunKind === 'qualification') return 'Qualifikation: prüfte das geschätzte Ziel.'
  return 'Vor Zielsetzung: gehört zur früheren Schätzphase.'
}

function getRelatedStartStateEntryComment(entry: SolvedGalleryEntry, canStartRelatedChallenge: boolean): string {
  if (entry.challengeTargetId && !entry.challengeMedal) {
    return 'Assistiert: gleiches Startbrett, keine Medaille.'
  }

  if (canStartRelatedChallenge) {
    return 'Clean: kann als alternative Vorlage dienen.'
  }

  return 'Übung: gleiches Startbrett, nicht gewertet.'
}

function getCompletedAtTimestamp(entry: SolvedGalleryEntry): number {
  const timestamp = Date.parse(entry.completedAt)
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp
}

function getBestRunEntry(entries: Array<SolvedGalleryEntry | null | undefined>): SolvedGalleryEntry | null {
  const uniqueEntries = Array.from(
    entries
      .filter((candidate): candidate is SolvedGalleryEntry => Boolean(candidate))
      .reduce((entriesById, candidate) => entriesById.set(candidate.id, candidate), new Map<string, SolvedGalleryEntry>())
      .values()
  )

  return uniqueEntries.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time
    if (a.moves !== b.moves) return a.moves - b.moves
    return getCompletedAtTimestamp(b) - getCompletedAtTimestamp(a)
  })[0] ?? null
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
  const [pendingChallengeTarget, setPendingChallengeTarget] = useState<SolvedGalleryEntry | null>(null)
  const [expandedChallengeSeriesIds, setExpandedChallengeSeriesIds] = useState<Set<string>>(() => new Set())
  const [expandedStartStateSeriesIds, setExpandedStartStateSeriesIds] = useState<Set<string>>(() => new Set())
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
    ? `Dieses Motiv wurde insgesamt ${entry.totalSolveCount} Mal gelöst.`
    : `Dieses Motiv wurde insgesamt ${entry.totalSolveCount} Mal gelöst; ${entry.visibleSolveCount} Lösungen passen aktuell zu deiner Auswahl.`
  const motifReplayCopy =
    motifReplayableCount > 0
      ? `Motivweit über alle Stufen liegen ${motifSolveCountLabel} auf ${motifDifficultyCount} ${motifDifficultyCount === 1 ? 'Stufe' : 'Stufen'} vor; ${motifReplayableCount} davon haben ein Replay-Bild.`
      : `Motivweit über alle Stufen liegen ${motifSolveCountLabel} vor, derzeit aber ohne gespeichertes Replay-Bild.`
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
  const challengeRelatedStartStateEntryIds = useMemo(
    () => new Set(challengeSeries.flatMap((series) => [
      ...series.preTemplateEntries.map((preTemplateEntry) => preTemplateEntry.id),
      ...series.relatedStartStateEntries.map((relatedEntry) => relatedEntry.id),
    ])),
    [challengeSeries]
  )
  const startStateSeries = useMemo(() => {
    const challengeEntryIds = new Set([
      ...Array.from(timelineRelations.attemptsByEntryId.keys()),
      ...Array.from(timelineRelations.targetsByEntryId.keys()),
      ...Array.from(challengeRelatedStartStateEntryIds),
    ])

    return buildGalleryStartStateSeries(timelineEntries, challengeEntryIds)
  }, [timelineEntries, timelineRelations, challengeRelatedStartStateEntryIds])
  const startStateRelations = useMemo(
    () => buildGalleryStartStateRelations(startStateSeries),
    [startStateSeries]
  )
  const standaloneTimelineEntries = useMemo(
    () => timelineEntries.filter(
      (timelineEntry) =>
        !timelineRelations.attemptsByEntryId.has(timelineEntry.id)
        && !timelineRelations.targetsByEntryId.has(timelineEntry.id)
        && !challengeRelatedStartStateEntryIds.has(timelineEntry.id)
        && !startStateRelations.entriesByEntryId.has(timelineEntry.id)
    ),
    [timelineEntries, timelineRelations, challengeRelatedStartStateEntryIds, startStateRelations]
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

  const toggleStartStateSeries = useCallback((seriesId: string) => {
    setExpandedStartStateSeriesIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (nextIds.has(seriesId)) {
        nextIds.delete(seriesId)
      } else {
        nextIds.add(seriesId)
      }
      return nextIds
    })
  }, [])

  const toggleChallengeSeries = useCallback((targetId: string) => {
    setExpandedChallengeSeriesIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (nextIds.has(targetId)) {
        nextIds.delete(targetId)
      } else {
        nextIds.add(targetId)
      }
      return nextIds
    })
  }, [])

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

  const renderTimelineEntry = (timelineEntry: SolvedGalleryEntry) => {
    const startStateRelation = startStateRelations.entriesByEntryId.get(timelineEntry.id) ?? null
    const isCurrentEntry = timelineEntry.id === representativeEntry.id
    const isDifferentDifficulty = getConfigKey(timelineEntry) !== getConfigKey(representativeEntry)
    const hasChallengeSetup = hasGalleryChallengeSetup(timelineEntry)
    const canStartChallenge = isGalleryChallengeTargetEligible(timelineEntry)
    const startStateRunCount = startStateRelation?.series.entries.length ?? 0
    const hasStartStateCleanAnchor = Boolean(startStateRelation?.series.cleanAnchorEntry)
    const isStartStateCleanAnchor = startStateRelation?.series.cleanAnchorEntry?.id === timelineEntry.id
    const timelineMarkers = [
      isCurrentEntry ? 'Aktuell' : null,
      startStateRelation ? `Serie ${startStateRelation.seriesNumber}` : null,
      startStateRelation
        ? isStartStateCleanAnchor
          ? 'Medaillen-Vorlage'
          : startStateRelation.isOrigin
            ? 'Ursprung'
            : 'Übungslauf'
        : null,
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
    const roleLabel = startStateRelation
      ? `Startzustand-Serie ${startStateRelation.seriesNumber}`
      : 'Eigenständiger Lauf'
    const roleDetail = startStateRelation
      ? hasStartStateCleanAnchor
        ? `${startStateRunCount} ${startStateRunCount === 1 ? 'Lauf' : 'Läufe'} mit gleichem Startbrett; cleane Vorlage ist markiert.`
        : `${startStateRunCount} ${startStateRunCount === 1 ? 'Lauf' : 'Läufe'} mit gleichem Startbrett; Medaillen nur bei cleanen Vorlagen.`
      : 'Komplett neuer Lauf ohne Challenge-Bezug.'
    const mainKicker = startStateRelation
      ? isStartStateCleanAnchor
        ? 'Medaillen-Vorlage'
        : startStateRelation.isOrigin
        ? 'Ursprung'
        : `Übung ${startStateRelation.entryNumber}`
      : isCurrentEntry ? 'Angezeigt' : 'Lauf'

    return (
      <article
        key={timelineEntry.id}
        className={`gallery-detail-timeline-item ${startStateRelation ? 'is-start-state-series' : 'is-standalone'}${isCurrentEntry ? ' is-current' : ''}${isStartStateCleanAnchor ? ' is-clean-anchor' : ''}`}
      >
        <div className="gallery-detail-timeline-content">
          <div className="gallery-detail-timeline-role">
            <span>
              {startStateRelation
                ? <GitBranch aria-hidden="true" size={13} strokeWidth={2.5} />
                : <Sparkles aria-hidden="true" size={13} strokeWidth={2.5} />}
              {' '}
              {roleLabel}
            </span>
            <small>{roleDetail}</small>
          </div>

          <div className="gallery-detail-timeline-main">
            <span>{mainKicker}</span>
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
                        ? 'Dieser Lauf ist gerade im Detaildialog ausgewählt.'
                        : marker.startsWith('Serie ')
                          ? `${startStateRunCount} Läufe teilen dieses gespeicherte Startbrett.`
                          : marker === 'Medaillen-Vorlage'
                            ? 'Clean gelöster Lauf dieser Startzustand-Serie; nur solche Läufe dürfen Medaillen-Vorlage sein.'
                          : marker === 'Ursprung'
                            ? 'Erster gespeicherter Lauf dieser Startzustand-Serie.'
                            : marker === 'Übungslauf'
                              ? 'Weiterer Lauf mit demselben gespeicherten Startbrett.'
                              : marker === 'Bestzeit'
                                ? 'Schnellster gespeicherter Lauf für dieses Motiv.'
                                : marker === 'Bestweg'
                                  ? 'Wenigste Netto-Züge für dieses Motiv.'
                                  : marker === 'Clean'
                                    ? 'Bester Lauf ohne Hilfen (Hinweise, Ghost, Heatmap, Auto-Züge oder Solver).'
                                    : marker === 'Archiv'
                                      ? 'Bilddaten sind nicht mehr für Replay verfügbar.'
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
              onClick={() => {
                if (canStartChallenge) {
                  setPendingChallengeTarget(timelineEntry)
                } else {
                  onReplayEntry(timelineEntry, 'run')
                }
              }}
              onKeyDown={handleActionKeyDown}
              aria-label={`Lauf ${formatDifficultyLabel(timelineEntry.config)} vom ${formatDate(timelineEntry.completedAt)} spielen`}
              data-app-tooltip={
                canReplayTimelineEntry
                  ? canStartChallenge
                    ? 'Cleanen gespeicherten Startzustand als Medaillen-Challenge wiederholen.'
                    : hasChallengeSetup
                      ? 'Dieser Lauf wurde nicht clean gelöst und startet deshalb nur als Übung ohne Medaille.'
                      : (timelineEntry.cropTransform ? 'Gespeicherten Ausschnitt erneut spielen.' : 'Motiv neu laden und spielen.')
                  : 'Archivierter Lauf ohne verfügbare Bilddaten.'
              }
              data-app-tooltip-position="top"
            >
              {canReplayTimelineEntry
                ? canStartChallenge
                  ? 'Challenge starten'
                  : hasChallengeSetup
                    ? 'Startzustand üben'
                    : (timelineEntry.cropTransform ? 'Ausschnitt spielen' : 'Motiv spielen')
                : 'Archiv'}
            </button>
          </div>
        </div>
      </article>
    )
  }

  const renderStartStateSeries = (series: GalleryStartStateSeries, seriesIndex: number) => {
    const seriesNumber = seriesIndex + 1
    const isCollapsed = !expandedStartStateSeriesIds.has(series.seriesId)
    const seriesBodyId = `gallery-detail-start-state-series-body-${seriesIndex}`
    const practiceEntry = [series.cleanAnchorEntry, series.latestEntry, ...series.entries].find(
      (candidate): candidate is SolvedGalleryEntry => Boolean(
        candidate
        && hasGalleryChallengeSetup(candidate)
        && (candidate.sourceImage ?? candidate.previewImage)
      )
    ) ?? null
    const challengeTarget = series.cleanAnchorEntry && (series.cleanAnchorEntry.sourceImage ?? series.cleanAnchorEntry.previewImage)
      ? series.cleanAnchorEntry
      : null
    const displayEntry = series.cleanAnchorEntry ?? series.originEntry
    const practiceEntries = series.cleanAnchorEntry
      ? series.entries.filter((seriesEntry) => seriesEntry.id !== series.cleanAnchorEntry?.id)
      : series.entries
    const bestTime = Math.min(...practiceEntries.map((seriesEntry) => seriesEntry.time))
    const bestMoves = Math.min(...practiceEntries.map((seriesEntry) => seriesEntry.moves))
    const rankedPracticeEntries = [...practiceEntries].sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time
      if (a.moves !== b.moves) return a.moves - b.moves
      return getCompletedAtTimestamp(b) - getCompletedAtTimestamp(a)
    })
    const bestRunEntry = getBestRunEntry(series.entries)
    const runCountLabel = `${series.entries.length} ${series.entries.length === 1 ? 'Lauf' : 'Läufe'}`

    return (
      <article
        key={series.seriesId}
        className="gallery-detail-challenge-card gallery-detail-start-state-card"
      >
        <div className="gallery-detail-challenge-card-head">
          <span className="gallery-detail-challenge-medal" aria-hidden="true">
            <GitBranch size={22} strokeWidth={2.3} />
          </span>
          <div className="gallery-detail-challenge-card-title">
            <span className="saved-games-kicker">Startzustand-Serie {seriesNumber}</span>
            <strong>{formatDifficultyLabel(displayEntry.config)} - {runCountLabel}</strong>
            <small className="gallery-detail-start-state-summary">
              Gemeinsames gespeichertes Startbrett ohne Challenge-Serienbezug.
            </small>
            {bestRunEntry ? (
              <small className="gallery-detail-series-best-run">
                Bester Lauf: {formatTime(bestRunEntry.time)} - {bestRunEntry.moves} Züge
              </small>
            ) : null}
          </div>
          <div className="gallery-detail-challenge-card-actions">
            <span className={`gallery-detail-start-state-badge${series.cleanAnchorEntry ? ' is-clean' : ''}`}>
              <GitBranch aria-hidden="true" size={14} strokeWidth={2.4} />
              {series.cleanAnchorEntry ? 'Cleane Vorlage' : 'Übungsserie'}
            </span>
            <button
              type="button"
              className="gallery-detail-challenge-collapse-toggle"
              aria-expanded={!isCollapsed}
              aria-controls={seriesBodyId}
              aria-label={`Startzustand-Serie ${seriesNumber} ${isCollapsed ? 'ausklappen' : 'einklappen'}`}
              onClick={() => toggleStartStateSeries(series.seriesId)}
              onKeyDown={handleActionKeyDown}
              data-app-tooltip={isCollapsed ? 'Startzustand-Serie ausklappen.' : 'Startzustand-Serie einklappen.'}
              data-app-tooltip-position="top"
            >
              <ChevronDown
                aria-hidden="true"
                className={isCollapsed ? '' : 'is-expanded'}
                size={14}
                strokeWidth={2.5}
              />
            </button>
          </div>
        </div>

        <AnimatedCollapse
          id={seriesBodyId}
          isOpen={!isCollapsed}
          className="gallery-detail-challenge-card-collapse"
        >
          <div className="gallery-detail-challenge-card-body">
            <div className="gallery-detail-challenge-target gallery-detail-start-state-target">
              <GalleryStartBoardPreview
                entry={practiceEntry ?? displayEntry}
                className="gallery-detail-challenge-start-board"
              />
              <div className="gallery-detail-challenge-target-copy">
                <div className="gallery-detail-challenge-target-heading">
                  <span className="gallery-detail-challenge-target-icon" aria-hidden="true">
                    <GitBranch size={17} strokeWidth={2.5} />
                  </span>
                  <span>{challengeTarget ? 'Vorlage dieser Serie' : 'Gemeinsamer Startzustand'}</span>
                </div>
                <div className="gallery-detail-challenge-target-metrics" aria-label="Werte der Startzustand-Serie">
                  {challengeTarget ? (
                    <>
                      <span>
                        <small>Zeit</small>
                        <strong>{formatTime(challengeTarget.time)}</strong>
                      </span>
                      <span>
                        <small>Netto-Züge</small>
                        <strong>{challengeTarget.moves}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <small>Stufe</small>
                        <strong>{formatDifficultyLabel(displayEntry.config)}</strong>
                      </span>
                      <span>
                        <small>Läufe</small>
                        <strong>{series.entries.length}</strong>
                      </span>
                    </>
                  )}
                </div>
                <small>
                  {challengeTarget
                    ? 'Der cleane Lauf ist die Medaillen-Vorlage; Übungsläufe mit demselben Startbrett stehen getrennt darunter.'
                    : 'Alle zugehörigen Läufe teilen genau dieses gespeicherte Startbrett.'}
                </small>
                <button
                  type="button"
                  className="gallery-detail-challenge-replay"
                  disabled={!challengeTarget && !practiceEntry}
                  onClick={() => {
                    if (challengeTarget) {
                      setPendingChallengeTarget(challengeTarget)
                    } else if (practiceEntry) {
                      onReplayEntry(practiceEntry, 'practice')
                    }
                  }}
                  onKeyDown={handleActionKeyDown}
                  aria-label={challengeTarget
                    ? `Cleane Vorlage der Startzustand-Serie ${seriesNumber} herausfordern`
                    : `Gemeinsamen Startzustand der Startzustand-Serie ${seriesNumber} üben`}
                  data-app-tooltip={challengeTarget
                    ? 'Startet den cleanen Lauf als Medaillen-Vorlage mit demselben gespeicherten Startzustand.'
                    : practiceEntry
                      ? 'Spielt den gemeinsamen gespeicherten Startzustand als Übung ohne Medaille.'
                      : 'Gemeinsamer Startzustand ohne verfügbare Bilddaten.'}
                  data-app-tooltip-position="top"
                >
                  {challengeTarget ? 'Vorlage herausfordern' : 'Startzustand üben'}
                </button>
              </div>
            </div>

            <div className="gallery-detail-challenge-attempts gallery-detail-start-state-runs">
              <div className="gallery-detail-challenge-attempts-head">
                <GitBranch aria-hidden="true" size={16} strokeWidth={2.4} />
                <span>{series.cleanAnchorEntry ? 'Übungsläufe für diesen Startzustand' : 'Zugehörige Läufe'}</span>
                <strong>{practiceEntries.length}</strong>
              </div>
              {series.cleanAnchorEntry ? (
                <button
                  type="button"
                  className="gallery-detail-challenge-related-action gallery-detail-start-state-practice-action"
                  disabled={!practiceEntry}
                  onClick={() => {
                    if (practiceEntry) onReplayEntry(practiceEntry, 'practice')
                  }}
                  onKeyDown={handleActionKeyDown}
                  aria-label={`Startzustand der Startzustand-Serie ${seriesNumber} als Übung starten`}
                  data-app-tooltip={practiceEntry
                    ? 'Spielt den gemeinsamen gespeicherten Startzustand als Übung ohne Medaille.'
                    : 'Gemeinsamer Startzustand ohne verfügbare Bilddaten.'}
                  data-app-tooltip-position="top"
                >
                  Startzustand üben
                </button>
              ) : null}
              <div className="gallery-detail-challenge-attempt-list">
                {rankedPracticeEntries.map((seriesEntry, practiceIndex) => {
                  const relation = startStateRelations.entriesByEntryId.get(seriesEntry.id)
                  const role = series.cleanAnchorEntry
                    ? `Übungslauf ${practiceIndex + 1}`
                    : relation?.isOrigin
                      ? 'Ursprung'
                      : `Übung ${relation?.entryNumber ?? 1}`
                  const statusLabels = [
                    seriesEntry.id === representativeEntry.id ? 'Aktuell' : null,
                    seriesEntry.time === bestTime ? 'Bestzeit' : null,
                    seriesEntry.moves === bestMoves ? 'Bestweg' : null,
                  ].filter((label): label is string => Boolean(label))
                  const profileLabel = seriesEntry.hasDetailedProfile
                    ? formatAssistanceModeLabel(seriesEntry.assistanceMode)
                    : formatProfileSourceLabel(seriesEntry.hasDetailedProfile)

                  return (
                    <div
                      key={seriesEntry.id}
                      className={`gallery-detail-challenge-attempt gallery-detail-start-state-run${seriesEntry.id === representativeEntry.id ? ' is-current' : ''}`}
                    >
                      <span className="gallery-detail-challenge-attempt-node" aria-hidden="true">
                        <GitBranch size={14} strokeWidth={2.5} />
                      </span>
                      <div>
                        <span>{role}</span>
                        <strong>{formatTime(seriesEntry.time)} - {seriesEntry.moves} Netto</strong>
                        <small>{formatDate(seriesEntry.completedAt)}</small>
                      </div>
                      <div className="gallery-detail-start-state-run-status">
                        <strong>{profileLabel}</strong>
                        <small>{statusLabels.length > 0 ? statusLabels.join(' - ') : 'Gleicher Startzustand'}</small>
                      </div>
                    </div>
                  )
                })}
                {rankedPracticeEntries.length === 0 ? (
                  <div className="gallery-detail-start-state-empty-runs" role="status">
                    Noch keine Übungsläufe für diesen Startzustand.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </AnimatedCollapse>
      </article>
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      initialFocusRef.current?.focus({ preventScroll: true })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [entry.id, initialFocusRef])

  return (
    <AnimatedDialog
      overlayClassName="gallery-detail-overlay"
      dialogClassName="gallery-detail-dialog"
      overlayStyle={detailPaletteStyle}
      dialogStyle={detailPaletteStyle}
      titleId="gallery-detail-title"
      descriptionId={descriptionId}
      onClose={onClose}
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
              alt={`Gelöstes Puzzle ${formatDifficultyLabel(representativeEntry.config)} vom ${formatDate(representativeEntry.completedAt)}`}
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
                : 'Motiv neu spielen derzeit nicht verfügbar'
            }
            data-page-primary-focus={canReplayMotif ? 'true' : undefined}
            data-app-tooltip="Motiv neu in den Zuschnitt laden. Schwierigkeit und Ausschnitt können angepasst werden."
            data-app-tooltip-align="start"
          >
            <span className="gallery-detail-motif-replay-kicker">Motiv</span>
            <strong>Neu spielen</strong>
            <span>
              Schwierigkeit im Zuschnitt frei wählen
            </span>
          </button>

          {similarEntries.length > 0 ? (
            <section className="gallery-detail-similar-motifs" aria-labelledby="gallery-detail-similar-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-similar-title" className="saved-games-kicker">Ähnliche Motive</span>
                <p className="gallery-detail-replay-copy">
                  Motive mit überschneidenden Tags aus deiner lokalen Galerie.
                </p>
              </div>

              <div
                className="gallery-detail-similar-strip"
                aria-label="Ähnliche Galerie-Motive"
                onKeyDown={handleDirectionalFocusNavigation}
              >
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
                      aria-label={`Ähnliches Motiv ${formatDifficultyLabel(similarRepresentativeEntry.config)} vom ${formatDate(similarRepresentativeEntry.completedAt)} anzeigen`}
                      data-app-tooltip="Ähnliches Motiv aus der Galerie anzeigen."
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
              {solveCountCopy} Gezeigt wird der jüngste Lauf, der zu deiner aktuellen Auswahl passt,
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
                    ? `${aiProviderLabel} hat Tags und passende Sammlungsvorschläge für dieses Motiv erstellt.`
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
                    data-app-tooltip={aiTagging.error || 'KI-Tagging für dieses Motiv erneut anfragen.'}
                    data-app-tooltip-position="top"
                  >
                    {isRetryingTagging ? <BusyIndicator label="Prüft ..." /> : 'KI-Tagging erneut versuchen'}
                  </button>
                ) : null}
                {isRetryingTagging ? (
                  <AsyncStatusPanel
                    compact
                    title="KI analysiert das Galeriebild"
                    phase="Bildinhalt, Tags und Sammlungsvorschläge werden geprüft."
                    longWaitDetail="Die Bildanalyse läuft noch. Das Motiv bleibt währenddessen in der Galerie erhalten."
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
                  <label htmlFor="gallery-detail-manual-tag">Eigenen Tag hinzufügen</label>
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
                      aria-label="Eigenen Tag hinzufügen"
                    >
                      <Plus aria-hidden="true" size={15} strokeWidth={2.5} />
                      {isEditingTags ? <BusyIndicator label="Speichert ..." /> : 'Hinzufügen'}
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
                <span id="gallery-detail-challenge-series-title" className="saved-games-kicker">Challenge-Startzustand-Serien</span>
                <p className="gallery-detail-replay-copy">
                  Eine Karte fasst alle Läufe mit identischem gespeicherten Startbrett zusammen.
                </p>
              </div>

              <div
                className="gallery-detail-challenge-series-list"
                data-gallery-detail-action-group="true"
              >
                {challengeSeries.map((series, seriesIndex) => {
                  const target = series.targetEntry
                  const estimatedTarget = series.estimatedTarget
                  const isEstimatedOriginSeries = Boolean(estimatedTarget?.synthetic)
                  const bestAttempt = series.bestAttempt
                  const isCollapsed = !expandedChallengeSeriesIds.has(series.targetId)
                  const seriesBodyId = `gallery-detail-challenge-series-body-${seriesIndex}`
                  const targetOrigin = timelineRelations.attemptsByEntryId.get(series.targetId) ?? null
                  const canReplayTargetStart = Boolean(
                    target
                    && hasGalleryChallengeSetup(target)
                    && (target.sourceImage ?? target.previewImage)
                  )
                  const canChallengeAgain = Boolean(
                    target
                    && isGalleryChallengeTargetEligible(target)
                    && (target.sourceImage ?? target.previewImage)
                  )
                  const qualificationEntry = [target, ...series.preTemplateEntries, ...series.relatedStartStateEntries].find(
                    (candidate): candidate is SolvedGalleryEntry => Boolean(
                      candidate
                      && candidate.estimatedChallengeTarget
                      && hasGalleryChallengeSetup(candidate)
                      && (candidate.sourceImage ?? candidate.previewImage)
                    )
                  ) ?? null
                  const startBoardPreviewEntry =
                    target
                    ?? qualificationEntry
                    ?? series.preTemplateEntries.find((candidate) =>
                      hasGalleryChallengeSetup(candidate) && Boolean(candidate.sourceImage ?? candidate.previewImage)
                    )
                    ?? null
                  const rankedAttempts = series.attempts
                  const startStateFamilyOriginId = target
                    ? [target, ...series.relatedStartStateEntries].sort(
                        (a, b) => getCompletedAtTimestamp(a) - getCompletedAtTimestamp(b)
                      )[0]?.id ?? target.id
                    : null
                  const relatedPracticeEntry = [target, ...series.relatedStartStateEntries].find(
                    (candidate): candidate is SolvedGalleryEntry => Boolean(
                      candidate
                      && hasGalleryChallengeSetup(candidate)
                      && (candidate.sourceImage ?? candidate.previewImage)
                    )
                  ) ?? null
                  const bestRunEntry = getBestRunEntry([
                    target,
                    ...series.attempts,
                    ...series.preTemplateEntries,
                    ...series.relatedStartStateEntries,
                  ])

                  return (
                    <article
                      key={series.targetId}
                      className={`gallery-detail-challenge-card series-tone-${seriesIndex % 4}`}
                    >
                      <div className="gallery-detail-challenge-card-head">
                        <span className="gallery-detail-challenge-medal" aria-hidden="true">
                          <GitBranch size={22} strokeWidth={2.3} />
                        </span>
                        <div className="gallery-detail-challenge-card-title">
                          <span className="saved-games-kicker">
                            Startzustand-Serie {seriesIndex + 1}
                          </span>
                          <strong>
                            {target
                              ? `${formatDifficultyLabel(target.config)} vom ${formatDate(target.completedAt)}`
                              : estimatedTarget
                                ? `Gestartet mit geschätztem Ziel: ${estimatedTarget.moves} Züge / ${formatTime(estimatedTarget.time)}`
                                : 'Vorlagenlauf nicht mehr vorhanden'}
                          </strong>
                          {estimatedTarget ? (
                            <small className="gallery-detail-challenge-origin">
                              {target
                                ? 'Enthält die geschätzte Vorphase und die echte Vorlage dieses Startbretts.'
                                : 'Enthält die geschätzte Vorphase dieses Startbretts; eine echte Vorlage fehlt noch.'}
                            </small>
                          ) : null}
                          {targetOrigin ? (
                            <small className="gallery-detail-challenge-origin">
                              Entstanden aus Versuch {targetOrigin.attemptNumber} der Challenge-Serie {targetOrigin.seriesNumber}.
                            </small>
                          ) : null}
                          {bestRunEntry ? (
                            <small className="gallery-detail-series-best-run">
                              Bester Lauf: {formatTime(bestRunEntry.time)} - {bestRunEntry.moves} Züge
                            </small>
                          ) : null}
                        </div>
                        <div className="gallery-detail-challenge-card-actions">
                          <span className={`gallery-detail-challenge-best-medal is-${series.bestMedal ?? 'none'}`}>
                            <Medal aria-hidden="true" size={15} strokeWidth={2.4} />
                            {series.bestMedal
                              ? formatChallengeMedalLabel(series.bestMedal)
                              : isEstimatedOriginSeries
                                ? 'Vorlage erspielen'
                                : 'Noch keine Medaille'}
                          </span>
                          <button
                            type="button"
                            className="gallery-detail-challenge-collapse-toggle"
                            aria-expanded={!isCollapsed}
                            aria-controls={seriesBodyId}
                            aria-label={`Challenge-Serie ${seriesIndex + 1} ${isCollapsed ? 'ausklappen' : 'einklappen'}`}
                            onClick={() => toggleChallengeSeries(series.targetId)}
                            onKeyDown={handleActionKeyDown}
                            data-app-tooltip={isCollapsed ? 'Challenge-Serie ausklappen.' : 'Challenge-Serie einklappen.'}
                            data-app-tooltip-position="top"
                          >
                            <ChevronDown
                              aria-hidden="true"
                              className={isCollapsed ? '' : 'is-expanded'}
                              size={14}
                              strokeWidth={2.5}
                            />
                          </button>
                        </div>
                      </div>

                      <AnimatedCollapse
                        id={seriesBodyId}
                        isOpen={!isCollapsed}
                        className="gallery-detail-challenge-card-collapse"
                      >
                      <div className="gallery-detail-challenge-card-body">
                      <div className="gallery-detail-challenge-target">
                        <GalleryStartBoardPreview
                          entry={startBoardPreviewEntry}
                          className="gallery-detail-challenge-start-board"
                        />
                        <div className="gallery-detail-challenge-target-copy">
                          <div className="gallery-detail-challenge-target-heading">
                            <span className="gallery-detail-challenge-target-icon" aria-hidden="true">
                              <Target size={17} strokeWidth={2.5} />
                            </span>
                            <span>{isEstimatedOriginSeries ? (target ? 'Echte Vorlage' : 'Geschätztes Ziel') : 'Vorlage dieser Serie'}</span>
                          </div>
                          {target ? (
                            <div className="gallery-detail-challenge-target-metrics" aria-label="Werte der Challenge-Vorlage">
                              <span>
                                <small>Zeit</small>
                                <strong>{formatTime(target.time)}</strong>
                              </span>
                              <span>
                                <small>Netto-Züge</small>
                                <strong>{target.moves}</strong>
                              </span>
                            </div>
                          ) : estimatedTarget ? (
                            <div className="gallery-detail-challenge-target-metrics" aria-label="Werte des geschätzten Ziels">
                              <span>
                                <small>Zielzeit</small>
                                <strong>{formatTime(estimatedTarget.time)}</strong>
                              </span>
                              <span>
                                <small>Zielzüge</small>
                                <strong>{estimatedTarget.moves}</strong>
                              </span>
                            </div>
                          ) : (
                            <strong>Nicht mehr vorhanden</strong>
                          )}
                          <small>
                            {isEstimatedOriginSeries
                              ? target
                                ? 'Vorlage: erster erfolgreicher cleaner Referenzlauf dieses Startbretts.'
                                : 'Noch keine echte Vorlage vorhanden. Eine Qualifikation kann sie erzeugen.'
                              : target
                              ? `Vorlage: Referenzlauf für ${series.attempts.length} ${series.attempts.length === 1 ? 'Medaillenlauf' : 'Medaillenläufe'} dieses Startbretts.`
                              : 'Historische Challenge-Serie ohne vorhandene Vorlage.'}
                          </small>
                          <button
                            type="button"
                            className="gallery-detail-challenge-replay"
                            disabled={isEstimatedOriginSeries && !target ? !qualificationEntry : (!canReplayTargetStart || !target)}
                            onClick={() => {
                              if (isEstimatedOriginSeries && !target) {
                                if (qualificationEntry) onReplayEntry(qualificationEntry, 'qualification')
                                return
                              }
                              if (!target) return
                              if (canChallengeAgain) {
                                setPendingChallengeTarget(target)
                              } else {
                                onReplayEntry(target, 'run')
                              }
                            }}
                            onKeyDown={handleActionKeyDown}
                            data-app-tooltip={isEstimatedOriginSeries && !target
                              ? qualificationEntry
                                ? 'Startet denselben gespeicherten Startzustand als Qualifikation ohne Medaille.'
                                : 'Noch kein replaybarer Ursprungslauf für diese Schätzung vorhanden.'
                              : canChallengeAgain
                              ? 'Nur diese cleane Vorlage mit demselben gespeicherten Startzustand erneut herausfordern.'
                              : canReplayTargetStart
                                ? 'Dieser Lauf wurde nicht clean gelöst und startet deshalb nur als Übung ohne Medaille.'
                                : 'Die Vorlage kann nicht erneut als Challenge gestartet werden.'}
                            data-app-tooltip-position="top"
                          >
                            {isEstimatedOriginSeries && !target
                              ? 'Qualifikationslauf starten'
                              : canChallengeAgain
                              ? 'Vorlage herausfordern'
                              : canReplayTargetStart
                                ? 'Startzustand üben'
                                : 'Vorlage nicht verfügbar'}
                          </button>
                        </div>
                      </div>

                      {series.preTemplateEntries.length > 0 ? (
                        <div className="gallery-detail-challenge-related-start-state">
                          <div className="gallery-detail-challenge-related-head">
                            <GitBranch aria-hidden="true" size={16} strokeWidth={2.4} />
                            <span>Vor dem echten Ziel</span>
                            <strong>{series.preTemplateEntries.length}</strong>
                          </div>
                          <p>Läufe aus der geschätzten Phase, bevor dieses Startbrett eine echte Vorlage hatte.</p>
                          {isEstimatedOriginSeries && !target && qualificationEntry ? (
                            <button
                              type="button"
                              className="gallery-detail-challenge-related-action is-shared"
                              onClick={() => onReplayEntry(qualificationEntry, 'practice')}
                              onKeyDown={handleActionKeyDown}
                              aria-label={`Startzustand der Challenge-Serie ${seriesIndex + 1} als Übung starten`}
                              data-app-tooltip="Spielt den gespeicherten Startzustand frei als Übung ohne Qualifikation und ohne Medaille."
                              data-app-tooltip-position="top"
                            >
                              Startzustand üben
                            </button>
                          ) : null}
                          <div className="gallery-detail-challenge-related-list">
                            {series.preTemplateEntries.map((preTemplateEntry) => (
                              <div key={preTemplateEntry.id} className="gallery-detail-challenge-related-row">
                                <span className="gallery-detail-challenge-related-node" aria-hidden="true">
                                  <GitBranch size={13} strokeWidth={2.5} />
                                </span>
                                <div>
                                  <span>
                                    {preTemplateEntry.qualificationResult === 'failed'
                                      ? 'Qualifikation gescheitert'
                                      : preTemplateEntry.challengeRunKind === 'qualification'
                                        ? 'Qualifikation'
                                        : 'Soft-Übung'}
                                  </span>
                                  <strong>{formatTime(preTemplateEntry.time)} - {preTemplateEntry.moves} Netto</strong>
                                  <small>{getPreTemplateEntryComment(preTemplateEntry)}</small>
                                  <small>{formatDate(preTemplateEntry.completedAt)} - {formatAssistanceModeLabel(preTemplateEntry.assistanceMode)}</small>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {series.medalHistory.length > 0 ? <div
                        className="gallery-detail-challenge-medal-history"
                        aria-label={`Medaillen-Entwicklung: ${series.medalHistory.map((item) => formatChallengeMedalLabel(item.medal)).join(' zu ')}`}
                      >
                        <div className="gallery-detail-challenge-medal-history-head">
                          <Medal aria-hidden="true" size={16} strokeWidth={2.4} />
                          <span>Medaillen-Entwicklung</span>
                          <strong>{series.medalHistory.length}</strong>
                        </div>
                        <div className="gallery-detail-challenge-medal-history-track">
                          {series.medalHistory.map((item, index) => (
                            <div
                              key={item.attempt.id}
                              className={`gallery-detail-challenge-medal-history-step is-${item.medal} is-${item.trend}`}
                              data-app-tooltip={`Versuch ${item.attemptNumber}: ${formatChallengeMedalLabel(item.medal)}${item.trend === 'upgrade' ? ' - Aufstieg' : item.trend === 'confirmed' ? ' - bestätigt' : item.trend === 'downgrade' ? ' - unter bisherigem Stand' : ''}.`}
                              data-app-tooltip-position="top"
                            >
                              {index > 0 ? <span className="gallery-detail-challenge-medal-history-arrow" aria-hidden="true">→</span> : null}
                              <span className="gallery-detail-challenge-medal-history-node" aria-hidden="true">
                                {getChallengeMedalEmoji(item.medal)}
                              </span>
                              <span className="gallery-detail-challenge-medal-history-copy">
                                <small>Versuch {item.attemptNumber}</small>
                                <strong>{formatChallengeMedalLabel(item.medal)}</strong>
                                {item.trend === 'upgrade' ? <em>Aufstieg</em> : null}
                                {item.trend === 'confirmed' ? <em>Bestätigt</em> : null}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div> : null}

                      <div className="gallery-detail-challenge-attempts">
                        <div className="gallery-detail-challenge-attempts-head">
                          <Trophy aria-hidden="true" size={16} strokeWidth={2.4} />
                          <span>Medaillenläufe</span>
                          <strong>{series.attempts.length}</strong>
                        </div>
                        <div className="gallery-detail-challenge-attempt-list">
                            {rankedAttempts.map((attempt, index) => {
                              const timeDelta = target ? attempt.time - target.time : null
                              const movesDelta = target ? attempt.moves - target.moves : null
                              const isBestAttempt = attempt.id === bestAttempt?.id
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
                                    <small>Gewertet: cleaner Versuch gegen diese Vorlage.</small>
                                  </div>
                                  <div>
                                    <strong>{formatTime(attempt.time)} · {attempt.moves} Netto</strong>
                                    {timeDelta !== null && movesDelta !== null ? (
                                      <small>
                                        {formatChallengeDelta(timeDelta, 'Sek.')} · {formatChallengeDelta(movesDelta, 'Züge')}
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

                      {relatedPracticeEntry ? (
                        <div className="gallery-detail-challenge-related-start-state">
                          <div className="gallery-detail-challenge-related-head">
                            <GitBranch aria-hidden="true" size={16} strokeWidth={2.4} />
                            <span>Weitere Läufe dieses Startbretts</span>
                            <strong>
                              {series.relatedStartStateEntries.length} {series.relatedStartStateEntries.length === 1 ? 'Lauf' : 'Läufe'}
                            </strong>
                          </div>
                          <p>
                            Gleiches Startbrett wie die Vorlage, aber nicht Teil der Medaillenwertung.
                          </p>
                          <button
                            type="button"
                            className="gallery-detail-challenge-related-action is-shared"
                            disabled={!relatedPracticeEntry}
                            onClick={() => {
                              if (relatedPracticeEntry) onReplayEntry(relatedPracticeEntry, 'practice')
                            }}
                            onKeyDown={handleActionKeyDown}
                            aria-label={series.relatedStartStateEntries.length > 0
                              ? 'Gemeinsamen Startzustand der verwandten Läufe üben'
                              : `Startzustand der Challenge-Serie ${seriesIndex + 1} als Übung starten`}
                            data-app-tooltip={relatedPracticeEntry
                              ? 'Spielt den gemeinsamen gespeicherten Startzustand als Übung ohne Medaille.'
                              : 'Gemeinsamer Startzustand ohne verfügbare Bilddaten.'}
                            data-app-tooltip-position="top"
                          >
                            Startzustand üben
                          </button>
                          <div className="gallery-detail-challenge-related-list">
                            {series.relatedStartStateEntries.length > 0 ? series.relatedStartStateEntries.map((relatedEntry) => {
                              const canStartRelatedChallenge = isGalleryChallengeTargetEligible(relatedEntry)
                              const relatedRole = relatedEntry.id === startStateFamilyOriginId
                                ? 'Verwandter Ursprung'
                                : canStartRelatedChallenge
                                  ? 'Alternative cleane Vorlage'
                                  : 'Verwandter Übungslauf'

                              return (
                                <div key={relatedEntry.id} className="gallery-detail-challenge-related-row">
                                  <span className="gallery-detail-challenge-related-node" aria-hidden="true">
                                    <GitBranch size={13} strokeWidth={2.5} />
                                  </span>
                                  <div>
                                    <span>{relatedRole}</span>
                                    <strong>{formatTime(relatedEntry.time)} - {relatedEntry.moves} Netto</strong>
                                    <small>
                                      {formatDate(relatedEntry.completedAt)} - {formatAssistanceModeLabel(relatedEntry.assistanceMode)}
                                    </small>
                                    <small>{getRelatedStartStateEntryComment(relatedEntry, canStartRelatedChallenge)}</small>
                                  </div>
                                </div>
                              )
                            }) : (
                              <div className="gallery-detail-start-state-empty-runs" role="status">
                                Noch keine Übungsläufe für diesen Startzustand.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                      </div>
                      </AnimatedCollapse>
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}

          {startStateSeries.length > 0 ? (
            <section className="gallery-detail-start-state-series" aria-labelledby="gallery-detail-start-state-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-start-state-title" className="saved-games-kicker">Startzustand-Serien</span>
                <p className="gallery-detail-replay-copy">
                  Pro gemeinsamem Startbrett eine Karte; cleane Vorlagen und Serien-Bestwerte stehen in der Laufübersicht zuerst.
                </p>
              </div>

              <div className="gallery-detail-start-state-series-list" data-gallery-detail-action-group="true">
                {startStateSeries.map(renderStartStateSeries)}
              </div>
            </section>
          ) : null}

          {standaloneTimelineEntries.length > 0 ? (
            <section className="gallery-detail-timeline" aria-labelledby="gallery-detail-timeline-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-timeline-title" className="saved-games-kicker">Eigenständige Läufe</span>
                <p className="gallery-detail-replay-copy">
                  Eigene Startzustände ohne Verbindung zu einer bestehenden Challenge- oder Startzustand-Serie.
                </p>
              </div>

              <div className="gallery-detail-timeline-list" data-gallery-detail-action-group="true">
                {standaloneTimelineEntries.map(renderTimelineEntry)}
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
                aria-label={`Galerie-Bild ${formatDifficultyLabel(representativeEntry.config)} vom ${formatDate(representativeEntry.completedAt)} zu einer Sammlung hinzufügen`}
                data-app-tooltip="Dieses Motiv zu einer Sammlung hinzufügen."
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
              data-app-tooltip="Galerie-Detaildialog schließen."
              data-app-tooltip-position="top"
            >
              Schließen
            </button>
          </div>
        </div>
      {pendingChallengeTarget ? (
        <GalleryChallengeStartDialog
          target={pendingChallengeTarget}
          onCancel={() => setPendingChallengeTarget(null)}
          onConfirm={() => {
            const target = pendingChallengeTarget
            setPendingChallengeTarget(null)
            onReplayEntry(target, 'run')
          }}
        />
      ) : null}
    </AnimatedDialog>
  )
}
