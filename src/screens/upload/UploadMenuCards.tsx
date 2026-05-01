import type { Ref, RefObject } from 'react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import AnimatedCardButton from '../../motion/AnimatedCardButton.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'

interface UploadMenuCardsProps {
  fileInputRef: RefObject<HTMLInputElement>
  primaryActionRef?: Ref<HTMLButtonElement>
  isDragActive: boolean
  isFetchingRandom: boolean
  onFetchRandomImage: () => Promise<void> | void
}

export default function UploadMenuCards({
  fileInputRef,
  primaryActionRef,
  isDragActive,
  isFetchingRandom,
  onFetchRandomImage,
}: UploadMenuCardsProps) {
  return (
    <AnimatedStaggerGroup className="menu-grid" level="medium" onKeyDown={handleDirectionalFocusNavigation}>
      <AnimatedCardButton
        ref={primaryActionRef}
        className={`menu-card menu-card-upload${isDragActive ? ' is-drop-target' : ''}`}
        data-upload-context="image-card"
        data-page-primary-focus="true"
        onClick={() => fileInputRef.current?.click()}
        reveal
        revealLevel="medium"
      >
        <span className="menu-card-eyebrow">{isDragActive ? 'Datei erkannt' : 'Eigenes Motiv'}</span>
        <span className="menu-card-icon" aria-hidden="true">
          <UploadScreenIcon name={isDragActive ? 'uploadCloud' : 'imagePlus'} className="menu-card-icon-symbol" />
        </span>
        <span className="menu-card-title">{isDragActive ? 'Bild hier ablegen' : 'Foto hochladen'}</span>
        <span className="menu-card-desc">
          {isDragActive
            ? 'Die Bilddatei wird nach dem Loslassen direkt vorbereitet und in den Zuschnitt uebernommen.'
            : 'Waehle ein Bild von deinem Geraet und starte damit sofort ein Puzzle.'}
        </span>
        <span className="menu-card-hint">
          {isDragActive
            ? 'Unterstuetzt werden gaengige Bilddateien wie JPG, PNG, WebP oder GIF.'
            : 'Klicken, Datei hineinziehen oder mit Strg+V einfuegen.'}
        </span>
        <span className="menu-card-arrow">
          <UploadScreenIcon name="mousePointerClick" className="menu-card-arrow-icon" />
          {isDragActive ? 'Jetzt ablegen' : 'Foto auswaehlen'}
        </span>
      </AnimatedCardButton>

      <AnimatedCardButton
        className="menu-card menu-card-random"
        onClick={onFetchRandomImage}
        disabled={isFetchingRandom}
        reveal
        revealLevel="medium"
      >
        <span className="menu-card-eyebrow">Ueberraschung</span>
        <span className="menu-card-icon" aria-hidden="true">
          <UploadScreenIcon name="dice" className="menu-card-icon-symbol" />
        </span>
        <span className="menu-card-title">
          {isFetchingRandom ? 'Wird geladen...' : 'Zufaelliges Bild'}
        </span>
        <span className="menu-card-desc">Ein ueberraschendes Motiv fuer eine spontane Runde ohne Auswahlstress.</span>
        <span className="menu-card-hint">Perfekt fuer schnelle Abwechslung und neue Motive.</span>
        <span className="menu-card-arrow">
          <UploadScreenIcon name="sparkles" className="menu-card-arrow-icon" />
          Direkt starten
        </span>
      </AnimatedCardButton>
    </AnimatedStaggerGroup>
  )
}
