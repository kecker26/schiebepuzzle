import { STATIC_TAG_CATEGORIES } from './staticTagTaxonomy.ts'
import type {
  TagCategoryAssignment,
  TagCategoryCatalog,
  TagCategoryResolution,
} from './tagCategoryTypes.ts'

export function normalizeTagCategoryKey(label: string): string {
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

export function getTagCategoryConceptKey(label: string): string {
  const baseKey = normalizeTagCategoryKey(label)
  let conceptKey = baseKey.replace(/aeu/g, 'au')

  if (conceptKey.length > 4 && conceptKey.endsWith('en')) {
    conceptKey = conceptKey.slice(0, -2)
  } else if (conceptKey.length > 4 && conceptKey.endsWith('e')) {
    conceptKey = conceptKey.slice(0, -1)
  } else if (conceptKey.length > 4 && conceptKey.endsWith('s')) {
    conceptKey = conceptKey.slice(0, -1)
  }

  return conceptKey
}

export function findStaticTagCategory(label: string) {
  const key = normalizeTagCategoryKey(label)
  const conceptKey = getTagCategoryConceptKey(label)
  if (!key) return null

  let bestMatch: { category: (typeof STATIC_TAG_CATEGORIES)[number]; score: number } | null = null
  for (const category of STATIC_TAG_CATEGORIES) {
    for (const keyword of category.keywords) {
      const keywordKey = normalizeTagCategoryKey(keyword)
      const keywordConceptKey = getTagCategoryConceptKey(keyword)
      if (!keywordKey || key !== keywordKey && conceptKey !== keywordConceptKey) continue
      const score = keywordKey.length
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { category, score }
      }
    }
  }

  return bestMatch?.category ?? null
}

export function createTagCategoryAssignmentMap(
  assignments: TagCategoryAssignment[]
): Map<string, TagCategoryAssignment> {
  return new Map(assignments.map((assignment) => [assignment.tagKey, assignment]))
}

export function resolveTagCategory(
  label: string,
  catalog?: Pick<TagCategoryCatalog, 'assignments' | 'categories'>
): TagCategoryResolution {
  const tagKey = normalizeTagCategoryKey(label)
  const assignment = catalog?.assignments.find((candidate) => candidate.tagKey === tagKey)
  if (assignment) {
    return {
      status: 'resolved',
      categoryId: assignment.categoryId,
      source: assignment.source,
      assignment,
    }
  }

  const dynamicCategory = catalog?.categories
    .filter((category) => category.source === 'manual')
    .find((category) => category.keywords.some((keyword) => {
      return getTagCategoryConceptKey(keyword) === getTagCategoryConceptKey(label)
    }))
  if (dynamicCategory) {
    return {
      status: 'resolved',
      categoryId: dynamicCategory.id,
      source: 'static',
    }
  }

  const staticCategory = findStaticTagCategory(label)
  if (staticCategory) {
    return {
      status: 'resolved',
      categoryId: staticCategory.id,
      source: 'static',
    }
  }

  return { status: 'unresolved' }
}
