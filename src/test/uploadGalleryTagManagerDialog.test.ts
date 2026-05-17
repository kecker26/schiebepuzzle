import { describe, expect, it } from 'vitest'
import {
  countUniqueTaggedEntries,
  getDuplicateGroups,
  getGalleryTagCategoryId,
  groupTagOptionsByCategory,
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
    expect(normalizeGermanTagConceptKey('Blume')).toBe(normalizeGermanTagConceptKey('Blumen'))
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

  it('zaehlt Kategorie-Motive eindeutig, auch wenn ein Motiv mehrere Tags derselben Kategorie hat', () => {
    const groups = groupTagOptionsByCategory([
      createTagOption('Monitor', ['entry-1']),
      createTagOption('Simulation', ['entry-1']),
      createTagOption('Technologie', ['entry-1']),
      createTagOption('Virtual Reality', ['entry-1']),
    ])

    const themesGroup = groups.find((group) => group.category.id === 'themes')

    expect(themesGroup?.options).toHaveLength(4)
    expect(themesGroup?.totalCount).toBe(1)
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

  it('ordnet typische Tags in sinnvolle Verwaltungskategorien ein', () => {
    expect(getGalleryTagCategoryId('Mensch')).toBe('people')
    expect(getGalleryTagCategoryId('Portrait')).toBe('people')
    expect(getGalleryTagCategoryId('Tierportrait')).toBe('animals')
    expect(getGalleryTagCategoryId('Tierportr\u00e4t')).toBe('animals')
    expect(getGalleryTagCategoryId('Blume')).toBe('plants')
    expect(getGalleryTagCategoryId('Baum')).toBe('nature')
    expect(getGalleryTagCategoryId('Schnee')).toBe('weatherLight')
    expect(getGalleryTagCategoryId('Architektur')).toBe('places')
    expect(getGalleryTagCategoryId('Malen')).toBe('art')
    expect(getGalleryTagCategoryId('Nahaufnahme')).toBe('composition')
    expect(getGalleryTagCategoryId('Dunkel')).toBe('colorMood')
    expect(getGalleryTagCategoryId('Auto')).toBe('transportTravel')
    expect(getGalleryTagCategoryId('Kamera')).toBe('technologyMedia')
    expect(getGalleryTagCategoryId('Raumstation')).toBe('scienceSpace')
    expect(getGalleryTagCategoryId('Jumpsuit')).toBe('fashion')
    expect(getGalleryTagCategoryId('Lederjacke')).toBe('fashion')
    expect(getGalleryTagCategoryId('T-Shirt')).toBe('fashion')
    expect(getGalleryTagCategoryId('Stoff')).toBe('materials')
    expect(getGalleryTagCategoryId('Verkehrsschild')).toBe('textSigns')
    expect(getGalleryTagCategoryId('Holz')).toBe('materials')
    expect(getGalleryTagCategoryId('Unbekannter Begriff')).toBe('themes')
  })
})
