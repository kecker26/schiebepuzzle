import type { RefObject } from 'react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import { FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE } from '../../app/focusVisibility.ts'
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
  activeTagFilterCount: number
  activeTagFilterLabel: string | null
  activeTagFilterKeys: string[]
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
  onSortOptionChange: (value: GallerySortOption) => void
  onTagFilterToggle: (tagKey: string) => void
  onClearTagFilters: () => void
  onCreateCollectionFromTag: () => void
  onManageTags: () => void
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
  activeTagFilterCount,
  activeTagFilterLabel,
  activeTagFilterKeys,
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
  onSortOptionChange,
  onTagFilterToggle,
  onClearTagFilters,
  onCreateCollectionFromTag,
  onManageTags,
  onReset,
  difficultySelectRef,
  assistanceSelectRef,
  sortSelectRef,
  resetButtonRef,
}: UploadGalleryToolbarProps) {
  const hasSingleActiveTag = activeTagFilterCount === 1 && activeTagFilterLabel !== null
  const hasActiveTagCollection = hasSingleActiveTag && activeTagCollectionCount > 0
  const activeTagKeySet = new Set(activeTagFilterKeys)
  const hasActiveCriteria =
    difficultyFilter !== 'all' ||
    assistanceFilter !== 'all' ||
    activeTagFilterCount > 0 ||
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
        <label
          className="gallery-toolbar-field"
          data-app-tooltip="Galerie auf eine Puzzle-Schwierigkeit einschraenken."
          data-app-tooltip-align="start"
        >
          <span>Schwierigkeit</span>
          <select
            ref={difficultySelectRef}
            value={difficultyFilter}
            onKeyDown={handleSelectEnterKeyDown}
            onChange={(event) => onDifficultyFilterChange(event.target.value as GalleryDifficultyFilter)}
            data-app-tooltip="Galerie auf eine Puzzle-Schwierigkeit einschraenken."
            data-app-tooltip-align="start"
          >
            {difficultyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label
          className="gallery-toolbar-field"
          data-app-tooltip="Nach cleanen, unterstuetzten oder Legacy-Laeufen filtern."
          data-app-tooltip-align="start"
        >
          <span>Laufart</span>
          <select
            ref={assistanceSelectRef}
            value={assistanceFilter}
            onKeyDown={handleSelectEnterKeyDown}
            onChange={(event) => onAssistanceFilterChange(event.target.value as GalleryAssistanceFilter)}
            data-app-tooltip="Nach cleanen, unterstuetzten oder Legacy-Laeufen filtern."
            data-app-tooltip-align="start"
          >
            {GALLERY_ASSISTANCE_FILTER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label
          className="gallery-toolbar-field"
          data-app-tooltip="Reihenfolge der sichtbaren Galerie-Motive festlegen."
          data-app-tooltip-align="start"
        >
          <span>Sortierung</span>
          <select
            ref={sortSelectRef}
            value={sortOption}
            onKeyDown={handleSelectEnterKeyDown}
            onChange={(event) => onSortOptionChange(event.target.value as GallerySortOption)}
            data-app-tooltip="Reihenfolge der sichtbaren Galerie-Motive festlegen."
            data-app-tooltip-align="start"
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
          data-app-tooltip={
            activeTagFilterLabel
              ? `Sammlung aus #${activeTagFilterLabel} erstellen.`
              : activeTagFilterCount > 1
                ? 'Nur fuer einen einzelnen KI-Tag verfuegbar.'
                : 'Waehle zuerst einen KI-Tag.'
          }
          data-app-tooltip-position="top"
        >
          {isCreatingTagCollection ? 'Sortiere ...' : tagCollectionActionLabel}
        </button>

        <button
          type="button"
          className="secondary gallery-toolbar-tag-manager"
          onClick={onManageTags}
          disabled={!canManageTags}
          data-app-tooltip="KI-Tags durchsuchen, kombinieren und als Galerie-Filter anwenden."
          data-app-tooltip-position="top"
        >
          Tags verwalten
        </button>

        <button
          ref={resetButtonRef}
          type="button"
          className="secondary gallery-toolbar-reset"
          onClick={onReset}
          disabled={!hasActiveCriteria}
          data-app-tooltip="Alle Galerie-Filter und Sortierung auf Standard zuruecksetzen."
          data-app-tooltip-position="top"
        >
          Zuruecksetzen
        </button>
      </div>

      {activeTagFilterCount > 0 ? (
        <div className="gallery-toolbar-tag-chips" aria-label="KI-Tags als UND-Filter">
          <div className="gallery-toolbar-tag-chips-header">
            <span>Tags</span>
            <small>{`${activeTagFilterCount} aktiv`}</small>
          </div>
          <div className="gallery-toolbar-tag-chip-list" onKeyDown={handleDirectionalFocusNavigation}>
            {tagOptions.map((tagOption) => {
              const isActive = activeTagKeySet.has(tagOption.id)

              return (
                <button
                  key={tagOption.id}
                  type="button"
                  className="gallery-toolbar-tag-chip"
                  {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-toolbar-tag-chips' }}
                  aria-pressed={isActive}
                  aria-label={`Tag #${tagOption.label} ${isActive ? 'entfernen' : 'hinzufuegen'}, ${tagOption.count} ${tagOption.count === 1 ? 'Motiv' : 'Motive'}`}
                  onClick={() => onTagFilterToggle(tagOption.id)}
                  data-app-tooltip={`${isActive ? 'Tag aus dem UND-Filter entfernen' : 'Tag zum UND-Filter hinzufuegen'}: #${tagOption.label}.`}
                  data-app-tooltip-position="top"
                >
                  <span>#{tagOption.label}</span>
                  <small>{tagOption.count}</small>
                </button>
              )
            })}
            {activeTagFilterCount > 0 ? (
              <button
                type="button"
                className="gallery-toolbar-tag-chip gallery-toolbar-tag-chip-clear"
                {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-toolbar-tag-chips' }}
                onClick={onClearTagFilters}
                data-app-tooltip="Alle aktiven KI-Tag-Filter entfernen."
                data-app-tooltip-position="top"
              >
                Tags zuruecksetzen
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
