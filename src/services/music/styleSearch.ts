import { getMusicStyleDefinition, type MusicStyleId } from '../musicStyles.ts'

const GENERIC_SEARCH_TOKENS = new Set([
  'music',
  'soundtrack',
  'soundscape',
  'study',
  'night',
  'summer',
  'driving',
  'live',
])

interface StyleMatchRule {
  requiredGroups: string[][]
  preferredTerms?: string[]
  minPreferredMatches?: number
}

const STYLE_MATCH_RULES: Record<MusicStyleId, StyleMatchRule> = {
  'acoustic-pop-breeze': {
    requiredGroups: [['acoustic'], ['pop']],
    preferredTerms: ['guitar', 'indie', 'melodic'],
  },
  'piano-focus': {
    requiredGroups: [['piano']],
    preferredTerms: ['solo', 'instrumental', 'minimal'],
  },
  'blues-lane': {
    requiredGroups: [['blues']],
    preferredTerms: ['guitar', 'shuffle', 'groove'],
  },
  'folk-pop-trail': {
    requiredGroups: [['folk']],
    preferredTerms: ['acoustic', 'pop', 'guitar'],
  },
  'reggae-sun': {
    requiredGroups: [['reggae', 'dub reggae', 'roots reggae']],
    preferredTerms: ['dub', 'offbeat', 'island'],
  },
  'ska-skank': {
    requiredGroups: [['ska']],
    preferredTerms: ['horns', 'brass', 'punk'],
  },
  'brit-pop-bounce': {
    requiredGroups: [['britpop', 'brit pop', 'brit-pop']],
    preferredTerms: ['guitar', 'anthem', 'indie'],
  },
  'funk-rock-jam': {
    requiredGroups: [['funk']],
    preferredTerms: ['rock', 'bass', 'groove'],
  },
  'pop-rock-drive': {
    requiredGroups: [['pop'], ['rock']],
    preferredTerms: ['guitar', 'anthem', 'driving'],
  },
  'surf-rock-roll': {
    requiredGroups: [['surf', 'surf rock', 'surf-rock']],
    preferredTerms: ['guitar', 'instrumental', 'beach'],
  },
  'alternative-rock-pulse': {
    requiredGroups: [['alternative rock', 'alternative', 'alt rock', 'alt-rock']],
    preferredTerms: ['guitar', 'indie', 'driving'],
  },
  'garage-rock': {
    requiredGroups: [['garage rock', 'garage-rock', 'garage']],
    preferredTerms: ['rock', 'punk', 'raw'],
  },
  'punk-rock-spark': {
    requiredGroups: [['punk', 'punk rock', 'punk-rock']],
    preferredTerms: ['rock', 'fast', 'guitar'],
  },
  'hard-rock-charge': {
    requiredGroups: [['hard rock', 'hard-rock']],
    preferredTerms: ['riff', 'guitar', 'power'],
  },
  'heavy-metal-storm': {
    requiredGroups: [['heavy metal', 'heavy-metal', 'metal']],
    preferredTerms: ['riff', 'guitar', 'power'],
  },
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+-]/g, '')
}

function normalizeSearchText(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized ? ` ${normalized} ` : ''
}

function containsSearchTerm(normalizedText: string, term: string): boolean {
  const normalizedTerm = normalizeSearchText(term).trim()
  if (!normalizedTerm) {
    return false
  }

  return normalizedText.includes(` ${normalizedTerm} `)
}

export function getMusicStyleKeywordVariants(styleId: MusicStyleId, maxTermsPerVariant: number = 4): string[][] {
  const definition = getMusicStyleDefinition(styleId)
  const variants = definition.discoveryProfiles
    .map((profile) => {
      const tokens = [
        ...profile.fuzzytags.split('+'),
        ...(profile.exactTags ?? []),
      ]
        .map(normalizeToken)
        .filter((token) => token && !GENERIC_SEARCH_TOKENS.has(token))

      return Array.from(new Set(tokens)).slice(0, maxTermsPerVariant)
    })
    .filter((tokens) => tokens.length > 0)

  const flattened = Array.from(new Set(variants.flat())).slice(0, Math.max(maxTermsPerVariant + 1, 6))
  if (flattened.length > 0) {
    variants.push(flattened)
  }

  return variants
}

export function getMusicStyleKeywords(styleId: MusicStyleId, maxTerms: number = 6): string[] {
  return Array.from(new Set(getMusicStyleKeywordVariants(styleId, maxTerms).flat())).slice(0, maxTerms)
}

export function getMusicStyleTempoHint(styleId: MusicStyleId): 'slow' | 'medium' | 'fast' {
  const definition = getMusicStyleDefinition(styleId)
  const speeds = definition.discoveryProfiles
    .map((profile) => profile.speed ?? '')
    .filter(Boolean)
    .join('+')

  if (speeds.includes('veryhigh') || speeds.includes('high')) {
    return 'fast'
  }

  if (speeds.includes('medium')) {
    return 'medium'
  }

  return 'slow'
}

export function stylePrefersInstrumental(styleId: MusicStyleId): boolean {
  const definition = getMusicStyleDefinition(styleId)
  return definition.discoveryProfiles.some((profile) => profile.vocalinstrumental === 'instrumental')
}

export function stylePrefersElectric(styleId: MusicStyleId): boolean {
  const definition = getMusicStyleDefinition(styleId)
  return definition.discoveryProfiles.some((profile) => profile.acousticelectric === 'electric')
}

export function buildMusicStyleMatchText(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
}

export function isStrictMusicStyleMatch(styleId: MusicStyleId, text: string): boolean {
  const rule = STYLE_MATCH_RULES[styleId]
  if (!rule) {
    return false
  }

  const normalizedText = normalizeSearchText(text)
  if (!normalizedText) {
    return false
  }

  const matchesRequiredGroups = rule.requiredGroups.every((group) =>
    group.some((term) => containsSearchTerm(normalizedText, term))
  )
  if (!matchesRequiredGroups) {
    return false
  }

  const preferredTerms = Array.from(new Set(rule.preferredTerms ?? []))
  const minPreferredMatches = Math.max(0, rule.minPreferredMatches ?? 0)
  if (minPreferredMatches === 0 || preferredTerms.length === 0) {
    return true
  }

  const preferredMatchCount = preferredTerms.filter((term) => containsSearchTerm(normalizedText, term)).length
  return preferredMatchCount >= minPreferredMatches
}
