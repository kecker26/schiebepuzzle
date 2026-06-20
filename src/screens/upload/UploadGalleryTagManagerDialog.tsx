import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Activity,
  Brush,
  Building2,
  Camera,
  Car,
  ChevronDown,
  Cpu,
  Palette,
  PawPrint,
  Rocket,
  Shapes,
  Shirt,
  Smile,
  Sprout,
  Sun,
  Tags,
  TreePine,
  Type,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AsyncStatusPanel from '../../motion/AsyncStatusPanel.tsx'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'
import { resolveTagCategory } from '../../services/tagCategories/tagCategoryResolver.ts'
import type {
  TagCategoryIconId,
  TagCategoryCatalog,
  TagCategoryResolution,
  TagCategorySuggestion,
} from '../../services/tagCategories/tagCategoryTypes.ts'
import type { GalleryTagFilterOption } from './UploadGalleryToolbar.tsx'

interface UploadGalleryTagManagerDialogProps {
  tagOptions: GalleryTagFilterOption[]
  activeTagFilterKeys: string[]
  isBusy: boolean
  busyOperation?: 'ai-classification' | 'rename-tag' | 'remove-tag' | 'edit-tags' | 'assign-category' | 'create-category' | 'delete-category' | null
  onRenameTag: (sourceLabel: string, targetLabel: string) => Promise<void>
  onRemoveTag: (sourceLabel: string) => Promise<void>
  onEditEntryTags: (entryIds: string[], add?: string[], remove?: string[]) => Promise<void>
  tagCategoryCatalog: TagCategoryCatalog
  tagCategorySuggestions: TagCategorySuggestion[]
  onUpdateTagCategory: (labels: string[], categoryId: string | null) => Promise<void>
  onClassifyUnknownTags: (labels: string[]) => Promise<void>
  onCreateTagCategory: (label: string, iconId: TagCategoryIconId, assignedLabels?: string[]) => Promise<void>
  onDeleteTagCategory: (categoryId: string) => Promise<void>
  onApplyTagFilters: (tagKeys: string[]) => void
  onClose: () => void
  paletteStyle?: CSSProperties
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
type GalleryTagCategoryId = string

interface GalleryTagCategoryDefinition {
  id: GalleryTagCategoryId
  label: string
  icon: LucideIcon
  keywords: string[]
}

interface GalleryTagCategoryGroup {
  category: GalleryTagCategoryDefinition
  options: GalleryTagFilterOption[]
  totalCount: number
}

interface GalleryTagMergeSuggestion extends GalleryTagDuplicateGroup {
  targetLabel: string
  mergeSourceLabels: string[]
  isSelectedTagRelated: boolean
}

const TAG_MANAGER_FEEDBACK_MS = 2500
const UNRESOLVED_TAG_PREVIEW_LIMIT = 12
const TAG_CATEGORY_AI_BATCH_LIMIT = 30
const TAG_CATEGORY_ICON_OPTIONS: Array<{ id: TagCategoryIconId; label: string }> = [
  { id: 'tags', label: 'Tags' },
  { id: 'shapes', label: 'Formen' },
  { id: 'palette', label: 'Palette' },
  { id: 'activity', label: 'Aktivitaet' },
  { id: 'brush', label: 'Pinsel' },
  { id: 'building', label: 'Gebaeude' },
  { id: 'camera', label: 'Kamera' },
  { id: 'cpu', label: 'Technik' },
  { id: 'paw', label: 'Tier' },
  { id: 'tree', label: 'Natur' },
]
const TAG_CATEGORY_ICON_MAP: Record<TagCategoryIconId, LucideIcon> = {
  activity: Activity,
  brush: Brush,
  building: Building2,
  camera: Camera,
  car: Car,
  cpu: Cpu,
  palette: Palette,
  paw: PawPrint,
  rocket: Rocket,
  shapes: Shapes,
  shirt: Shirt,
  smile: Smile,
  sprout: Sprout,
  sun: Sun,
  tags: Tags,
  tree: TreePine,
  type: Type,
  utensils: Utensils,
}
const SORT_MODE_LABELS: Record<TagManagerSortMode, string> = {
  frequency: 'Haeufigkeit',
  'alpha-asc': 'A-Z',
  'alpha-desc': 'Z-A',
}
const TAG_CATEGORY_DEFINITIONS: GalleryTagCategoryDefinition[] = [
  {
    id: 'people',
    label: 'Menschen',
    icon: Smile,
    keywords: [
      'mensch',
      'person',
      'people',
      'portrait',
      'portraet',
      'gesicht',
      'face',
      'mann',
      'frau',
      'kind',
      'junge',
      'familie',
      'gruppe',
      'baby',
      'haende',
      'hand',
      'haare',
      'laecheln',
      'figur',
    ],
  },
  {
    id: 'animals',
    label: 'Tiere',
    icon: PawPrint,
    keywords: [
      'tierportrait',
      'tierportraet',
      'animalportrait',
      'tier',
      'animal',
      'wildtier',
      'wildlife',
      'hund',
      'dog',
      'katze',
      'cat',
      'vogel',
      'bird',
      'ente',
      'mandarinente',
      'gans',
      'pferd',
      'horse',
      'fisch',
      'fish',
      'biene',
      'eichhoernchen',
      'insect',
      'insekt',
      'schmetterling',
      'butterfly',
      'zoo',
    ],
  },
  {
    id: 'plants',
    label: 'Pflanzen & Blumen',
    icon: Sprout,
    keywords: [
      'pflanze',
      'plant',
      'blume',
      'flower',
      'tulpe',
      'lavendel',
      'blatt',
      'leaf',
      'fruehling',
      'spring',
      'garten',
      'garden',
    ],
  },
  {
    id: 'nature',
    label: 'Natur & Landschaft',
    icon: TreePine,
    keywords: [
      'natur',
      'landschaft',
      'landscape',
      'baum',
      'baeum',
      'wald',
      'forest',
      'berg',
      'berge',
      'mountain',
      'see',
      'lake',
      'fluss',
      'river',
      'meer',
      'ocean',
      'strand',
      'beach',
      'wiese',
      'wasser',
      'water',
      'teich',
      'allee',
      'weg',
      'outdoor',
      'imfreien',
    ],
  },
  {
    id: 'weatherLight',
    label: 'Wetter & Licht',
    icon: Sun,
    keywords: [
      'himmel',
      'sky',
      'wolke',
      'wolken',
      'cloud',
      'sonne',
      'sun',
      'licht',
      'light',
      'tageslicht',
      'schatten',
      'shadow',
      'nacht',
      'night',
      'winter',
      'schnee',
      'snow',
      'eis',
      'ice',
      'luft',
      'wetter',
      'weather',
      'aussenaufnahme',
    ],
  },
  {
    id: 'places',
    label: 'Orte & Architektur',
    icon: Building2,
    keywords: [
      'architektur',
      'architecture',
      'gebaeude',
      'building',
      'haus',
      'home',
      'bauwerk',
      'stadt',
      'city',
      'strasse',
      'street',
      'bruecke',
      'bridge',
      'turm',
      'tower',
      'kirche',
      'church',
      'museum',
      'innenraum',
      'interior',
      'fenster',
      'window',
      'tuer',
      'door',
      'park',
      'dorf',
      'village',
      'fabrik',
      'industrie',
      'factory',
      'festung',
      'balkon',
      'parkplatz',
      'eingang',
      'platz',
      'ort',
      'place',
    ],
  },
  {
    id: 'art',
    label: 'Kunst & Kultur',
    icon: Brush,
    keywords: [
      'kunst',
      'art',
      'malen',
      'painting',
      'gemaelde',
      'illustration',
      'zeichnung',
      'drawing',
      'skulptur',
      'sculpture',
      'design',
      'musik',
      'music',
      'kultur',
      'culture',
      'historisch',
      'history',
      'antik',
      'vintage',
    ],
  },
  {
    id: 'composition',
    label: 'Bildstil & Perspektive',
    icon: Camera,
    keywords: [
      'nahaufnahme',
      'closeup',
      'makro',
      'macro',
      'detail',
      'blick',
      'perspektive',
      'stillleben',
      'szene',
      'silhouette',
      'silhouetten',
      'formation',
      'dynamik',
      'gross',
      'large',
    ],
  },
  {
    id: 'technologyMedia',
    label: 'Technik & Medien',
    icon: Cpu,
    keywords: [
      'technik',
      'technology',
      'computer',
      'digital',
      'elektronik',
      'electronic',
      'smartphone',
      'phone',
      'telefon',
      'kamera',
      'camera',
      'foto',
      'photo',
      'video',
      'film',
      'screen',
      'bildschirm',
      'maschine',
      'machine',
      'robot',
      'ki',
      'ai',
    ],
  },
  {
    id: 'scienceSpace',
    label: 'Wissenschaft & Raumfahrt',
    icon: Rocket,
    keywords: [
      'wissenschaft',
      'science',
      'forschung',
      'research',
      'raumfahrt',
      'spaceflight',
      'raumstation',
      'weltraum',
      'space',
      'schwerelosigkeit',
      'astronaut',
      'astronautin',
    ],
  },
  {
    id: 'transportTravel',
    label: 'Verkehr & Reisen',
    icon: Car,
    keywords: [
      'verkehr',
      'transport',
      'reise',
      'travel',
      'fahrzeug',
      'vehicle',
      'auto',
      'car',
      'bus',
      'bahn',
      'zug',
      'train',
      'tram',
      'rad',
      'bike',
      'fahrrad',
      'flugzeug',
      'plane',
      'boot',
      'boat',
      'schiff',
      'ship',
      'hafen',
      'harbor',
      'strasse',
      'road',
    ],
  },
  {
    id: 'activities',
    label: 'Aktivitaeten',
    icon: Activity,
    keywords: [
      'aktivitaet',
      'activity',
      'sport',
      'spiel',
      'game',
      'spielen',
      'bewegung',
      'motion',
      'tanz',
      'dance',
      'arbeit',
      'work',
      'freizeit',
      'hobby',
      'feier',
      'party',
      'festival',
      'event',
      'urlaub',
      'vacation',
      'feierlich',
    ],
  },
  {
    id: 'food',
    label: 'Essen & Alltag',
    icon: Utensils,
    keywords: [
      'essen',
      'food',
      'gericht',
      'meal',
      'obst',
      'fruit',
      'gemuese',
      'vegetable',
      'paprika',
      'lebensmittel',
      'frisch',
      'kaffee',
      'coffee',
      'tee',
      'tea',
      'kueche',
      'kitchen',
      'tisch',
      'table',
      'getraenk',
      'drink',
      'alltag',
      'daily',
    ],
  },
  {
    id: 'colorMood',
    label: 'Farben & Stimmung',
    icon: Palette,
    keywords: [
      'farbe',
      'color',
      'gruen',
      'green',
      'blau',
      'blue',
      'rot',
      'red',
      'gelb',
      'yellow',
      'grau',
      'gray',
      'braun',
      'brown',
      'lila',
      'purple',
      'gold',
      'weiss',
      'white',
      'schwarzweiss',
      'sepia',
      'retro',
      'schwarz',
      'black',
      'dunkel',
      'dark',
      'hell',
      'light',
      'bunt',
      'colorful',
      'warm',
      'kalt',
      'cold',
      'stimmung',
      'mood',
      'ruhig',
      'calm',
      'dramatisch',
      'dramatic',
      'lebendig',
      'luxus',
    ],
  },
  {
    id: 'fashion',
    label: 'Mode & Kleidung',
    icon: Shirt,
    keywords: [
      'mode',
      'fashion',
      'kleidung',
      'clothing',
      'outfit',
      'jumpsuit',
      'overall',
      'anzug',
      'suit',
      'kleid',
      'dress',
      'rock',
      'skirt',
      'hose',
      'pants',
      'jeans',
      'hemd',
      'shirt',
      'tshirt',
      't-shirt',
      'pullover',
      'sweater',
      'mantel',
      'coat',
      'jacke',
      'lederjacke',
      'schuh',
      'schuhe',
      'shoe',
      'sneaker',
      'hut',
      'hat',
      'muetze',
      'cap',
      'accessoire',
      'accessory',
      'schmuck',
      'jewelry',
    ],
  },
  {
    id: 'textSigns',
    label: 'Text & Zeichen',
    icon: Type,
    keywords: [
      'text',
      'schrift',
      'zeichen',
      'symbol',
      'schild',
      'beschilderung',
      'hinweisschild',
      'verkehrsschild',
      'information',
      'nummer',
      'zahl',
      'typografie',
      'logo',
    ],
  },
  {
    id: 'materials',
    label: 'Materialien & Texturen',
    icon: Shapes,
    keywords: [
      'material',
      'metall',
      'metal',
      'holz',
      'wood',
      'stein',
      'stone',
      'glas',
      'glass',
      'samt',
      'stoff',
      'fabric',
      'leder',
      'leather',
      'struktur',
      'textur',
      'texture',
      'muster',
      'pattern',
      'keramik',
      'gefaess',
    ],
  },
  {
    id: 'objects',
    label: 'Objekte & Formen',
    icon: Shapes,
    keywords: [
      'objekt',
      'object',
      'ding',
      'item',
      'form',
      'shape',
      'werkzeug',
      'tool',
      'moebel',
      'furniture',
      'stuhl',
      'chair',
      'sofa',
      'lampe',
      'lamp',
      'uhr',
      'clock',
      'krug',
      'vase',
      'schmuck',
      'tasche',
      'bag',
    ],
  },
  {
    id: 'themes',
    label: 'Themen & Motive',
    icon: Tags,
    keywords: [],
  },
  {
    id: 'unresolved',
    label: 'Ungeordnet',
    icon: Tags,
    keywords: [],
  },
]

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

  if (conceptKey.length > 4 && conceptKey.endsWith('en')) {
    conceptKey = conceptKey.slice(0, -2)
  } else if (conceptKey.length > 4 && conceptKey.endsWith('e')) {
    conceptKey = conceptKey.slice(0, -1)
  } else if (conceptKey.length > 4 && conceptKey.endsWith('s')) {
    conceptKey = conceptKey.slice(0, -1)
  }

  return conceptKey
}

export function getGalleryTagCategoryId(
  label: string,
  catalog?: Pick<TagCategoryCatalog, 'assignments' | 'categories'>
): GalleryTagCategoryId {
  const resolution = resolveTagCategory(label, catalog)
  return resolution.status === 'resolved' ? resolution.categoryId : 'unresolved'
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

function getTagManagerErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Aktion konnte nicht abgeschlossen werden.'
}

export function groupTagOptionsByCategory(
  options: GalleryTagFilterOption[],
  catalog?: Pick<TagCategoryCatalog, 'assignments' | 'categories'>
): GalleryTagCategoryGroup[] {
  const groupedOptions = new Map<GalleryTagCategoryId, GalleryTagFilterOption[]>()

  for (const option of options) {
    const categoryId = getGalleryTagCategoryId(option.label, catalog)
    groupedOptions.set(categoryId, [...(groupedOptions.get(categoryId) ?? []), option])
  }

  const catalogCategories = catalog?.categories ?? []
  const definitions: GalleryTagCategoryDefinition[] = catalogCategories.length > 0
    ? [
        ...catalogCategories.map((category) => ({
          id: category.id,
          label: category.label,
          icon: TAG_CATEGORY_ICON_MAP[category.iconId] ?? Tags,
          keywords: category.keywords,
        })),
        { id: 'unresolved', label: 'Ungeordnet', icon: Tags, keywords: [] },
      ]
    : TAG_CATEGORY_DEFINITIONS

  return definitions.flatMap((category) => {
    const categoryOptions = groupedOptions.get(category.id) ?? []
    if (categoryOptions.length === 0) return []

    return [{
      category,
      options: categoryOptions,
      totalCount: countUniqueTaggedEntries(categoryOptions),
    }]
  })
}

function createMergeSuggestion(
  group: GalleryTagDuplicateGroup,
  selectedOption: GalleryTagFilterOption | null
): GalleryTagMergeSuggestion {
  return {
    ...group,
    targetLabel: group.canonicalLabel,
    mergeSourceLabels: group.sourceLabels,
    isSelectedTagRelated: selectedOption
      ? group.options.some((option) => option.label === selectedOption.label)
      : false,
  }
}

export default function UploadGalleryTagManagerDialog({
  tagOptions,
  activeTagFilterKeys,
  isBusy,
  busyOperation = null,
  onRenameTag,
  onRemoveTag,
  onEditEntryTags,
  tagCategoryCatalog,
  tagCategorySuggestions,
  onUpdateTagCategory,
  onClassifyUnknownTags,
  onCreateTagCategory,
  onDeleteTagCategory,
  onApplyTagFilters,
  onClose,
  paletteStyle,
}: UploadGalleryTagManagerDialogProps) {
  const [aiPhaseIndex, setAiPhaseIndex] = useState(0)
  const isClassifyingUnknownTags = busyOperation === 'ai-classification'

  useEffect(() => {
    if (!isClassifyingUnknownTags) {
      setAiPhaseIndex(0)
      return
    }

    const phaseTimers = [
      window.setTimeout(() => setAiPhaseIndex(1), 1200),
      window.setTimeout(() => setAiPhaseIndex(2), 4200),
    ]
    return () => phaseTimers.forEach((timer) => window.clearTimeout(timer))
  }, [isClassifyingUnknownTags])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<TagManagerSortMode>('alpha-asc')
  const [selectedTagKey, setSelectedTagKey] = useState<string | null>(tagOptions[0]?.id ?? null)
  const [targetLabel, setTargetLabel] = useState(tagOptions[0]?.label ?? '')
  const [manualTagLabel, setManualTagLabel] = useState('')
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [newCategoryIconId, setNewCategoryIconId] = useState<TagCategoryIconId>('tags')
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false)
  const [checkedTagKeys, setCheckedTagKeys] = useState<Set<string>>(() => new Set(activeTagFilterKeys))
  const initialCategoryIds = useMemo(
    () => [...tagCategoryCatalog.categories.map((category) => category.id), 'unresolved'],
    [tagCategoryCatalog.categories]
  )
  const knownCategoryIdsRef = useRef(new Set(initialCategoryIds))
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<GalleryTagCategoryId>>(
    () => new Set(initialCategoryIds)
  )
  const [showAllUnresolvedTags, setShowAllUnresolvedTags] = useState(false)

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
  const visibleTagGroups = useMemo(
    () => groupTagOptionsByCategory(visibleTagOptions, tagCategoryCatalog),
    [tagCategoryCatalog, visibleTagOptions]
  )
  const selectedOption =
    tagOptions.find((option) => option.id === selectedTagKey)
    ?? visibleTagOptions[0]
    ?? tagOptions[0]
    ?? null
  const selectedTagCount = selectedOption ? getTagUsageCount(selectedOption) : 0
  const selectedTagShare = totalTaggedEntries > 0
    ? Math.round((selectedTagCount / totalTaggedEntries) * 100)
    : 0
  const duplicateGroups = useMemo(() => getDuplicateGroups(tagOptions), [tagOptions])
  const activeMergeSuggestion = useMemo<GalleryTagMergeSuggestion | null>(() => {
    const selectedGroup = selectedOption
      ? duplicateGroups.find((duplicateGroup) =>
        duplicateGroup.options.some((option) => option.label === selectedOption.label)
      )
      : null
    const group = selectedGroup ?? duplicateGroups[0] ?? null
    if (!group) return null

    return createMergeSuggestion(group, selectedOption)
  }, [duplicateGroups, selectedOption])
  const normalizedTarget = targetLabel.replace(/\s+/g, ' ').trim()
  const canRename = Boolean(selectedOption && normalizedTarget && normalizedTarget !== selectedOption.label)
  const selectedEntryIds = useMemo(() => Array.from(new Set(
    tagOptions
      .filter((option) => checkedTagKeys.has(option.id))
      .flatMap((option) => option.entryIds ?? [])
  )), [checkedTagKeys, tagOptions])
  const normalizedManualTagLabel = manualTagLabel.replace(/^#+/, '').replace(/\s+/g, ' ').trim()
  const normalizedNewCategoryLabel = newCategoryLabel.replace(/\s+/g, ' ').trim()
  const unresolvedTagLabels = useMemo(
    () => tagOptions
      .filter((option) => resolveTagCategory(option.label, tagCategoryCatalog).status === 'unresolved')
      .map((option) => option.label),
    [tagCategoryCatalog, tagOptions]
  )
  const selectedCategoryResolution: TagCategoryResolution = selectedOption
    ? resolveTagCategory(selectedOption.label, tagCategoryCatalog)
    : { status: 'unresolved' }
  const selectedCategoryId = selectedCategoryResolution.status === 'resolved'
    ? selectedCategoryResolution.categoryId
    : ''

  useEffect(() => {
    if (!feedbackMessage) return undefined

    const timeoutId = window.setTimeout(() => setFeedbackMessage(null), TAG_MANAGER_FEEDBACK_MS)
    return () => window.clearTimeout(timeoutId)
  }, [feedbackMessage])

  useEffect(() => {
    const availableTagKeys = new Set(tagOptions.map((option) => option.id))
    setCheckedTagKeys((current) => {
      const nextKeys = Array.from(current).filter((key) => availableTagKeys.has(key))
      if (nextKeys.length === current.size) return current

      return new Set(nextKeys)
    })
  }, [tagOptions])

  useEffect(() => {
    const newCategoryIds = initialCategoryIds.filter((categoryId) => !knownCategoryIdsRef.current.has(categoryId))
    if (newCategoryIds.length === 0) return

    newCategoryIds.forEach((categoryId) => knownCategoryIdsRef.current.add(categoryId))
    setCollapsedCategoryIds((current) => new Set([...current, ...newCategoryIds]))
  }, [initialCategoryIds])

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

  const toggleTagFilter = (option: GalleryTagFilterOption, checked: boolean) => {
    setCheckedTagKeys((current) => {
      const nextKeys = new Set(current)
      if (checked) {
        nextKeys.add(option.id)
      } else {
        nextKeys.delete(option.id)
      }

      return nextKeys
    })
  }

  const toggleCategory = (categoryId: GalleryTagCategoryId) => {
    setCollapsedCategoryIds((current) => {
      const nextCategoryIds = new Set(current)
      if (nextCategoryIds.has(categoryId)) {
        nextCategoryIds.delete(categoryId)
      } else {
        nextCategoryIds.add(categoryId)
      }

      return nextCategoryIds
    })
  }

  const handleApplyTagFilters = () => {
    onApplyTagFilters(Array.from(checkedTagKeys))
  }

  const handleResetTagFilters = () => {
    setCheckedTagKeys(new Set())
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
    if (!activeMergeSuggestion) return

    for (const source of activeMergeSuggestion.mergeSourceLabels) {
      await onRenameTag(source, activeMergeSuggestion.targetLabel)
    }

    setFeedbackMessage(
      `${activeMergeSuggestion.mergeSourceLabels.length} ${activeMergeSuggestion.mergeSourceLabels.length === 1 ? 'Tag' : 'Tags'} wurden zu #${activeMergeSuggestion.targetLabel} zusammengefuehrt.`
    )
    setSelectedTagKey(activeMergeSuggestion.targetLabel.toLocaleLowerCase('de-DE'))
    setTargetLabel(activeMergeSuggestion.targetLabel)
    setConfirmingRemove(false)
  }

  const handleAddManualTag = async () => {
    if (!normalizedManualTagLabel || selectedEntryIds.length === 0) return
    await onEditEntryTags(selectedEntryIds, [normalizedManualTagLabel], [])
    setFeedbackMessage(`#${normalizedManualTagLabel} wurde ${formatTagCount(selectedEntryIds.length)} hinzugefuegt.`)
    setManualTagLabel('')
  }

  const handleCategoryChange = async (categoryId: string) => {
    if (!selectedOption) return
    await onUpdateTagCategory(
      [selectedOption.label],
      categoryId || null
    )
    setFeedbackMessage(
      categoryId
        ? `#${selectedOption.label} wurde manuell eingeordnet.`
        : `Manuelle Kategorie fuer #${selectedOption.label} wurde entfernt.`
    )
  }

  const handleCreateCategory = async () => {
    if (!normalizedNewCategoryLabel) return
    try {
      await onCreateTagCategory(normalizedNewCategoryLabel, newCategoryIconId)
      setFeedbackMessage(`Kategorie ${normalizedNewCategoryLabel} wurde angelegt.`)
      setNewCategoryLabel('')
      setNewCategoryIconId('tags')
    } catch (error) {
      setFeedbackMessage(`Kategorie konnte nicht angelegt werden: ${getTagManagerErrorMessage(error)}`)
    }
  }

  const handleClassifyUnknownTags = async () => {
    try {
      const batchLabels = unresolvedTagLabels.slice(0, TAG_CATEGORY_AI_BATCH_LIMIT)
      await onClassifyUnknownTags(batchLabels)
      setFeedbackMessage(`${batchLabels.length} unbekannte Tags wurden mit der KI-Kategorisierung abgeglichen.`)
    } catch (error) {
      setFeedbackMessage(`KI-Kategorisierung nicht verfuegbar: ${getTagManagerErrorMessage(error)}`)
    }
  }

  const handleConfirmSuggestion = async (suggestion: TagCategorySuggestion) => {
    try {
      await onCreateTagCategory(suggestion.label, suggestion.iconId, suggestion.matchingTags)
      setFeedbackMessage(`Kategorie ${suggestion.label} wurde bestaetigt.`)
    } catch (error) {
      setFeedbackMessage(`Vorschlag konnte nicht bestaetigt werden: ${getTagManagerErrorMessage(error)}`)
    }
  }

  return (
    <AnimatedDialog
      overlayClassName="gallery-tag-manager-overlay"
      dialogClassName="gallery-tag-manager-dialog"
      titleId="gallery-tag-manager-title"
      descriptionId="gallery-tag-manager-description"
      onClose={isBusy ? undefined : onClose}
      closeOnEscape={!isBusy}
      trapFocus
      restoreFocus
      lockScroll
      overlayStyle={paletteStyle}
    >
      <div className="gallery-tag-manager-header">
        <div>
          <span className="saved-games-kicker">Bild-Tags</span>
          <h3 id="gallery-tag-manager-title">Tags verwalten</h3>
        </div>
        <p id="gallery-tag-manager-description">
          {tagOptions.length} {tagOptions.length === 1 ? 'Tag' : 'Tags'} in {formatTagCount(totalTaggedEntries)}.
          Suche, bereinige und fuehre aehnliche Begriffe zusammen.
        </p>
      </div>

      <div className="gallery-tag-manager-search">
        <label
          className="gallery-tag-manager-search-field"
          data-app-tooltip="Tags nach Name oder Kategorie durchsuchen."
          data-app-tooltip-align="start"
        >
          <input
            aria-label="Tags durchsuchen"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tags durchsuchen..."
            disabled={(isBusy && !isClassifyingUnknownTags) || tagOptions.length === 0}
          />
        </label>
        <button
          type="button"
          className="secondary gallery-tag-manager-sort-button"
          onClick={() => setSortMode((current) => getNextSortMode(current))}
          disabled={(isBusy && !isClassifyingUnknownTags) || tagOptions.length === 0}
          aria-label={`Sortierung wechseln, aktuell ${SORT_MODE_LABELS[sortMode]}`}
          data-app-tooltip={`Sortierung wechseln. Aktuell: ${SORT_MODE_LABELS[sortMode]}.`}
          data-app-tooltip-position="top"
        >
          Sort: {SORT_MODE_LABELS[sortMode]}
        </button>
      </div>

      <div className="gallery-tag-manager-ai-actions">
        <div>
          <strong>Hybrid-Kategorisierung</strong>
          <span>
            {unresolvedTagLabels.length} unbekannte Tags warten auf eine Zuordnung.
            Die KI verarbeitet pro Durchlauf bis zu {TAG_CATEGORY_AI_BATCH_LIMIT}.
          </span>
        </div>
        <AnimatedButton
          className="secondary"
          onClick={() => {
            void handleClassifyUnknownTags()
          }}
          disabled={isBusy || unresolvedTagLabels.length === 0}
          busy={isClassifyingUnknownTags}
          busyLabel={`KI analysiert ${Math.min(unresolvedTagLabels.length, TAG_CATEGORY_AI_BATCH_LIMIT)} Tags ...`}
        >
          Unbekannte mit KI sortieren
        </AnimatedButton>
      </div>

      {isClassifyingUnknownTags ? (
        <AsyncStatusPanel
          className="gallery-tag-manager-ai-status"
          floating
          title={`KI sortiert ${Math.min(unresolvedTagLabels.length, TAG_CATEGORY_AI_BATCH_LIMIT)} unbekannte Tags`}
          phase={[
            'Anfrage wird vorbereitet.',
            'Die KI ordnet Begriffe passenden Kategorien zu.',
            'Ergebnisse werden geprueft und lokal gespeichert.',
          ][aiPhaseIndex]}
          detail="Bereits geoeffnete Kategorien und die Suche bleiben nutzbar."
          longWaitDetail="Die KI arbeitet noch. Bei vielen oder seltenen Begriffen kann die Zuordnung etwas laenger dauern."
        />
      ) : null}

      {tagCategorySuggestions.length > 0 ? (
        <div className="gallery-tag-manager-suggestions">
          <span className="saved-games-kicker">Neue Kategorien vorgeschlagen</span>
          {tagCategorySuggestions.map((suggestion) => (
            <div key={suggestion.temporaryId}>
              <span>
                <strong>{suggestion.label}</strong>
                <small>{suggestion.matchingTags.map((tag) => `#${tag}`).join(', ')}</small>
              </span>
              <p>{suggestion.reason}</p>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  void handleConfirmSuggestion(suggestion)
                }}
                disabled={isBusy}
              >
                Kategorie bestaetigen
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className={`gallery-tag-manager-body${isMobileDetailOpen ? ' is-detail-open' : ''}`}>
        <section className="gallery-tag-manager-list" aria-label="Tag-Liste">
          {visibleTagGroups.length > 0 ? (
            visibleTagGroups.map((group) => {
              const CategoryIcon = group.category.icon
              const isCollapsed = collapsedCategoryIds.has(group.category.id)
              const isLimitedUnresolvedGroup = group.category.id === 'unresolved'
                && !queryKey
                && group.options.length > UNRESOLVED_TAG_PREVIEW_LIMIT
              const displayedOptions = isLimitedUnresolvedGroup && !showAllUnresolvedTags
                ? group.options.slice(0, UNRESOLVED_TAG_PREVIEW_LIMIT)
                : group.options
              const selectedCount = group.options.reduce(
                (sum, option) => sum + (checkedTagKeys.has(option.id) ? 1 : 0),
                0
              )

              return (
                <div key={group.category.id} className="gallery-tag-manager-category">
                  <button
                    type="button"
                    className="gallery-tag-manager-category-toggle"
                    onClick={() => toggleCategory(group.category.id)}
                    aria-expanded={!isCollapsed}
                    disabled={isBusy}
                    data-app-tooltip={`${group.category.label} ${isCollapsed ? 'aufklappen' : 'einklappen'}.`}
                    data-app-tooltip-align="start"
                  >
                    <span className="gallery-tag-manager-category-title">
                      <CategoryIcon aria-hidden="true" size={17} strokeWidth={2.4} absoluteStrokeWidth />
                      <strong>{group.category.label}</strong>
                      {selectedCount > 0 ? (
                        <span
                          className="gallery-tag-manager-category-selected-count"
                          aria-label={`${selectedCount} ausgewaehlte Tags in ${group.category.label}`}
                          data-app-tooltip={`${selectedCount} Tags in dieser Kategorie sind als Filter ausgewaehlt.`}
                          data-app-tooltip-position="top"
                        >
                          {selectedCount}
                        </span>
                      ) : null}
                    </span>
                    <span className="gallery-tag-manager-category-meta">
                      <span className="gallery-tag-manager-category-stats">
                        {group.options.length} {group.options.length === 1 ? 'Tag' : 'Tags'} - {formatTagCount(group.totalCount)}
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={isCollapsed ? '' : 'is-open'}
                        size={16}
                        strokeWidth={2.5}
                        absoluteStrokeWidth
                      />
                    </span>
                  </button>

                  {!isCollapsed ? (
                    <div className="gallery-tag-manager-category-items">
                      {displayedOptions.map((option) => {
                        const optionCount = getTagUsageCount(option)
                        const usagePercent = Math.max(4, Math.round((optionCount / maxTagCount) * 100))
                        const isActive = selectedOption?.id === option.id
                        const isChecked = checkedTagKeys.has(option.id)

                        return (
                          <div
                            key={option.id}
                            className={`gallery-tag-manager-list-item${isActive ? ' is-active' : ''}${isBusy ? ' is-disabled' : ''}`}
                          >
                            <label className="gallery-tag-manager-tag-check">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(event) => toggleTagFilter(option, event.target.checked)}
                                disabled={isBusy}
                                aria-label={`#${option.label} fuer Galerie-Filter auswaehlen`}
                                data-app-tooltip={`#${option.label} ${isChecked ? 'aus Filter entfernen' : 'als Filter auswaehlen'}.`}
                                data-app-tooltip-position="right"
                              />
                            </label>
                            <button
                              type="button"
                              className="gallery-tag-manager-list-item-content"
                              onClick={() => selectTag(option)}
                              disabled={isBusy}
                              aria-current={isActive ? 'true' : undefined}
                              data-app-tooltip={`Details zu #${option.label} anzeigen.`}
                              data-app-tooltip-align="start"
                            >
                              <span className="gallery-tag-manager-list-item-main">
                                <strong>#{option.label}</strong>
                                <span>{formatTagCount(optionCount)}</span>
                              </span>
                              <span className="gallery-tag-manager-list-item-meter" aria-hidden="true">
                                <span style={{ width: `${usagePercent}%` }} />
                              </span>
                            </button>
                          </div>
                        )
                      })}
                      {isLimitedUnresolvedGroup ? (
                        <button
                          type="button"
                          className="secondary gallery-tag-manager-show-more"
                          onClick={() => setShowAllUnresolvedTags((current) => !current)}
                          disabled={isBusy}
                        >
                          {showAllUnresolvedTags
                            ? 'Weniger anzeigen'
                            : `${group.options.length - UNRESOLVED_TAG_PREVIEW_LIMIT} weitere Tags anzeigen`}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
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
            data-app-tooltip="Auf kleinen Bildschirmen zur Tag-Liste zurueckkehren."
            data-app-tooltip-position="top"
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

              <div className="gallery-tag-manager-category-editor">
                <label>
                  <span>Kategorie</span>
                  <select
                    value={selectedCategoryId}
                    onChange={(event) => {
                      void handleCategoryChange(event.target.value)
                    }}
                    disabled={isBusy}
                  >
                    <option value="">Ungeordnet</option>
                    {tagCategoryCatalog.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <small>
                  Quelle: {
                    selectedCategoryResolution.status === 'unresolved'
                      ? 'noch nicht zugeordnet'
                      : selectedCategoryResolution.source === 'manual'
                        ? 'manuell bestaetigt'
                        : selectedCategoryResolution.source === 'ai'
                          ? 'gelernter Cache'
                          : 'statische Taxonomie'
                  }
                </small>
                {selectedCategoryResolution.status === 'resolved'
                  && selectedCategoryResolution.source !== 'static' ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        void handleCategoryChange('')
                      }}
                      disabled={isBusy}
                    >
                      Manuelle Zuordnung entfernen
                    </button>
                  ) : null}
                {selectedCategoryResolution.status === 'resolved'
                  && tagCategoryCatalog.categories.find((category) => category.id === selectedCategoryId)?.source === 'manual' ? (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        void onDeleteTagCategory(selectedCategoryId)
                      }}
                      disabled={isBusy}
                    >
                      Eigene Kategorie loeschen
                    </button>
                  ) : null}
              </div>

              <label
                className="gallery-tag-manager-detail-field"
                data-app-tooltip="Tag umbenennen oder mehrere Varianten auf denselben Namen setzen."
                data-app-tooltip-align="start"
              >
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

              {activeMergeSuggestion ? (
                <div className="gallery-tag-manager-detail-similar">
                  <span className="saved-games-kicker">Aehnliche Tags</span>
                  <strong>
                    Zu #{activeMergeSuggestion.targetLabel} zusammenfuehren
                  </strong>
                  <p>
                    {activeMergeSuggestion.isSelectedTagRelated
                      ? 'Diese Varianten gehoeren zum ausgewaehlten Tag.'
                      : 'Naechster gefundener Vorschlag in deiner Tagliste.'}
                  </p>
                  <div>
                    {activeMergeSuggestion.mergeSourceLabels.map((source) => (
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
                    data-app-tooltip="Aehnliche Tag-Varianten zu einem Tag zusammenfuehren."
                    data-app-tooltip-position="top"
                  >
                    Zusammenfuehren
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
                      data-app-tooltip="Tag aus allen betroffenen Galerie-Eintraegen entfernen."
                      data-app-tooltip-position="top"
                    >
                      Ja, entfernen
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setConfirmingRemove(false)}
                      disabled={isBusy}
                      data-app-tooltip="Entfernen abbrechen."
                      data-app-tooltip-position="top"
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
                  disabled={!canRename || isClassifyingUnknownTags}
                  busy={isBusy && !isClassifyingUnknownTags}
                  busyLabel="Speichert ..."
                  data-app-tooltip="Ausgewaehlten Tag auf den neuen Namen umbenennen."
                  data-app-tooltip-position="top"
                >
                  Umbenennen
                </AnimatedButton>
                <AnimatedButton
                  className="secondary"
                  onClick={() => setConfirmingRemove(true)}
                  disabled={isBusy}
                  data-app-tooltip="Entfernen bestaetigen lassen."
                  data-app-tooltip-position="top"
                >
                  Entfernen
                </AnimatedButton>
              </div>

              <form
                className="gallery-tag-manager-manual-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleAddManualTag()
                }}
              >
                <span className="saved-games-kicker">Manueller Batch-Tag</span>
                <p>
                  Fuegt einen eigenen Tag zu den Motiven hinzu, die links per Checkbox ausgewaehlt sind.
                </p>
                <input
                  value={manualTagLabel}
                  onChange={(event) => setManualTagLabel(event.target.value)}
                  placeholder="Eigenen Tag eingeben..."
                  maxLength={40}
                  disabled={isBusy}
                />
                <button
                  type="submit"
                  className="secondary"
                  disabled={isBusy || !normalizedManualTagLabel || selectedEntryIds.length === 0}
                >
                  Zu {formatTagCount(selectedEntryIds.length)} hinzufuegen
                </button>
              </form>
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

      <form
        className="gallery-tag-manager-create-category"
        onSubmit={(event) => {
          event.preventDefault()
          void handleCreateCategory()
        }}
      >
        <span className="saved-games-kicker">Eigene Kategorie</span>
        <input
          value={newCategoryLabel}
          onChange={(event) => setNewCategoryLabel(event.target.value)}
          placeholder="Kategoriename..."
          maxLength={60}
          disabled={isBusy}
        />
        <select
          value={newCategoryIconId}
          onChange={(event) => setNewCategoryIconId(event.target.value as TagCategoryIconId)}
          disabled={isBusy}
          aria-label="Icon fuer neue Kategorie"
        >
          {TAG_CATEGORY_ICON_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <button type="submit" className="secondary" disabled={isBusy || !normalizedNewCategoryLabel}>
          Kategorie anlegen
        </button>
      </form>

      <div className="gallery-tag-manager-actions">
        <div className="gallery-tag-manager-filter-actions">
          <AnimatedButton
            className="secondary"
            onClick={handleResetTagFilters}
            disabled={isBusy || checkedTagKeys.size === 0}
            data-app-tooltip="Alle im Tag-Manager ausgewaehlten Tag-Filter entfernen."
            data-app-tooltip-position="top"
          >
            Auswahl zuruecksetzen
          </AnimatedButton>
          <AnimatedButton
            className="gallery-tag-manager-apply-filter"
            onClick={handleApplyTagFilters}
            disabled={isBusy}
            data-app-tooltip="Ausgewaehlte Tags als UND-Filter auf die Galerie anwenden."
            data-app-tooltip-position="top"
          >
            Filter anwenden ({checkedTagKeys.size})
          </AnimatedButton>
        </div>
        <AnimatedButton
          className="secondary"
          onClick={onClose}
          disabled={isBusy}
          data-app-tooltip="Tag-Manager schliessen."
          data-app-tooltip-position="top"
        >
          Schliessen
        </AnimatedButton>
      </div>
    </AnimatedDialog>
  )
}
