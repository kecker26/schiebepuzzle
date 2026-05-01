import type { RefObject } from 'react'
import {
  GALLERY_ASSISTANCE_FILTER_OPTIONS,
  GALLERY_SORT_OPTIONS,
  GalleryAssistanceFilter,
  GalleryDifficultyFilter,
  GallerySelectOption,
  GallerySortOption,
} from './uploadUtils.ts'
import { handleSelectEnterKeyDown } from '../../app/formControlUtils.ts'

interface UploadGalleryToolbarProps {
  difficultyFilter: GalleryDifficultyFilter
  difficultyOptions: GallerySelectOption<GalleryDifficultyFilter>[]
  assistanceFilter: GalleryAssistanceFilter
  sortOption: GallerySortOption
  visibleCount: number
  totalCount: number
  onDifficultyFilterChange: (value: GalleryDifficultyFilter) => void
  onAssistanceFilterChange: (value: GalleryAssistanceFilter) => void
  onSortOptionChange: (value: GallerySortOption) => void
  onReset: () => void
  difficultySelectRef?: RefObject<HTMLSelectElement>
  assistanceSelectRef?: RefObject<HTMLSelectElement>
  sortSelectRef?: RefObject<HTMLSelectElement>
  resetButtonRef?: RefObject<HTMLButtonElement>
}

export default function UploadGalleryToolbar({
  difficultyFilter,
  difficultyOptions,
  assistanceFilter,
  sortOption,
  visibleCount,
  totalCount,
  onDifficultyFilterChange,
  onAssistanceFilterChange,
  onSortOptionChange,
  onReset,
  difficultySelectRef,
  assistanceSelectRef,
  sortSelectRef,
  resetButtonRef,
}: UploadGalleryToolbarProps) {
  const hasActiveCriteria = difficultyFilter !== 'all' || assistanceFilter !== 'all' || sortOption !== 'latest'

  return (
    <div className="gallery-toolbar" role="group" aria-label="Galerie filtern und sortieren">
      <div className="gallery-toolbar-summary">
        <strong className="gallery-toolbar-count">
          {visibleCount} von {totalCount} Motiven sichtbar
        </strong>
        <span className="gallery-toolbar-copy">
          Gleiches Motiv auf derselben Schwierigkeit wird als eine Karte zusammengefasst. Auf anderen Stufen bleibt es separat sichtbar.
        </span>
      </div>

      <div className="gallery-toolbar-controls">
        <label className="gallery-toolbar-field">
          <span>Schwierigkeit</span>
          <select
            ref={difficultySelectRef}
            value={difficultyFilter}
            onKeyDown={handleSelectEnterKeyDown}
            onChange={(event) => onDifficultyFilterChange(event.target.value as GalleryDifficultyFilter)}
          >
            {difficultyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="gallery-toolbar-field">
          <span>Laufart</span>
          <select
            ref={assistanceSelectRef}
            value={assistanceFilter}
            onKeyDown={handleSelectEnterKeyDown}
            onChange={(event) => onAssistanceFilterChange(event.target.value as GalleryAssistanceFilter)}
          >
            {GALLERY_ASSISTANCE_FILTER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="gallery-toolbar-field">
          <span>Sortierung</span>
          <select
            ref={sortSelectRef}
            value={sortOption}
            onKeyDown={handleSelectEnterKeyDown}
            onChange={(event) => onSortOptionChange(event.target.value as GallerySortOption)}
          >
            {GALLERY_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          ref={resetButtonRef}
          type="button"
          className="secondary gallery-toolbar-reset"
          onClick={onReset}
          disabled={!hasActiveCriteria}
        >
          Zuruecksetzen
        </button>
      </div>
    </div>
  )
}
