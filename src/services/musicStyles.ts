export type MusicStyleId =
  | 'acoustic-pop-breeze'
  | 'piano-focus'
  | 'blues-lane'
  | 'folk-pop-trail'
  | 'reggae-sun'
  | 'ska-skank'
  | 'brit-pop-bounce'
  | 'funk-rock-jam'
  | 'pop-rock-drive'
  | 'surf-rock-roll'
  | 'alternative-rock-pulse'
  | 'garage-rock'
  | 'punk-rock-spark'
  | 'hard-rock-charge'
  | 'heavy-metal-storm'

export interface JamendoDiscoveryProfile {
  order: string
  fuzzytags: string
  speed?: string
  exactTags?: string[]
  featured?: boolean
  vocalinstrumental?: 'instrumental' | 'vocal'
  acousticelectric?: 'acoustic' | 'electric'
  limit?: number
}

export interface MusicStyleDefinition {
  id: MusicStyleId
  label: string
  shortLabel: string
  description: string
  discoveryProfiles: JamendoDiscoveryProfile[]
}

export const DEFAULT_MUSIC_STYLE_ID: MusicStyleId = 'acoustic-pop-breeze'

export const MUSIC_STYLE_DEFINITIONS: MusicStyleDefinition[] = [
  {
    id: 'acoustic-pop-breeze',
    label: 'Acoustic Pop Breeze',
    shortLabel: 'Acoustic',
    description: 'Locker, gitarrig und freundlich motivierend.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'low+medium',
        fuzzytags: 'acoustic+pop+guitar+uplifting',
        exactTags: ['pop'],
        acousticelectric: 'acoustic',
      },
      {
        order: 'popularity_month',
        speed: 'low+medium',
        fuzzytags: 'acoustic+indie+pop+light',
        acousticelectric: 'acoustic',
      },
      {
        order: 'popularity_week',
        speed: 'low+medium',
        fuzzytags: 'acoustic+guitar+melodic+bright',
        acousticelectric: 'acoustic',
        featured: false,
      },
    ],
  },
  {
    id: 'piano-focus',
    label: 'Piano Focus',
    shortLabel: 'Piano',
    description: 'Klar, melodisch und ruhig konzentriert.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'verylow+low',
        fuzzytags: 'piano+solo+minimal',
        exactTags: ['classical'],
        vocalinstrumental: 'instrumental',
      },
      {
        order: 'popularity_month',
        speed: 'verylow+low',
        fuzzytags: 'piano+melodic+cinematic',
        exactTags: ['classical'],
        vocalinstrumental: 'instrumental',
      },
      {
        order: 'popularity_week',
        speed: 'low+medium',
        fuzzytags: 'piano+soft+focus+melody',
        vocalinstrumental: 'instrumental',
      },
    ],
  },
  {
    id: 'blues-lane',
    label: 'Blues Lane',
    shortLabel: 'Blues',
    description: 'Etwas staubig, etwas rau und angenehm rollend.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'low+medium',
        fuzzytags: 'blues+guitar+shuffle+groove',
        exactTags: ['blues'],
        acousticelectric: 'electric',
        featured: false,
      },
      {
        order: 'popularity_month',
        speed: 'low+medium',
        fuzzytags: 'blues+rock+riff+road',
        exactTags: ['blues'],
        acousticelectric: 'electric',
        featured: false,
      },
      {
        order: 'popularity_week',
        speed: 'medium+high',
        fuzzytags: 'blues+guitar+jam+solo',
        acousticelectric: 'electric',
        featured: false,
      },
    ],
  },
  {
    id: 'folk-pop-trail',
    label: 'Folk Pop Trail',
    shortLabel: 'Folk Pop',
    description: 'Akustisch, offen und leicht nach Roadtrip.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'low+medium',
        fuzzytags: 'folk+pop+acoustic+guitar',
        exactTags: ['folk'],
        acousticelectric: 'acoustic',
      },
      {
        order: 'popularity_month',
        speed: 'low+medium',
        fuzzytags: 'folk+indie+uplifting+campfire',
        acousticelectric: 'acoustic',
        featured: false,
      },
      {
        order: 'popularity_week',
        speed: 'low+medium',
        fuzzytags: 'folk+pop+roadtrip+melodic',
        acousticelectric: 'acoustic',
        featured: false,
      },
    ],
  },
  {
    id: 'reggae-sun',
    label: 'Reggae Sun',
    shortLabel: 'Reggae',
    description: 'Entspanntes Offbeat-Gefuehl mit warmem Bass.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'low+medium',
        fuzzytags: 'reggae+groove+island+bass',
        exactTags: ['reggae'],
        featured: false,
      },
      {
        order: 'popularity_month',
        speed: 'low+medium',
        fuzzytags: 'dub+reggae+sunshine+guitar',
        exactTags: ['reggae'],
        featured: false,
      },
      {
        order: 'popularity_week',
        speed: 'medium+high',
        fuzzytags: 'roots+reggae+offbeat+groove',
        featured: false,
      },
    ],
  },
  {
    id: 'ska-skank',
    label: 'Ska Skank',
    shortLabel: 'Ska',
    description: 'Schneller Offbeat, mehr Blech und gute Laune.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'medium+high',
        fuzzytags: 'ska+brass+upbeat+guitar',
        exactTags: ['ska'],
        featured: false,
      },
      {
        order: 'popularity_month',
        speed: 'medium+high',
        fuzzytags: 'ska+punk+horns+dance',
        exactTags: ['ska'],
        featured: false,
      },
      {
        order: 'popularity_week',
        speed: 'medium+high',
        fuzzytags: 'ska+party+offbeat+rhythm',
        featured: false,
      },
    ],
  },
  {
    id: 'brit-pop-bounce',
    label: 'Brit Pop Bounce',
    shortLabel: 'Brit Pop',
    description: 'Melodische Gitarren mit leichtem Stadion-Flair.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'medium+high',
        fuzzytags: 'britpop+guitar+anthem+upbeat',
        exactTags: ['pop'],
        featured: false,
      },
      {
        order: 'popularity_month',
        speed: 'medium+high',
        fuzzytags: 'indie+britpop+guitar+drive',
        featured: false,
      },
      {
        order: 'popularity_week',
        speed: 'medium+high',
        fuzzytags: 'brit+pop+guitar+anthem',
        featured: false,
      },
    ],
  },
  {
    id: 'funk-rock-jam',
    label: 'Funk Rock Jam',
    shortLabel: 'Funk Rock',
    description: 'Bass vorne, Gitarren hinten und alles in Bewegung.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'medium+high',
        fuzzytags: 'funk+rock+bass+guitar',
        exactTags: ['rock'],
        acousticelectric: 'electric',
        featured: false,
      },
      {
        order: 'popularity_month',
        speed: 'medium+high',
        fuzzytags: 'funk+groove+riff+drums',
        exactTags: ['rock'],
        acousticelectric: 'electric',
        featured: false,
      },
      {
        order: 'popularity_week',
        speed: 'medium+high',
        fuzzytags: 'funk+rock+jam+groove',
        featured: false,
      },
    ],
  },
  {
    id: 'pop-rock-drive',
    label: 'Pop Rock Drive',
    shortLabel: 'Pop Rock',
    description: 'Radiotauglich, treibend und direkt motivierend.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'medium+high',
        fuzzytags: 'pop+rock+guitar+driving',
        exactTags: ['rock', 'pop'],
        featured: false,
      },
      {
        order: 'popularity_month',
        speed: 'medium+high',
        fuzzytags: 'pop+rock+anthem+uplifting',
        exactTags: ['rock'],
        featured: false,
      },
      {
        order: 'popularity_week',
        speed: 'medium+high',
        fuzzytags: 'guitar+pop+rock+bright',
        featured: false,
      },
    ],
  },
  {
    id: 'surf-rock-roll',
    label: 'Surf Rock Roll',
    shortLabel: 'Surf Rock',
    description: 'Twangige Gitarren, viel Bewegung und Meerwind.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'medium+high',
        fuzzytags: 'surf+rock+guitar+retro',
        exactTags: ['rock'],
        vocalinstrumental: 'instrumental',
        acousticelectric: 'electric',
        featured: false,
      },
      {
        order: 'popularity_month',
        speed: 'medium+high',
        fuzzytags: 'surf+twang+beach+guitar',
        vocalinstrumental: 'instrumental',
        acousticelectric: 'electric',
        featured: false,
      },
      {
        order: 'popularity_week',
        speed: 'medium+high',
        fuzzytags: 'instrumental+surf+rock+drive',
        vocalinstrumental: 'instrumental',
        acousticelectric: 'electric',
        featured: false,
      },
    ],
  },
  {
    id: 'alternative-rock-pulse',
    label: 'Alternative Rock Pulse',
    shortLabel: 'Alt Rock',
    description: 'Etwas dunkler, breiter und modern gitarrig.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'medium+high',
        fuzzytags: 'alternative+rock+guitar+energy',
        exactTags: ['rock'],
        acousticelectric: 'electric',
        featured: false,
      },
      {
        order: 'popularity_month',
        speed: 'medium+high',
        fuzzytags: 'alt+rock+indie+drums',
        acousticelectric: 'electric',
        featured: false,
      },
      {
        order: 'popularity_week',
        speed: 'medium+high',
        fuzzytags: 'alternative+guitar+driving+live',
        acousticelectric: 'electric',
        featured: false,
      },
    ],
  },
  {
    id: 'garage-rock',
    label: 'Garage Rock',
    shortLabel: 'Garage',
    description: 'Rau, schmutzig und direkt nach vorne.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'high+veryhigh',
        fuzzytags: 'garage+rock+riff+guitar',
        exactTags: ['rock'],
        acousticelectric: 'electric',
        featured: false,
      },
      {
        order: 'popularity_month',
        speed: 'high+veryhigh',
        fuzzytags: 'garage+punk+drums+guitar',
        exactTags: ['rock'],
        acousticelectric: 'electric',
        featured: false,
      },
      {
        order: 'popularity_week',
        speed: 'medium+high',
        fuzzytags: 'garage+indie+rock+raw',
        acousticelectric: 'electric',
        featured: false,
      },
    ],
  },
  {
    id: 'punk-rock-spark',
    label: 'Punk Rock Spark',
    shortLabel: 'Punk',
    description: 'Kurz, schnell, kantig und voller Vorwaertsdrang.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'high+veryhigh',
        fuzzytags: 'punk+rock+guitar+fast',
        exactTags: ['rock'],
        acousticelectric: 'electric',
        featured: false,
        limit: 12,
      },
      {
        order: 'popularity_month',
        speed: 'high+veryhigh',
        fuzzytags: 'punk+garage+drums+raw',
        acousticelectric: 'electric',
        featured: false,
        limit: 12,
      },
      {
        order: 'popularity_week',
        speed: 'high+veryhigh',
        fuzzytags: 'punk+riff+energy+live',
        acousticelectric: 'electric',
        featured: false,
        limit: 12,
      },
    ],
  },
  {
    id: 'hard-rock-charge',
    label: 'Hard Rock Charge',
    shortLabel: 'Hard Rock',
    description: 'Druckvoll, riffbetont und klar haerter angelegt.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'high+veryhigh',
        fuzzytags: 'hard+rock+guitar+riff',
        exactTags: ['rock'],
        acousticelectric: 'electric',
        featured: false,
        limit: 12,
      },
      {
        order: 'popularity_month',
        speed: 'high+veryhigh',
        fuzzytags: 'hard+rock+drums+power',
        exactTags: ['rock'],
        acousticelectric: 'electric',
        featured: false,
        limit: 12,
      },
      {
        order: 'popularity_week',
        speed: 'high+veryhigh',
        fuzzytags: 'hard+rock+solo+energy',
        acousticelectric: 'electric',
        featured: false,
        limit: 12,
      },
    ],
  },
  {
    id: 'heavy-metal-storm',
    label: 'Heavy Metal Storm',
    shortLabel: 'Metal',
    description: 'Die wildeste Ecke mit viel Druck und Metallkante.',
    discoveryProfiles: [
      {
        order: 'popularity_total',
        speed: 'high+veryhigh',
        fuzzytags: 'heavy+metal+guitar+power',
        exactTags: ['metal'],
        acousticelectric: 'electric',
        featured: false,
        limit: 12,
      },
      {
        order: 'popularity_month',
        speed: 'high+veryhigh',
        fuzzytags: 'metal+riff+drums+aggressive',
        exactTags: ['metal'],
        acousticelectric: 'electric',
        featured: false,
        limit: 12,
      },
      {
        order: 'popularity_week',
        speed: 'high+veryhigh',
        fuzzytags: 'heavy+rock+metal+solo',
        exactTags: ['metal'],
        acousticelectric: 'electric',
        featured: false,
        limit: 12,
      },
    ],
  },
]

const MUSIC_STYLE_DEFINITIONS_BY_ID = MUSIC_STYLE_DEFINITIONS.reduce<Record<MusicStyleId, MusicStyleDefinition>>(
  (definitions, definition) => {
    definitions[definition.id] = definition
    return definitions
  },
  {} as Record<MusicStyleId, MusicStyleDefinition>
)

export function isMusicStyleId(value: string): value is MusicStyleId {
  return value in MUSIC_STYLE_DEFINITIONS_BY_ID
}

export function getMusicStyleDefinition(styleId: string | null | undefined): MusicStyleDefinition {
  if (styleId && isMusicStyleId(styleId)) {
    return MUSIC_STYLE_DEFINITIONS_BY_ID[styleId]
  }

  return MUSIC_STYLE_DEFINITIONS_BY_ID[DEFAULT_MUSIC_STYLE_ID]
}
