import { describe, expect, it } from 'vitest'
import {
  normalizeTagCategoryKey,
  resolveTagCategory,
} from '../services/tagCategories/tagCategoryResolver.ts'
import type { TagCategoryCatalog } from '../services/tagCategories/tagCategoryTypes.ts'

describe('tagCategoryResolver', () => {
  it('normalizes German spellings and resolves exact static concepts', () => {
    expect(normalizeTagCategoryKey('  Schwaene! ')).toBe('schwaene')
    expect(resolveTagCategory('Schwan')).toMatchObject({
      status: 'resolved',
      categoryId: 'animals',
      source: 'static',
    })
    expect(resolveTagCategory('Schwaene')).toMatchObject({
      status: 'resolved',
      categoryId: 'animals',
    })
  })

  it('does not classify arbitrary substring matches', () => {
    expect(resolveTagCategory('Autonomie')).toEqual({ status: 'unresolved' })
  })

  it('prefers persisted manual assignments over static taxonomy', () => {
    const catalog: TagCategoryCatalog = {
      categories: [],
      assignments: [{
        tagKey: 'schwan',
        categoryId: 'art',
        source: 'manual',
        confirmed: true,
        confidence: 1,
        originalLabels: ['Schwan'],
        updatedAt: '2026-06-06T12:00:00.000Z',
      }],
      lastUpdatedAt: '2026-06-06T12:00:00.000Z',
    }

    expect(resolveTagCategory('Schwan', catalog)).toMatchObject({
      status: 'resolved',
      categoryId: 'art',
      source: 'manual',
    })
  })

  it('resolves assignments into dynamic categories', () => {
    const catalog: TagCategoryCatalog = {
      categories: [{
        id: 'mythical-creatures',
        label: 'Fabelwesen',
        iconId: 'tags',
        keywords: [],
        source: 'manual',
      }],
      assignments: [{
        tagKey: 'drache',
        categoryId: 'mythical-creatures',
        source: 'ai',
        confirmed: false,
        confidence: 0.92,
        originalLabels: ['Drache'],
        updatedAt: '2026-06-06T12:00:00.000Z',
      }],
      lastUpdatedAt: '2026-06-06T12:00:00.000Z',
    }

    expect(resolveTagCategory('Drache', catalog)).toMatchObject({
      status: 'resolved',
      categoryId: 'mythical-creatures',
      source: 'ai',
    })
  })
})
