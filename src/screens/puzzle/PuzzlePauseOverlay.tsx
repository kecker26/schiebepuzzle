import { useEffect, useRef } from 'react'
import PuzzleScreenIcon from '../../components/PuzzleScreenIcon.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import { formatElapsedTime } from './puzzleScreenUtils.ts'

interface PuzzlePauseOverlayProps {
  elapsedTime: number
  onResume: () => void
}

export default function PuzzlePauseOverlay({
  elapsedTime,
  onResume,
}: PuzzlePauseOverlayProps) {
  const resumeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    resumeButtonRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div
      className="puzzle-pause-overlay"
      role="dialog"
      aria-labelledby="puzzle-pause-title"
      aria-describedby="puzzle-pause-description"
    >
      <span className="puzzle-pause-icon-shell" aria-hidden="true">
        <PuzzleScreenIcon name="pause" className="puzzle-pause-icon" />
      </span>
      <span className="puzzle-pause-kicker">Timer angehalten</span>
      <h3 id="puzzle-pause-title">Puzzle pausiert</h3>
      <p id="puzzle-pause-description">
        Brett und Zielbild bleiben verdeckt, bis du die Runde fortsetzt.
      </p>
      <span className="puzzle-pause-time">{formatElapsedTime(elapsedTime)}</span>
      <AnimatedButton
        ref={resumeButtonRef}
        className="puzzle-tool-primary puzzle-pause-resume"
        onClick={onResume}
        aria-keyshortcuts="P"
        data-puzzle-allow-hotkeys="true"
        reveal
        revealLevel="medium"
      >
        <PuzzleScreenIcon name="play" />
        <span>Weiterspielen</span>
        <span className="puzzle-button-hotkey" aria-hidden="true">P</span>
      </AnimatedButton>
    </div>
  )
}
