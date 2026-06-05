import { AnimatePresence } from 'motion/react'
import { type CSSProperties, useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import MusicVolumeControl from '../../components/MusicVolumeControl.tsx'
import PuzzleScreenIcon from '../../components/PuzzleScreenIcon.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedReveal from '../../motion/AnimatedReveal.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'
import audioService, {
  type MusicAttributionSnapshot,
  type MusicPlaybackStatusSnapshot,
} from '../../services/AudioService.ts'
import { PuzzleContextHint } from '../../services/PuzzleEngine.ts'
import { type PuzzleProgressMetrics } from '../../services/PuzzleSolver.ts'
import { getMusicStyleDefinition, type MusicStyleId } from '../../services/musicStyles.ts'

interface PuzzleRightPanelProps {
  image: string
  config: { rows: number; cols: number }
  imageRatio: number | null
  difficultyLabel: string
  playableTileCount: number
  isPreviewVisible: boolean
  progressMetrics: PuzzleProgressMetrics | null
  contextHint: PuzzleContextHint | null
  highlightedReferenceIndex: number | null
  onReferenceTileHover: (correctIndex: number | null) => void
}

function useMusicMuted(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return audioService.subscribeToMusicMuted(onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => audioService.getMusicMuted(), [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

function useMusicAttribution(): MusicAttributionSnapshot {
  const [attribution, setAttribution] = useState(() => audioService.getMusicAttributionSnapshot())

  useEffect(() => {
    const unsubscribe = audioService.subscribeToMusicAttribution(() => {
      setAttribution(audioService.getMusicAttributionSnapshot())
    })
    return unsubscribe
  }, [])

  return attribution
}

function useSelectedMusicStyle(): MusicStyleId {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return audioService.subscribeToSelectedMusicStyle(onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => audioService.getSelectedMusicStyle(), [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

function useMusicPlaybackStatus(): MusicPlaybackStatusSnapshot {
  const [status, setStatus] = useState(() => audioService.getMusicPlaybackStatusSnapshot())

  useEffect(() => {
    const unsubscribe = audioService.subscribeToMusicPlaybackStatus(() => {
      setStatus(audioService.getMusicPlaybackStatusSnapshot())
    })
    return unsubscribe
  }, [])

  return status
}

export default function PuzzleRightPanel({
  image,
  config,
  imageRatio,
  difficultyLabel,
  playableTileCount,
  isPreviewVisible,
  progressMetrics,
  contextHint,
  highlightedReferenceIndex,
  onReferenceTileHover,
}: PuzzleRightPanelProps) {
  const isMusicMuted = useMusicMuted()
  const musicAttribution = useMusicAttribution()
  const musicPlaybackStatus = useMusicPlaybackStatus()
  const selectedMusicStyle = useSelectedMusicStyle()
  const selectedMusicStyleDefinition = getMusicStyleDefinition(selectedMusicStyle)
  const totalTileCount = config.rows * config.cols
  const emptyTileIndex = totalTileCount - 1
  const referenceTileIndexes = Array.from({ length: totalTileCount }, (_, index) => index)
  const maxPreviewGridSize = Math.max(config.rows, config.cols)
  const previewAspectRatio = imageRatio && imageRatio > 0 ? imageRatio : config.cols / config.rows
  const previewRatioStyle = {
    '--preview-ratio': String(previewAspectRatio),
  } as CSSProperties

  const handleToggleMusic = () => {
    audioService.setMusicMuted(!isMusicMuted)
  }

  const hasTrackInfo =
    !isMusicMuted &&
    Boolean(musicAttribution.title) &&
    Boolean(musicAttribution.artist) &&
    (musicPlaybackStatus.state === 'playing' || musicPlaybackStatus.state === 'fallback')

  return (
    <aside
      className={'puzzle-side-panel puzzle-side-panel-right' + (isPreviewVisible ? '' : ' is-preview-collapsed')}
      aria-label="Referenzbild, Strategiefokus und Musik"
    >
      <AnimatedStaggerGroup className="puzzle-preview-panel" level="medium">
        <AnimatedReveal
          className={'puzzle-preview-reference' + (isPreviewVisible ? '' : ' is-hidden')}
          aria-hidden={!isPreviewVisible}
          interaction="surface"
          level="medium"
        >
          <div className="puzzle-preview-reference-header">
            <span className="puzzle-panel-kicker">
              <span className="puzzle-panel-kicker-icon-shell" aria-hidden="true">
                <PuzzleScreenIcon name="image" className="puzzle-panel-kicker-icon" />
              </span>
              <span className="puzzle-preview-kicker">Referenz</span>
            </span>
            <div className="puzzle-panel-title-row">
              <h4>Zielbild</h4>
            </div>
          </div>
          <div className="puzzle-preview-frame">
            <div
              className="puzzle-preview-image-shell"
              style={previewRatioStyle}
              onMouseLeave={() => onReferenceTileHover(null)}
              data-app-tooltip="Mit der Maus ueber Bildbereiche fahren, um die passende Kachel auf dem Brett hervorzuheben."
              data-app-tooltip-align="end"
            >
              <img src={image} alt="Zielbild Vorschau" className="puzzle-preview-image" />
              <div
                className={
                  'puzzle-preview-grid'
                  + (maxPreviewGridSize >= 6 ? ' is-dense' : maxPreviewGridSize >= 5 ? ' is-compact' : '')
                }
                style={{
                  gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${config.rows}, minmax(0, 1fr))`,
                }}
              >
                {referenceTileIndexes.map((index) => {
                  const isEmptyTile = index === emptyTileIndex

                  return (
                    <div
                      key={index}
                      className={
                        'puzzle-preview-grid-tile'
                        + (highlightedReferenceIndex === index ? ' is-active' : '')
                        + (isEmptyTile ? ' is-empty' : '')
                      }
                      style={{
                        gridRow: Math.floor(index / config.cols) + 1,
                        gridColumn: (index % config.cols) + 1,
                      }}
                      onMouseEnter={() => {
                        if (!isEmptyTile) onReferenceTileHover(index)
                      }}
                      aria-hidden="true"
                    />
                  )
                })}
              </div>
            </div>
          </div>
          <div className="puzzle-preview-meta">
            <span className="puzzle-preview-chip">{difficultyLabel}</span>
            <span className="puzzle-preview-chip">{playableTileCount} Teile</span>
          </div>
          <p className="puzzle-preview-copy">
            {progressMetrics
              ? `${progressMetrics.correctTiles} Kacheln stimmen bereits. Fahre rechts mit der Maus ueber einen Bildausschnitt, um die passende Kachel links zu finden.`
              : 'Fahre rechts mit der Maus ueber einen Bildausschnitt, um die passende Kachel links hervorzuheben.'}
          </p>
        </AnimatedReveal>

        <div className="puzzle-preview-supporting">
          <AnimatePresence initial={false}>
            {contextHint && (
              <AnimatedReveal
                key={`${contextHint.title}-${contextHint.reason}-${contextHint.anchorLabel}`}
                className={'puzzle-preview-insight' + (isPreviewVisible ? '' : ' puzzle-preview-insight--promoted')}
                aria-live="polite"
                interaction="surface"
                level="medium"
              >
                <span className="puzzle-panel-kicker">
                  <span className="puzzle-panel-kicker-icon-shell" aria-hidden="true">
                    <PuzzleScreenIcon name="brain" className="puzzle-panel-kicker-icon" />
                  </span>
                  <span className="puzzle-preview-insight-kicker">Strategischer Fokus</span>
                </span>
                <div className="puzzle-panel-title-row puzzle-panel-title-row--compact">
                  <strong>{contextHint.title}</strong>
                </div>
                <p>{contextHint.body}</p>
                <div
                  className="puzzle-preview-insight-reason"
                  role="note"
                  aria-label={`Warum diese Strategie? ${contextHint.reason}`}
                  data-app-tooltip="Begruendet, warum dieser Fokus gerade nuetzlich ist."
                  data-app-tooltip-align="end"
                >
                  <span className="puzzle-preview-insight-reason-chip">Warum?</span>
                  <span className="puzzle-preview-insight-reason-copy">{contextHint.reason}</span>
                </div>
                <div className="puzzle-preview-meta">
                  <span className="puzzle-preview-chip">{contextHint.focusLabel}</span>
                  <span className="puzzle-preview-chip">{contextHint.anchorLabel}</span>
                  <span className="puzzle-preview-chip">{contextHint.stabilityLabel}</span>
                </div>
              </AnimatedReveal>
            )}
          </AnimatePresence>

          <AnimatedReveal className="puzzle-music-card" interaction="surface" level="subtle" aria-live="polite">
            <div className="puzzle-music-card-header">
              <span className="puzzle-panel-kicker">
                <span className="puzzle-panel-kicker-icon-shell" aria-hidden="true">
                  <PuzzleScreenIcon name="music" className="puzzle-panel-kicker-icon" />
                </span>
                <span className="puzzle-preview-insight-kicker">Musik</span>
              </span>
              <AnimatedButton
                className={`puzzle-music-toggle${isMusicMuted ? '' : ' is-active'}`}
                onClick={handleToggleMusic}
                aria-label={isMusicMuted ? 'Musik einschalten' : 'Musik ausschalten'}
                data-app-tooltip={isMusicMuted ? 'Musik fuer die Runde einschalten.' : 'Musik fuer die Runde ausschalten.'}
                data-app-tooltip-align="end"
                reveal
                revealLevel="subtle"
              >
                <span className="puzzle-music-toggle-icon" aria-hidden="true">
                  {isMusicMuted ? '🔇' : '🔊'}
                </span>
                <span className="puzzle-music-toggle-label">{isMusicMuted ? 'Aus' : 'An'}</span>
              </AnimatedButton>
            </div>
            <MusicVolumeControl variant="panel" />
            {hasTrackInfo && (
              <div className="puzzle-music-track-info">
                <span className="puzzle-music-track-style">{selectedMusicStyleDefinition.label}</span>
                <span className="puzzle-music-track-title">{musicAttribution.title}</span>
                <span className="puzzle-music-track-artist">{musicAttribution.artist}</span>
                <span className="puzzle-music-track-status">
                  {musicPlaybackStatus.message}
                  {musicPlaybackStatus.providerLabel ? ` · ${musicPlaybackStatus.providerLabel}` : ''}
                  {musicAttribution.licenseLabel ? ` · ${musicAttribution.licenseLabel}` : ''}
                </span>
                {(musicAttribution.trackUrl ?? musicAttribution.providerUrl) && (
                  <a
                  className="puzzle-music-track-provider"
                  href={musicAttribution.trackUrl ?? musicAttribution.providerUrl ?? undefined}
                  tabIndex={-1}
                  target="_blank"
                  rel="noreferrer"
                  data-app-tooltip="Quelle und Lizenzinformationen zum aktuell abgespielten Track oeffnen."
                  data-app-tooltip-align="end"
                >
                    via {musicAttribution.providerLabel ?? 'Quelle'}
                  </a>
                )}
              </div>
            )}
            {!hasTrackInfo && (
              <div className="puzzle-music-track-info">
                <span className="puzzle-music-track-style">{selectedMusicStyleDefinition.label}</span>
                <span className="puzzle-music-track-artist">{musicPlaybackStatus.message}</span>
                {musicPlaybackStatus.detail && (
                  <span className="puzzle-music-track-status">{musicPlaybackStatus.detail}</span>
                )}
              </div>
            )}
          </AnimatedReveal>
        </div>
      </AnimatedStaggerGroup>
    </aside>
  )
}
