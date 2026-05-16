import { describe, expect, it } from 'vitest'
import {
  countUniqueTaggedEntries,
  getDuplicateGroups,
  normalizeGermanTagConceptKey,
} from '../screens/upload/UploadGalleryTagManagerDialog.tsx'
import type { GalleryTagFilterOption } from '../screens/upload/UploadGalleryToolbar.tsx'

function createTagOption(label: string, entryIds: string[]): GalleryTagFilterOption {
  return {
    id: label.toLocaleLowerCase('de-DE'),
    label,
    count: entryIds.length,
    entryIds,
  }
}

describe('UploadGalleryTagManagerDialog tag grouping', () => {
  it('recognizes German umlaut variants and simple plural variants as the same concept', () => {
    expect(normalizeGermanTagConceptKey('Baum')).toBe(normalizeGermanTagConceptKey('Baeume'))
    expect(normalizeGermanTagConceptKey('Baum')).toBe(normalizeGermanTagConceptKey('B\u00e4ume'))
    expect(normalizeGermanTagConceptKey('Gr\u00fcn')).toBe(normalizeGermanTagConceptKey('Gruen'))
  })

  it('counts merged duplicate suggestions by unique gallery entries', () => {
    const options = [
      createTagOption('Baum', ['entry-1', 'entry-2']),
      createTagOption('Baeume', ['entry-2', 'entry-3']),
      createTagOption('B\u00e4ume', ['entry-3', 'entry-4']),
    ]

    expect(countUniqueTaggedEntries(options)).toBe(4)

    const [group] = getDuplicateGroups(options)
    expect(group.canonicalLabel).toBe('Baum')
    expect(group.sourceLabels).toEqual(['Baeume', 'B\u00e4ume'])
    expect(group.totalCount).toBe(4)
  })

  it('prefers native German spelling as canonical when spellings are otherwise equivalent', () => {
    const [group] = getDuplicateGroups([
      createTagOption('Gruen', ['entry-1', 'entry-2']),
      createTagOption('Gr\u00fcn', ['entry-3']),
    ])

    expect(group.canonicalLabel).toBe('Gr\u00fcn')
    expect(group.sourceLabels).toEqual(['Gruen'])
    expect(group.totalCount).toBe(3)
  })
})
