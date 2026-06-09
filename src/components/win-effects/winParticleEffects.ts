import type { ChallengeMedal, GalleryImageTag } from '../../types/index.ts'
import { normalizeTagCategoryKey, resolveTagCategory } from '../../services/tagCategories/tagCategoryResolver.ts'
import type {
  StaticTagCategoryId,
  TagCategoryCatalog,
  TagCategoryIconId,
} from '../../services/tagCategories/tagCategoryTypes.ts'

export type WinParticleMotion = 'fall' | 'float' | 'burst' | 'orbit' | 'flow' | 'build' | 'focus' | 'route'

export type WinParticleIcon =
  | 'activity'
  | 'aperture'
  | 'box'
  | 'building'
  | 'car'
  | 'cherry'
  | 'cog'
  | 'droplet'
  | 'flower'
  | 'gem'
  | 'heart'
  | 'leaf'
  | 'music'
  | 'palette'
  | 'paw'
  | 'plane'
  | 'shapes'
  | 'shirt'
  | 'snowflake'
  | 'sparkles'
  | 'star'
  | 'sun'
  | 'tree'
  | 'trophy'
  | 'type'
  | 'user'

export interface WinParticlePreset {
  id: string
  label: string
  icons: WinParticleIcon[]
  motion: WinParticleMotion
  colors: string[]
  density: number
}

export interface WinParticleSelection {
  primary: WinParticlePreset
  accent: WinParticlePreset | null
  matchedCategoryIds: string[]
}

const PRESETS: Record<StaticTagCategoryId | 'neutral', WinParticlePreset> = {
  people: preset('people', 'Menschen', ['user', 'heart', 'sparkles'], 'burst', ['#fda4af', '#f9a8d4', '#fde68a'], 22),
  animals: preset('animals', 'Tiere', ['paw', 'sparkles'], 'route', ['#fbbf24', '#fb923c', '#fef3c7'], 20),
  plants: preset('plants', 'Pflanzen & Blumen', ['flower', 'leaf'], 'fall', ['#86efac', '#f9a8d4', '#fde68a'], 24),
  nature: preset('nature', 'Natur & Landschaft', ['leaf', 'tree', 'droplet'], 'flow', ['#4ade80', '#38bdf8', '#facc15'], 22),
  weatherLight: preset('weatherLight', 'Wetter & Licht', ['sun', 'droplet', 'sparkles'], 'fall', ['#fde047', '#7dd3fc', '#f8fafc'], 22),
  places: preset('places', 'Orte & Architektur', ['building', 'shapes'], 'build', ['#cbd5e1', '#fbbf24', '#93c5fd'], 18),
  art: preset('art', 'Kunst & Illustration', ['palette', 'sparkles'], 'flow', ['#f472b6', '#a78bfa', '#22d3ee'], 22),
  composition: preset('composition', 'Aufnahme & Komposition', ['aperture', 'sparkles'], 'focus', ['#f8fafc', '#93c5fd', '#fbbf24'], 18),
  food: preset('food', 'Essen & Trinken', ['cherry', 'sparkles'], 'float', ['#fb7185', '#fbbf24', '#86efac'], 20),
  colorMood: preset('colorMood', 'Farbe & Stimmung', ['palette', 'gem', 'sparkles'], 'float', ['#fb7185', '#60a5fa', '#c084fc'], 24),
  technologyMedia: preset('technologyMedia', 'Technik & Medien', ['cog', 'shapes'], 'orbit', ['#67e8f9', '#94a3b8', '#a7f3d0'], 20),
  scienceSpace: preset('scienceSpace', 'Wissenschaft & Weltraum', ['star', 'sparkles', 'shapes'], 'orbit', ['#f8fafc', '#818cf8', '#fbbf24'], 24),
  transportTravel: preset('transportTravel', 'Verkehr & Reisen', ['plane', 'car'], 'route', ['#60a5fa', '#f97316', '#f8fafc'], 18),
  activities: preset('activities', 'Aktivitaeten & Sport', ['trophy', 'activity', 'sparkles'], 'burst', ['#fbbf24', '#fb7185', '#60a5fa'], 24),
  fashion: preset('fashion', 'Mode & Kleidung', ['shirt', 'gem', 'sparkles'], 'float', ['#f9a8d4', '#c084fc', '#f8fafc'], 20),
  textSigns: preset('textSigns', 'Text & Zeichen', ['type', 'shapes'], 'build', ['#f8fafc', '#93c5fd', '#fbbf24'], 18),
  materials: preset('materials', 'Materialien & Oberflaechen', ['gem', 'shapes'], 'burst', ['#d6d3d1', '#94a3b8', '#a5f3fc'], 20),
  objects: preset('objects', 'Objekte', ['box', 'shapes'], 'float', ['#fbbf24', '#93c5fd', '#c4b5fd'], 18),
  themes: preset('themes', 'Themen & Motive', ['sparkles', 'star', 'gem'], 'orbit', ['#c084fc', '#22d3ee', '#fb7185'], 24),
  neutral: preset('neutral', 'Lichtfunken', ['sparkles', 'star', 'gem'], 'burst', ['#f8fafc', '#fde68a', '#93c5fd'], 18),
}

const TAG_OVERRIDE_ALIASES: Record<string, string[]> = {
  music: ['musik', 'music', 'note', 'noten'],
  snow: ['schnee', 'snow', 'schneeflocke', 'snowflake'],
  rain: ['regen', 'rain', 'regentropfen'],
  flowers: ['blume', 'blumen', 'flower', 'flowers', 'rose', 'tulpe'],
  ocean: ['meer', 'ocean', 'sea', 'unterwasser', 'underwater'],
  cyberpunk: ['cyberpunk', 'neon'],
  fantasy: ['fantasie', 'fantasy', 'magisch', 'magic'],
}

const TAG_OVERRIDES: Array<{ keys: string[]; preset: WinParticlePreset }> = [
  override('music', 'Musik', ['music', 'sparkles'], 'float', ['#c084fc', '#22d3ee', '#f9a8d4']),
  override('snow', 'Schnee', ['snowflake', 'sparkles'], 'fall', ['#f8fafc', '#bae6fd', '#e0e7ff']),
  override('rain', 'Regen', ['droplet', 'sparkles'], 'fall', ['#7dd3fc', '#60a5fa', '#e0f2fe']),
  override('flowers', 'Blumen', ['flower', 'leaf'], 'fall', ['#f9a8d4', '#fde68a', '#86efac']),
  override('ocean', 'Meer', ['droplet', 'sparkles'], 'flow', ['#22d3ee', '#3b82f6', '#e0f2fe']),
  override('cyberpunk', 'Cyberpunk', ['cog', 'shapes', 'sparkles'], 'route', ['#22d3ee', '#f472b6', '#a78bfa']),
  override('fantasy', 'Fantasie', ['sparkles', 'star', 'gem'], 'orbit', ['#c084fc', '#f9a8d4', '#fde68a']),
]

const ICON_FALLBACKS: Record<TagCategoryIconId, StaticTagCategoryId> = {
  activity: 'activities',
  brush: 'art',
  building: 'places',
  camera: 'composition',
  car: 'transportTravel',
  cpu: 'technologyMedia',
  palette: 'colorMood',
  paw: 'animals',
  rocket: 'scienceSpace',
  shapes: 'objects',
  shirt: 'fashion',
  smile: 'people',
  sprout: 'plants',
  sun: 'weatherLight',
  tags: 'themes',
  tree: 'nature',
  type: 'textSigns',
  utensils: 'food',
}

function preset(
  id: string,
  label: string,
  icons: WinParticleIcon[],
  motion: WinParticleMotion,
  colors: string[],
  density: number
): WinParticlePreset {
  return { id, label, icons, motion, colors, density }
}

function override(
  id: string,
  label: string,
  icons: WinParticleIcon[],
  motion: WinParticleMotion,
  colors: string[]
) {
  return {
    keys: TAG_OVERRIDE_ALIASES[id] ?? [id],
    preset: preset(`tag-${id}`, label, icons, motion, colors, 24),
  }
}

function findTagOverride(label: string): WinParticlePreset | null {
  const key = normalizeTagCategoryKey(label)
  return TAG_OVERRIDES.find(({ keys }) => keys.some((candidate) => normalizeTagCategoryKey(candidate) === key))?.preset ?? null
}

function getCategoryPreset(categoryId: string, catalog?: TagCategoryCatalog | null): WinParticlePreset {
  if (categoryId in PRESETS) {
    return PRESETS[categoryId as StaticTagCategoryId]
  }

  const customCategory = catalog?.categories.find((category) => category.id === categoryId)
  return customCategory ? PRESETS[ICON_FALLBACKS[customCategory.iconId]] : PRESETS.neutral
}

export function resolveWinParticleSelection(
  tags: GalleryImageTag[] = [],
  rejectedAiTags: string[] = [],
  catalog?: TagCategoryCatalog | null
): WinParticleSelection {
  const rejectedKeys = new Set(rejectedAiTags.map(normalizeTagCategoryKey))
  const visibleTags = tags.filter((tag) => !rejectedKeys.has(normalizeTagCategoryKey(tag.label)))

  const overrideMatch = visibleTags
    .map((tag) => ({ tag, preset: findTagOverride(tag.label) }))
    .filter((match): match is { tag: GalleryImageTag; preset: WinParticlePreset } => match.preset !== null)
    .sort((left, right) => right.tag.confidence - left.tag.confidence)[0]

  const categoryScores = new Map<string, number>()
  for (const tag of visibleTags) {
    const resolution = resolveTagCategory(tag.label, catalog ?? undefined)
    if (resolution.status !== 'resolved') continue
    const sourceWeight = tag.source === 'manual' ? 1.5 : 1
    const assignmentWeight = resolution.source === 'manual' ? 1.35 : resolution.source === 'ai' ? 1.15 : 1
    categoryScores.set(
      resolution.categoryId,
      (categoryScores.get(resolution.categoryId) ?? 0) + Math.max(0.2, tag.confidence) * sourceWeight * assignmentWeight
    )
  }

  const rankedCategories = [...categoryScores.entries()].sort((left, right) => right[1] - left[1])
  const primaryCategoryId = rankedCategories[0]?.[0] ?? null
  const accentCategoryId = rankedCategories.find(([categoryId]) => categoryId !== primaryCategoryId)?.[0] ?? null
  const primary = overrideMatch?.preset ?? (primaryCategoryId ? getCategoryPreset(primaryCategoryId, catalog) : PRESETS.neutral)
  const accent = accentCategoryId ? getCategoryPreset(accentCategoryId, catalog) : null

  return {
    primary,
    accent: accent?.id === primary.id ? null : accent,
    matchedCategoryIds: rankedCategories.map(([categoryId]) => categoryId),
  }
}

export function resolveChallengeWinParticleSelection(
  medal: ChallengeMedal,
  accent: WinParticlePreset | null = null
): WinParticleSelection {
  const primary = {
    diamond: preset('challenge-diamond', 'Diamant-Challenge', ['gem', 'sparkles', 'star'], 'burst', ['#e0f2fe', '#67e8f9', '#c4b5fd'], 28),
    gold: preset('challenge-gold', 'Gold-Challenge', ['trophy', 'star', 'sparkles'], 'burst', ['#fef3c7', '#fbbf24', '#f59e0b'], 27),
    silver: preset('challenge-silver', 'Silber-Challenge', ['trophy', 'star', 'sparkles'], 'fall', ['#f8fafc', '#cbd5e1', '#94a3b8'], 24),
    bronze: preset('challenge-bronze', 'Bronze-Challenge', ['trophy', 'star'], 'float', ['#fed7aa', '#fb923c', '#b45309'], 22),
  }[medal]

  return {
    primary,
    accent: accent?.id === primary.id ? null : accent,
    matchedCategoryIds: [],
  }
}

export const WIN_PARTICLE_PRESETS = PRESETS
