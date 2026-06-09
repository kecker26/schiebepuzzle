import { describe, expect, it } from 'vitest'
import {
  resolveWinParticleSelection,
  resolveChallengeWinParticleSelection,
  WIN_PARTICLE_PRESETS,
} from '../components/win-effects/winParticleEffects.ts'
import type { GalleryImageTag } from '../types/index.ts'
import type { TagCategoryCatalog } from '../services/tagCategories/tagCategoryTypes.ts'

function tag(label: string, source: GalleryImageTag['source'] = 'gemini', confidence = 0.9): GalleryImageTag {
  return { label, source, confidence }
}

describe('winParticleEffects', () => {
  it.each([
    ['people', 'Portrait'],
    ['animals', 'Schwan'],
    ['plants', 'Kaktus'],
    ['nature', 'Landschaft'],
    ['weatherLight', 'Sonnenuntergang'],
    ['places', 'Architektur'],
    ['art', 'Illustration'],
    ['composition', 'Makro'],
    ['food', 'Kaffee'],
    ['colorMood', 'Dramatisch'],
    ['technologyMedia', 'Roboter'],
    ['scienceSpace', 'Galaxie'],
    ['transportTravel', 'Fahrzeug'],
    ['activities', 'Sport'],
    ['fashion', 'Kleidung'],
    ['textSigns', 'Typografie'],
    ['materials', 'Metall'],
    ['objects', 'Moebel'],
    ['themes', 'Abstrakt'],
  ])('covers the %s category with its own preset', (categoryId, label) => {
    expect(resolveWinParticleSelection([tag(label)]).primary.id).toBe(categoryId)
    expect(WIN_PARTICLE_PRESETS[categoryId as keyof typeof WIN_PARTICLE_PRESETS]).toBeDefined()
  })

  it('prefers specific tag effects and keeps a secondary category as accent', () => {
    const selection = resolveWinParticleSelection([
      tag('Musik', 'manual', 1),
      tag('Portrait', 'gemini', 0.95),
    ])

    expect(selection.primary.id).toBe('tag-music')
    expect(selection.accent?.id).toBe('people')
  })

  it('ignores rejected AI tags when selecting an effect', () => {
    const selection = resolveWinParticleSelection([
      tag('Schnee'),
      tag('Roboter'),
    ], ['Schnee'])

    expect(selection.primary.id).toBe('technologyMedia')
  })

  it('maps custom categories through their configured icon', () => {
    const catalog: TagCategoryCatalog = {
      categories: [{
        id: 'fabelwesen',
        label: 'Fabelwesen',
        iconId: 'rocket',
        keywords: [],
        source: 'manual',
      }],
      assignments: [{
        tagKey: 'drache',
        categoryId: 'fabelwesen',
        source: 'manual',
        confirmed: true,
        confidence: 1,
        originalLabels: ['Drache'],
        updatedAt: '2026-06-07T12:00:00.000Z',
      }],
      lastUpdatedAt: '2026-06-07T12:00:00.000Z',
    }

    const selection = resolveWinParticleSelection([tag('Drache', 'manual', 1)], [], catalog)

    expect(selection.primary.id).toBe('scienceSpace')
    expect(selection.matchedCategoryIds).toEqual(['fabelwesen'])
  })

  it('uses a neutral celebration when no tag can be resolved', () => {
    expect(resolveWinParticleSelection([tag('Unbekanntes Motiv')]).primary.id).toBe('neutral')
  })

  it('uses medal-specific particles while preserving the motif as accent', () => {
    const motif = resolveWinParticleSelection([tag('Meer')]).primary
    const selection = resolveChallengeWinParticleSelection('diamond', motif)

    expect(selection.primary.id).toBe('challenge-diamond')
    expect(selection.accent?.id).toBe('tag-ocean')
  })
})
