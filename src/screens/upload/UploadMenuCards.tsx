import type { FormEvent, KeyboardEvent, MouseEvent, Ref, RefObject } from 'react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import AnimatedCardButton from '../../motion/AnimatedCardButton.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'

interface UploadMenuCardsProps {
  fileInputRef: RefObject<HTMLInputElement>
  promptInputRef?: RefObject<HTMLTextAreaElement>
  primaryActionRef?: Ref<HTMLButtonElement>
  isDragActive: boolean
  isFetchingRandom: boolean
  isGeneratingPromptImage: boolean
  randomQueryValue?: string
  promptValue: string
  onFetchRandomImage: (query?: string) => Promise<void> | void
  onRandomQueryChange?: (value: string) => void
  onPromptValueChange: (value: string) => void
  onGeneratePromptImage: () => Promise<void> | void
}

export default function UploadMenuCards({
  fileInputRef,
  promptInputRef,
  primaryActionRef,
  isDragActive,
  isFetchingRandom,
  isGeneratingPromptImage,
  randomQueryValue = '',
  promptValue,
  onFetchRandomImage,
  onRandomQueryChange = () => undefined,
  onPromptValueChange,
  onGeneratePromptImage,
}: UploadMenuCardsProps) {
  const randomQuery = randomQueryValue

  const handleRandomSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onFetchRandomImage(randomQuery)
  }

  const handleRandomCardClick = (event: MouseEvent<HTMLFormElement>) => {
    if (isFetchingRandom) return
    if (event.target instanceof Element && event.target.closest('input, button, textarea, select, label')) {
      return
    }

    void onFetchRandomImage(randomQuery)
  }

  const handleRandomClear = () => {
    onRandomQueryChange('')
  }

  const handlePromptSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onGeneratePromptImage()
  }

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.key !== 'Enter' && event.key !== 'NumpadEnter') || event.shiftKey) {
      return
    }

    event.preventDefault()
    void onGeneratePromptImage()
  }

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
        <span className="menu-card-glow" aria-hidden="true" />
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

      <form
        className={`menu-card menu-card-random${isFetchingRandom ? ' is-loading' : ''}`}
        onClick={handleRandomCardClick}
        onSubmit={handleRandomSubmit}
      >
        <span className="menu-card-glow" aria-hidden="true" />
        <span className="menu-card-eyebrow">Ueberraschung</span>
        <span className="menu-card-icon" aria-hidden="true">
          <UploadScreenIcon name="dice" className="menu-card-icon-symbol" />
        </span>
        <span className="menu-card-title">
          {isFetchingRandom ? 'Wird geladen...' : 'Zufaelliges Bild'}
        </span>
        <span className="menu-card-desc">Ein ueberraschendes Motiv fuer eine spontane Runde ohne Auswahlstress.</span>
        <label className="random-image-query-label" htmlFor="random-image-query-input">
          Suchbegriffe
        </label>
        <span className="random-image-query-row">
          <span className="random-image-query-field">
            <input
              id="random-image-query-input"
              className="random-image-query-input"
              type="search"
              value={randomQuery}
              onChange={(event) => onRandomQueryChange(event.target.value)}
              placeholder="Leer = echter Zufall"
              disabled={isFetchingRandom}
            />
            <button
              className="random-image-query-clear"
              type="button"
              aria-label="Suchbegriffe loeschen"
              onClick={handleRandomClear}
              disabled={!randomQuery.trim() || isFetchingRandom}
            >
              <UploadScreenIcon name="x" className="random-image-query-clear-icon" />
            </button>
          </span>
        </span>
        <span className="menu-card-hint">Optional nach Motiv, Thema oder Stil suchen.</span>
        <button
          className="menu-card-arrow random-image-submit"
          type="submit"
          aria-label={isFetchingRandom ? 'Zufaelliges Bild wird geladen' : 'Zufaelliges Bild starten'}
          disabled={isFetchingRandom}
        >
          <UploadScreenIcon name="sparkles" className="menu-card-arrow-icon" />
          Direkt starten
        </button>
      </form>

      <form className="menu-card menu-card-prompt" onSubmit={handlePromptSubmit}>
        <span className="menu-card-glow" aria-hidden="true" />
        <span className="menu-card-eyebrow">KI-generiert</span>
        <span className="menu-card-icon" aria-hidden="true">
          <UploadScreenIcon name="sparkles" className="menu-card-icon-symbol" />
        </span>
        <label className="menu-card-title" htmlFor="prompt-image-input">
          Bild per Prompt
        </label>
        <span className="menu-card-desc">
          Beschreibe dein Wunschmotiv. Nano Banana erstellt daraus ein Puzzle-Bild.
        </span>
        <textarea
          ref={promptInputRef}
          id="prompt-image-input"
          data-upload-context="prompt-field"
          className="prompt-image-input"
          value={promptValue}
          onChange={(event) => onPromptValueChange(event.target.value)}
          onKeyDown={handlePromptKeyDown}
          rows={3}
          maxLength={1000}
          placeholder="z. B. leuchtende Berglandschaft bei Sonnenaufgang"
          disabled={isGeneratingPromptImage}
        />
        <button className="menu-card-arrow prompt-image-submit" type="submit" disabled={isGeneratingPromptImage}>
          <UploadScreenIcon name="sparkles" className="menu-card-arrow-icon" />
          {isGeneratingPromptImage ? 'Erstelle...' : 'Bild erstellen'}
        </button>
      </form>
    </AnimatedStaggerGroup>
  )
}
