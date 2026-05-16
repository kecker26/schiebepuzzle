import { useEffect, useMemo, useState } from 'react'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'
import type { GalleryTagFilterOption } from './UploadGalleryToolbar.tsx'

interface UploadGalleryTagManagerDialogProps {
  tagOptions: GalleryTagFilterOption[]
  isBusy: boolean
  onRenameTag: (sourceLabel: string, targetLabel: string) => Promise<void>
  onRemoveTag: (sourceLabel: string) => Promise<void>
  onClose: () => void
}

interface GalleryTagDuplicateGroup {
  id: string
  canonicalLabel: string
  sourceLabel: string
  sourceLabels: string[]
  options: GalleryTagFilterOption[]
  totalCount: number
}

type TagManagerSortMode = 'frequency' | 'alpha-asc' | 'alpha-desc'

const TAG_MANAGER_FEEDBACK_MS = 2500
const SORT_MODE_LABELS: Record<TagManagerSortMode, string> = {
  frequency: 'Haeufigkeit',
  'alpha-asc': 'A-Z',
  'alpha-desc': 'Z-A',
}

export function normalizeGermanTagBaseKey(label: string): string {
  return label
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

export function normalizeGermanTagConceptKey(label: string): string {
  const baseKey = normalizeGermanTagBaseKey(label)
  let conceptKey = baseKey.replace(/aeu/g, 'au')

  if (conceptKey.length > 4 && conceptKey.endsWith('e')) {
    conceptKey = conceptKey.slice(0, -1)
  } else if (conceptKey.length > 4 && conceptKey.endsWith('s')) {
    conceptKey = conceptKey.slice(0, -1)
  }

  return conceptKey
}

export function getCanonicalTagOption(options: GalleryTagFilterOption[]): GalleryTagFilterOption {
  return [...options].sort((a, b) => {
    const lengthDelta = normalizeGermanTagBaseKey(a.label).length - normalizeGermanTagBaseKey(b.label).length
    if (lengthDelta !== 0) return lengthDelta

    const aHasNativeGermanCharacter = /[\u00e4\u00f6\u00fc\u00df]/i.test(a.label)
    const bHasNativeGermanCharacter = /[\u00e4\u00f6\u00fc\u00df]/i.test(b.label)
    if (aHasNativeGermanCharacter !== bHasNativeGermanCharacter) return aHasNativeGermanCharacter ? -1 : 1

    return b.count - a.count || a.label.localeCompare(b.label, 'de')
  })[0]
}

export function countUniqueTaggedEntries(options: GalleryTagFilterOption[]): number {
  const entryIds = new Set(options.flatMap((option) => option.entryIds ?? []))
  if (entryIds.size > 0) return entryIds.size

  return options.reduce((sum, option) => sum + option.count, 0)
}

export function getDuplicateGroups(tagOptions: GalleryTagFilterOption[]): GalleryTagDuplicateGroup[] {
  const groups = new Map<string, GalleryTagFilterOption[]>()

  for (const option of tagOptions) {
    const key = normalizeGermanTagConceptKey(option.label)
    if (!key) continue

    const current = groups.get(key)
    if (current) {
      current.push(option)
    } else {
      groups.set(key, [option])
    }
  }

  return Array.from(groups.entries())
    .flatMap(([id, options]) => {
      if (options.length < 2) return []

      const canonicalOption = getCanonicalTagOption(options)
      const sortedOptions = [
        canonicalOption,
        ...options
          .filter((option) => option.label !== canonicalOption.label)
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'de')),
      ]
      const sourceLabels = sortedOptions
        .filter((option) => option.label !== canonicalOption.label)
        .map((option) => option.label)
      if (sourceLabels.length === 0) return []

      return [{
        id,
        canonicalLabel: canonicalOption.label,
        sourceLabel: sourceLabels[0],
        sourceLabels,
        options: sortedOptions,
        totalCount: countUniqueTaggedEntries(sortedOptions),
      }]
    })
    .sort((a, b) => b.totalCount - a.totalCount || a.canonicalLabel.localeCompare(b.canonicalLabel, 'de'))
}

function getTagUsageCount(option: GalleryTagFilterOption): number {
  return option.entryIds?.length ?? option.count
}

function sortTagOptions(options: GalleryTagFilterOption[], sortMode: TagManagerSortMode): GalleryTagFilterOption[] {
  return [...options].sort((a, b) => {
    switch (sortMode) {
      case 'alpha-asc':
        return a.label.localeCompare(b.label, 'de') || getTagUsageCount(b) - getTagUsageCount(a)
      case 'alpha-desc':
        return b.label.localeCompare(a.label, 'de') || getTagUsageCount(b) - getTagUsageCount(a)
      case 'frequency':
      default:
        return getTagUsageCount(b) - getTagUsageCount(a) || a.label.localeCompare(b.label, 'de')
    }
  })
}

function getNextSortMode(sortMode: TagManagerSortMode): TagManagerSortMode {
  if (sortMode === 'frequency') return 'alpha-asc'
  if (sortMode === 'alpha-asc') return 'alpha-desc'
  return 'frequency'
}

function formatTagCount(count: number): string {
  return `${count} ${count === 1 ? 'Motiv' : 'Motive'}`
}

export default function UploadGalleryTagManagerDialog({
  tagOptions,
  isBusy,
  onRenameTag,
  onRemoveTag,
  onClose,
}: UploadGalleryTagManagerDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<TagManagerSortMode>('frequency')
  const [selectedTagKey, setSelectedTagKey] = useState<string | null>(tagOptions[0]?.id ?? null)
  const [targetLabel, setTargetLabel] = useState(tagOptions[0]?.label ?? '')
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false)

  const totalTaggedEntries = useMemo(() => countUniqueTaggedEntries(tagOptions), [tagOptions])
  const maxTagCount = useMemo(
    () => Math.max(1, ...tagOptions.map((option) => getTagUsageCount(option))),
    [tagOptions]
  )
  const queryKey = normalizeGermanTagBaseKey(searchQuery)
  const visibleTagOptions = useMemo(() => {
    const filteredOptions = queryKey
      ? tagOptions.filter((option) => normalizeGermanTagBaseKey(option.label).includes(queryKey))
      : tagOptions

    return sortTagOptions(filteredOptions, sortMode)
  }, [queryKey, sortMode, tagOptions])
  const selectedOption =
    tagOptions.find((option) => option.id === selectedTagKey)
    ?? visibleTagOptions[0]
    ?? tagOptions[0]
    ?? null
  const selectedTagCount = selectedOption ? getTagUsageCount(selectedOption) : 0
  const selectedTagShare = totalTaggedEntries > 0
    ? Math.round((selectedTagCount / totalTaggedEntries) * 100)
    : 0
  const selectedDuplicateGroup = useMemo(() => {
    if (!selectedOption) return null

    const group = getDuplicateGroups(tagOptions).find((duplicateGroup) =>
      duplicateGroup.options.some((option) => option.label === selectedOption.label)
    )
    if (!group) return null

    const targetLabel = group.canonicalLabel === selectedOption.label ? group.sourceLabel : group.canonicalLabel
    const sourceLabels = group.canonicalLabel === selectedOption.label ? group.sourceLabels : [selectedOption.label]
    return {
      ...group,
      sourceLabel: selectedOption.label,
      sourceLabels,
      targetLabel,
    }
  }, [selectedOption, tagOptions])
  const normalizedTarget = targetLabel.replace(/\s+/g, ' ').trim()
  const canRename = Boolean(selectedOption && normalizedTarget && normalizedTarget !== selectedOption.label)

  useEffect(() => {
    if (!feedbackMessage) return undefined

    const timeoutId = window.setTimeout(() => setFeedbackMessage(null), TAG_MANAGER_FEEDBACK_MS)
    return () => window.clearTimeout(timeoutId)
  }, [feedbackMessage])

  useEffect(() => {
    if (tagOptions.length === 0) {
      setSelectedTagKey(null)
      setTargetLabel('')
      setConfirmingRemove(false)
      setIsMobileDetailOpen(false)
      return
    }

    if (selectedTagKey && tagOptions.some((option) => option.id === selectedTagKey)) {
      return
    }

    const nextOption = visibleTagOptions[0] ?? tagOptions[0]
    setSelectedTagKey(nextOption.id)
    setTargetLabel(nextOption.label)
    setConfirmingRemove(false)
  }, [selectedTagKey, tagOptions, visibleTagOptions])

  const selectTag = (option: GalleryTagFilterOption) => {
    setSelectedTagKey(option.id)
    setTargetLabel(option.label)
    setConfirmingRemove(false)
    setIsMobileDetailOpen(true)
  }

  const handleRename = async () => {
    if (!selectedOption || !canRename) return

    const sourceLabel = selectedOption.label
    await onRenameTag(sourceLabel, normalizedTarget)
    setFeedbackMessage(`#${sourceLabel} wurde in #${normalizedTarget} umbenannt.`)
    setSelectedTagKey(normalizedTarget.toLocaleLowerCase('de-DE'))
    setTargetLabel(normalizedTarget)
    setConfirmingRemove(false)
  }

  const handleRemove = async () => {
    if (!selectedOption) return

    const removedLabel = selectedOption.label
    await onRemoveTag(removedLabel)
    setFeedbackMessage(`#${removedLabel} wurde entfernt.`)
    setConfirmingRemove(false)

    const nextOption = visibleTagOptions.find((option) => option.id !== selectedOption.id)
      ?? tagOptions.find((option) => option.id !== selectedOption.id)
      ?? null
    setSelectedTagKey(nextOption?.id ?? null)
    setTargetLabel(nextOption?.label ?? '')
    setIsMobileDetailOpen(Boolean(nextOption))
  }

  const handleMergeSimilar = async () => {
    if (!selectedDuplicateGroup) return

    for (const source of selectedDuplicateGroup.sourceLabels) {
      await onRenameTag(source, selectedDuplicateGroup.targetLabel)
    }

    setFeedbackMessage(
      `${selectedDuplicateGroup.sourceLabels.length} ${selectedDuplicateGroup.sourceLabels.length === 1 ? 'Tag' : 'Tags'} wurden zu #${selectedDuplicateGroup.targetLabel} zusammengefuehrt.`
    )
    setSelectedTagKey(selectedDuplicateGroup.targetLabel.toLocaleLowerCase('de-DE'))
    setTargetLabel(selectedDuplicateGroup.targetLabel)
    setConfirmingRemove(false)
  }

  return (
    <AnimatedDialog
      overlayClassName="gallery-tag-manager-overlay"
      dialogClassName="gallery-tag-manager-dialog"
      titleId="gallery-tag-manager-title"
      descriptionId="gallery-tag-manager-description"
      onClose={isBusy ? undefined : onClose}
      closeOnOverlayClick={!isBusy}
      closeOnEscape={!isBusy}
      trapFocus
      restoreFocus
      lockScroll
    >
      <div className="gallery-tag-manager-header">
        <div>
          <span className="saved-games-kicker">KI-Tags</span>
          <h3 id="gallery-tag-manager-title">Tags verwalten</h3>
        </div>
        <p id="gallery-tag-manager-description">
          {tagOptions.length} {tagOptions.length === 1 ? 'Tag' : 'Tags'} in {formatTagCount(totalTaggedEntries)}.
          Suche, bereinige und fuehre aehnliche Begriffe zusammen.
        </p>
      </div>

      <div className="gallery-tag-manager-search">
        <label className="gallery-tag-manager-search-field">
          <input
            aria-label="Tags durchsuchen"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tags durchsuchen..."
            disabled={isBusy || tagOptions.length === 0}
          />
        </label>
        <button
          type="button"
          className="secondary gallery-tag-manager-sort-button"
          onClick={() => setSortMode((current) => getNextSortMode(current))}
          disabled={isBusy || tagOptions.length === 0}
          aria-label={`Sortierung wechseln, aktuell ${SORT_MODE_LABELS[sortMode]}`}
        >
          Sort: {SORT_MODE_LABELS[sortMode]}
        </button>
      </div>

      <div className={`gallery-tag-manager-body${isMobileDetailOpen ? ' is-detail-open' : ''}`}>
        <section className="gallery-tag-manager-list" aria-label="Tag-Liste">
          {visibleTagOptions.length > 0 ? (
            visibleTagOptions.map((option) => {
              const optionCount = getTagUsageCount(option)
              const usagePercent = Math.max(4, Math.round((optionCount / maxTagCount) * 100))
              const isActive = selectedOption?.id === option.id

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`gallery-tag-manager-list-item${isActive ? ' is-active' : ''}`}
                  onClick={() => selectTag(option)}
                  disabled={isBusy}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className="gallery-tag-manager-list-item-main">
                    <strong>#{option.label}</strong>
                    <span>{formatTagCount(optionCount)}</span>
                  </span>
                  <span className="gallery-tag-manager-list-item-meter" aria-hidden="true">
                    <span style={{ width: `${usagePercent}%` }} />
                  </span>
                </button>
              )
            })
          ) : (
            <div className="gallery-tag-manager-empty" role="status">
              Keine Tags fuer diese Suche.
            </div>
          )}
        </section>

        <section className="gallery-tag-manager-detail" aria-label="Tag-Details">
          <button
            type="button"
            className="secondary gallery-tag-manager-back-button"
            onClick={() => setIsMobileDetailOpen(false)}
            disabled={isBusy}
          >
            Zur Tag-Liste
          </button>

          {selectedOption ? (
            <>
              <div className="gallery-tag-manager-detail-header">
                <span className="saved-games-kicker">Ausgewaehlter Tag</span>
                <h4>#{selectedOption.label}</h4>
                <p>Verwendet in {formatTagCount(selectedTagCount)}.</p>
              </div>

              <div className="gallery-tag-manager-detail-frequency" aria-label="Tag-Haeufigkeit">
                <div>
                  <span>Anteil</span>
                  <strong>{selectedTagShare}%</strong>
                </div>
                <span className="gallery-tag-manager-detail-meter" aria-hidden="true">
                  <span style={{ width: `${selectedTagShare}%` }} />
                </span>
              </div>

              <label className="gallery-tag-manager-detail-field">
                <span>Neuer Name</span>
                <input
                  value={targetLabel}
                  onChange={(event) => {
                    setTargetLabel(event.target.value)
                    setConfirmingRemove(false)
                  }}
                  disabled={isBusy}
                  maxLength={40}
                />
              </label>

              {selectedDuplicateGroup ? (
                <div className="gallery-tag-manager-detail-similar">
                  <span className="saved-games-kicker">Aehnliche Tags</span>
                  <div>
                    {selectedDuplicateGroup.sourceLabels.map((source) => (
                      <span key={source}>#{source}</span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      void handleMergeSimilar()
                    }}
                    disabled={isBusy}
                  >
                    Zu #{selectedDuplicateGroup.targetLabel} zusammenfuehren
                  </button>
                </div>
              ) : null}

              {confirmingRemove ? (
                <div className="gallery-tag-manager-confirm-remove" role="alert">
                  <strong>#{selectedOption.label} entfernen?</strong>
                  <p>Der Tag wird aus {formatTagCount(selectedTagCount)} entfernt.</p>
                  <div>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        void handleRemove()
                      }}
                      disabled={isBusy}
                    >
                      Ja, entfernen
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setConfirmingRemove(false)}
                      disabled={isBusy}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="gallery-tag-manager-detail-actions">
                <AnimatedButton
                  onClick={() => {
                    void handleRename()
                  }}
                  disabled={isBusy || !canRename}
                >
                  {isBusy ? 'Speichert ...' : 'Umbenennen'}
                </AnimatedButton>
                <AnimatedButton
                  className="secondary"
                  onClick={() => setConfirmingRemove(true)}
                  disabled={isBusy}
                >
                  Entfernen
                </AnimatedButton>
              </div>
            </>
          ) : (
            <div className="gallery-tag-manager-empty" role="status">
              Kein Tag ausgewaehlt.
            </div>
          )}
        </section>
      </div>

      {feedbackMessage ? (
        <div className="gallery-tag-manager-feedback" role="status" aria-live="polite">
          {feedbackMessage}
        </div>
      ) : null}

      <div className="gallery-tag-manager-actions">
        <AnimatedButton className="secondary" onClick={onClose} disabled={isBusy}>
          Schliessen
        </AnimatedButton>
      </div>
    </AnimatedDialog>
  )
}
