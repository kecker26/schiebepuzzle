export type StaticTagCategoryId =
  | 'people'
  | 'animals'
  | 'plants'
  | 'nature'
  | 'weatherLight'
  | 'places'
  | 'art'
  | 'composition'
  | 'food'
  | 'colorMood'
  | 'technologyMedia'
  | 'scienceSpace'
  | 'transportTravel'
  | 'activities'
  | 'fashion'
  | 'textSigns'
  | 'materials'
  | 'objects'
  | 'themes'

export type TagCategoryAssignmentSource = 'manual' | 'ai'
export type TagCategoryId = string
export type TagCategoryIconId =
  | 'activity'
  | 'brush'
  | 'building'
  | 'camera'
  | 'car'
  | 'cpu'
  | 'palette'
  | 'paw'
  | 'rocket'
  | 'shapes'
  | 'shirt'
  | 'smile'
  | 'sprout'
  | 'sun'
  | 'tags'
  | 'tree'
  | 'type'
  | 'utensils'

export interface TagCategoryDefinition {
  id: TagCategoryId
  label: string
  iconId: TagCategoryIconId
  keywords: string[]
  source?: 'static' | 'manual'
  createdAt?: string
  updatedAt?: string
}

export interface TagCategoryAssignment {
  tagKey: string
  categoryId: TagCategoryId
  source: TagCategoryAssignmentSource
  confirmed: boolean
  confidence: number
  originalLabels: string[]
  updatedAt: string
}

export interface TagCategoryCatalog {
  categories: TagCategoryDefinition[]
  assignments: TagCategoryAssignment[]
  lastUpdatedAt: string | null
}

export interface UpdateTagCategoryAssignmentsPayload {
  labels: string[]
  categoryId: TagCategoryId | null
}

export interface CreateTagCategoryPayload {
  label: string
  iconId: TagCategoryIconId
}

export interface UpdateTagCategoryPayload {
  label?: string
  iconId?: TagCategoryIconId
  replacementCategoryId?: TagCategoryId | null
}

export interface TagCategorySuggestion {
  temporaryId: string
  label: string
  iconId: TagCategoryIconId
  matchingTags: string[]
  reason: string
}

export interface ClassifyTagCategoriesPayload {
  labels: string[]
  allowCategorySuggestions?: boolean
}

export interface ClassifyTagCategoriesResult {
  catalog: TagCategoryCatalog
  classifiedCount: number
  unresolvedLabels: string[]
  suggestions: TagCategorySuggestion[]
}

export type TagCategoryResolution =
  | {
      status: 'resolved'
      categoryId: TagCategoryId
      source: 'manual' | 'ai' | 'static'
      assignment?: TagCategoryAssignment
    }
  | {
      status: 'unresolved'
    }
