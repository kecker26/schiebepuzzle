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

export interface GalleryTagFilterOption {
  id: string
  label: string
  count: number
  entryIds?: string[]
}

interface UploadGalleryToolbarProps {
  difficultyFilter: GalleryDifficultyFilter
  difficultyOptions: GallerySelectOption<GalleryDifficultyFilter>[]
  assistanceFilter: GalleryAssistanceFilter
  tagFilter: string
  tagOptions: GalleryTagFilterOption[]
  sortOption: GallerySortOption
  visibleCount: number
  totalCount: number
  activeTagCollectionCount: number
  tagCollectionActionLabel: string
  isCreatingTagCollection: boolean
  canManageTags: boolean
  onDifficultyFilterChange: (value: GalleryDifficultyFilter) => void
  onAssistanceFilterChange: (value: GalleryAssistanceFilter) => void
  onTagFilterChange: (value: string) => void
  onSortOptionChange: (value: GallerySortOption) => void
  onCreateCollectionFromTag: () => void
  onManageTags: () => void
  onReset: () => void
  difficultySelectRef?: RefObject<HTMLSelectElement>
  assistanceSelectRef?: RefObject<HTMLSelectElement>
  tagSelectRef?: RefObject<HTMLSelectElement>
  sortSelectRef?: RefObject<HTMLSelectElement>
  resetButtonRef?: RefObject<HTMLButtonElement>
}

export default function UploadGalleryToolbar({
  difficultyFilter,
  difficultyOptions,
  assistanceFilter,
  tagFilter,
  tagOptions,
  sortOption,
  visibleCount,
  totalCount,
  activeTagCollectionCount,
  tagCollectionActionLabel,
  isCreatingTagCollection,
  canManageTags,
  onDifficultyFilterChange,
  onAssistanceFilterChange,
  onTagFilterChange,
  onSortOptionChange,
  onCreateCollectionFromTag,
  onManageTags,
  onReset,
  difficultySelectRef,
  assistanceSelectRef,
  tagSelectRef,
  sortSelectRef,
  resetButtonRef,
}: UploadGalleryToolbarProps) {
  const activeTagOption = tagOptions.find((option) => option.id === tagFilter) ?? null
  const hasActiveTagCollection = tagFilter !== 'all' && activeTagCollectionCount > 0
  const hasActiveCriteria =
    difficultyFilter !== 'all' ||
    assistanceFilter !== 'all' ||
    tagFilter !== 'all' ||
    sortOption !== 'latest'

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

        <label className="gallery-toolbar-field gallery-toolbar-field-tag">
          <span>KI-Tag</span>
          <select
            ref={tagSelectRef}
            value={tagFilter}
            onKeyDown={handleSelectEnterKeyDown}
            onChange={(event) => onTagFilterChange(event.target.value)}
            disabled={tagOptions.length === 0}
          >
            <option value="all">Alle Tags</option>
            {tagOptions.map((option) => (
              <option key={option.id} value={option.id}>
                #{option.label} ({option.count})
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
          type="button"
          className="secondary gallery-toolbar-tag-collection"
          onClick={onCreateCollectionFromTag}
          disabled={!hasActiveTagCollection || isCreatingTagCollection}
          title={
            activeTagOption
              ? `Sammlung fuer #${activeTagOption.label} mit ${activeTagCollectionCount} Motiven erstellen`
              : 'Waehle zuerst einen KI-Tag'
          }
        >
          {isCreatingTagCollection ? 'Sortiere ...' : tagCollectionActionLabel}
        </button>

        <button
          type="button"
          className="secondary gallery-toolbar-tag-manager"
          onClick={onManageTags}
          disabled={!canManageTags}
        >
          Tags verwalten
        </button>

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
