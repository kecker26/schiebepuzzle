import { Medal, Target, X } from 'lucide-react'
import { useRef } from 'react'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'
import type { SolvedGalleryEntry } from '../../types/index.ts'
import {
  formatChallengeMedalLabel,
  getChallengeMedalEmoji,
  isChallengeDiamondAvailable,
  isChallengeGoldAvailable,
} from '../../utils/galleryChallenge.ts'
import GalleryStartBoardPreview from './GalleryStartBoardPreview.tsx'
import { formatTime } from './uploadUtils.ts'

interface GalleryChallengeStartDialogProps {
  target: SolvedGalleryEntry
  onCancel: () => void
  onConfirm: () => void
}

const MEDAL_RULES = [
  { medal: 'bronze', rule: 'Genau ein Ziel strikt unterbieten' },
  { medal: 'silver', rule: 'Beide Ziele strikt unterbieten' },
  { medal: 'gold', rule: 'Beide Ziele um mindestens 20 % unterbieten' },
  { medal: 'diamond', rule: 'Gold erreichen und exakt solver-optimal loesen' },
] as const

export default function GalleryChallengeStartDialog({
  target,
  onCancel,
  onConfirm,
}: GalleryChallengeStartDialogProps) {
  const startButtonRef = useRef<HTMLButtonElement>(null)
  const challengeTarget = {
    entryId: target.id,
    completedAt: target.completedAt,
    time: target.time,
    moves: target.moves,
    actionMoves: target.actionMoves,
    assistanceMode: target.assistanceMode,
    optimalStartMoveCount: target.replaySetup?.optimalStartMoveCount,
    optimalStartMoveCountKind: target.replaySetup?.optimalStartMoveCountKind,
  }
  const diamondAvailable = isChallengeDiamondAvailable(challengeTarget)
  const goldAvailable = isChallengeGoldAvailable(challengeTarget)

  return (
    <AnimatedDialog
      overlayClassName="gallery-challenge-start-overlay"
      dialogClassName="gallery-challenge-start-dialog"
      titleId="gallery-challenge-start-title"
      descriptionId="gallery-challenge-start-description"
      onClose={onCancel}
      closeOnEscape
      trapFocus
      restoreFocus
      lockScroll
      initialFocusRef={startButtonRef}
    >
      <button
        type="button"
        className="gallery-challenge-start-close"
        onClick={onCancel}
        aria-label="Challenge-Dialog schliessen"
      >
        <X aria-hidden="true" size={18} strokeWidth={2.4} />
      </button>

      <div className="gallery-challenge-start-head">
        <span className="gallery-challenge-start-icon" aria-hidden="true">
          <Target size={24} strokeWidth={2.4} />
        </span>
        <div>
          <span className="saved-games-kicker">Motiv-Challenge</span>
          <h3 id="gallery-challenge-start-title">Vorlage herausfordern</h3>
          <p id="gallery-challenge-start-description">
            Du spielst denselben gespeicherten Startzustand und misst dich direkt mit diesem Lauf.
          </p>
        </div>
      </div>

      <div className="gallery-challenge-start-target">
        <GalleryStartBoardPreview entry={target} className="gallery-challenge-start-board" />
        <div className="gallery-challenge-start-target-metrics" aria-label="Zielwerte der Challenge">
          <span><small>Zielzeit</small><strong>{formatTime(target.time)}</strong></span>
          <span><small>Netto-Zuege</small><strong>{target.moves}</strong></span>
        </div>
      </div>

      <details className="gallery-challenge-start-rules" open>
        <summary>
          <Medal aria-hidden="true" size={17} strokeWidth={2.4} />
          Medaillen-Regeln
        </summary>
        <div className="gallery-challenge-start-rule-list">
          {MEDAL_RULES.map(({ medal, rule }) => (
            <div key={medal} className={`gallery-challenge-start-rule is-${medal}`}>
              <span aria-hidden="true">{getChallengeMedalEmoji(medal)}</span>
              <strong>{formatChallengeMedalLabel(medal)}</strong>
              <small>{rule}</small>
            </div>
          ))}
        </div>
      </details>

      <p className="gallery-challenge-start-note" role="note">
        Jede Medaille setzt einen absolut cleanen Lauf voraus.
      </p>

      {!goldAvailable ? (
        <p className="gallery-challenge-start-note" role="note">
          Gold und Diamant sind fuer diese Vorlage nicht erreichbar: Das exakte Solver-Optimum liegt ueber dem
          20-Prozent-Zugziel.
        </p>
      ) : !diamondAvailable ? (
        <p className="gallery-challenge-start-note" role="note">
          Diamant ist bei diesem Puzzle nicht verfuegbar, weil keine exakte optimale Zugzahl berechnet werden konnte.
        </p>
      ) : null}

      <div className="gallery-challenge-start-actions">
        <AnimatedButton className="secondary" onClick={onCancel}>Abbrechen</AnimatedButton>
        <AnimatedButton ref={startButtonRef} onClick={onConfirm} data-page-primary-focus="true">
          Challenge starten
        </AnimatedButton>
      </div>
    </AnimatedDialog>
  )
}
