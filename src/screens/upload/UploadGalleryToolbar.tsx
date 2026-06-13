import type { RefObject } from 'react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import { FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE } from '../../app/focusVisibility.ts'
import {
  GALLERY_ASSISTANCE_FILTER_OPTIONS,
  GALLERY_MEDAL_HUNT_FILTER_OPTIONS,
  GALLERY_SORT_OPTIONS,
  GalleryAssistanceFilter,
  GalleryDifficultyFilter,
  GalleryMedalHuntFilter,
  GallerySelectOption,
  GallerySortOption,
} from './uploadUtils.ts'
import { handleSelectEnterKeyDown } from '../../app/formControlUtils.ts'
import AnimatedButton from '../../motion/AnimatedButton.tsx'

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
  medalHuntFilter: GalleryMedalHuntFilter
  hasActiveMedalFilter: boolean
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
  onMedalHuntFilterChange: (value: GalleryMedalHuntFilter) => void
  onSortOptionChange: (value: GallerySortOption) => void
  onTagFilterToggle: (tagKey: string) => void
  onClearTagFilters: () => void
  onCreateCollectionFromTag: () => void
  onManageTags: () => void
  onReset: () => void
  difficultySelectRef?: RefObject<HTMLSelectElement>
  assistanceSelectRef?: RefObject<HTMLSelectElement>
  medalHuntSelectRef?: RefObject<HTMLSelectElement>
  sortSelectRef?: RefObject<HTMLSelectElement>
  resetButtonRef?: RefObject<HTMLButtonElement>
}

export default function UploadGalleryToolbar({
  difficultyFilter,
  difficultyOptions,
  assistanceFilter,
  medalHuntFilter,
  hasActiveMedalFilter,
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
  onMedalHuntFilterChange,
  onSortOptionChange,
  onTagFilterToggle,
  onClearTagFilters,
  onCreateCollectionFromTag,
  onManageTags,
  onReset,
  difficultySelectRef,
  assistanceSelectRef,
  medalHuntSelectRef,
  sortSelectRef,
  resetButtonRef,
}: UploadGalleryToolbarProps) {
  const hasSingleActiveTag = activeTagFilterCount === 1 && activeTagFilterLabel !== null
  const hasActiveTagCollection = hasSingleActiveTag && activeTagCollectionCount > 0
  const activeTagKeySet = new Set(activeTagFilterKeys)
  const activeMedalHuntOption = GALLERY_MEDAL_HUNT_FILTER_OPTIONS.find((option) => option.id === medalHuntFilter)
  const isUpgradePotentialSort = sortOption === 'upgrade-potential'
  const medalHuntSummary = medalHuntFilter !== 'all'
    ? {
        title: activeMedalHuntOption?.label ?? 'Medaillen-Jagd',
        detail: medalHuntFilter === 'near-upgrade'
          ? 'Die Karten zeigen deine aussichtsreichsten direkten Upgrades.'
          : medalHuntFilter === 'no-medal'
            ? 'Diese Motive warten noch auf ihre erste Challenge-Medaille.'
            : medalHuntFilter === 'no-gold'
              ? 'Diese Motive haben noch keine Gold- oder Diamant-Medaille.'
              : 'Diese Motive besitzen noch eine erreichbare naechste Medaillenstufe.',
      }
    : isUpgradePotentialSort
      ? {
          title: 'Bestes Upgrade-Potenzial',
          detail: 'Upgradefaehige Motive und besonders nahe Ziele stehen zuerst.',
        }
      : null
  const hasActiveCriteria =
    difficultyFilter !== 'all' ||
    assistanceFilter !== 'all' ||
    medalHuntFilter !== 'all' ||
    hasActiveMedalFilter ||
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

      {medalHuntSummary ? (
        <div className="gallery-toolbar-medal-hunt-status" role="status">
          <span className="gallery-toolbar-medal-hunt-mark" aria-hidden="true">{'\u{1F3AF}'}</span>
          <span>
            <small>Medaillen-Jagd aktiv</small>
            <strong>{medalHuntSummary.title}</strong>
            <span>{medalHuntSummary.detail}</span>
          </span>
        </div>
      ) : null}

      <div className="gallery-toolbar-controls">
        <div className="gallery-toolbar-filters">
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
            data-app-tooltip="Motive fuer die naechste Medaillen-Jagd eingrenzen."
            data-app-tooltip-align="start"
          >
            <span>Medaillen-Jagd</span>
            <select
              ref={medalHuntSelectRef}
              value={medalHuntFilter}
              onKeyDown={handleSelectEnterKeyDown}
              onChange={(event) => onMedalHuntFilterChange(event.target.value as GalleryMedalHuntFilter)}
              data-app-tooltip="Motive ohne Medaille, ohne Gold oder mit nahem Upgrade anzeigen."
              data-app-tooltip-align="start"
            >
              {GALLERY_MEDAL_HUNT_FILTER_OPTIONS.map((option) => (
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
        </div>

        <div className="gallery-toolbar-actions">
          <AnimatedButton
            className="secondary gallery-toolbar-tag-collection"
            onClick={onCreateCollectionFromTag}
            disabled={!hasActiveTagCollection}
            busy={isCreatingTagCollection}
            busyLabel="Sortiere Motive ..."
            data-app-tooltip={
              activeTagFilterLabel
                ? `Sammlung aus #${activeTagFilterLabel} erstellen.`
                : activeTagFilterCount > 1
                  ? 'Nur fuer einen einzelnen Tag verfuegbar.'
                  : 'Waehle zuerst einen Tag.'
            }
            data-app-tooltip-position="top"
          >
            {tagCollectionActionLabel}
          </AnimatedButton>

          <button
            type="button"
            className="secondary gallery-toolbar-tag-manager"
            onClick={onManageTags}
            disabled={!canManageTags}
            data-app-tooltip="Tags durchsuchen, kombinieren und als Galerie-Filter anwenden."
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
      </div>

      {activeTagFilterCount > 0 ? (
        <div className="gallery-toolbar-tag-chips" aria-label="Tags als UND-Filter">
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
                data-app-tooltip="Alle aktiven Tag-Filter entfernen."
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
