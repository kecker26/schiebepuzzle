import type {
  ChallengeMedal,
  GalleryChallengeTarget,
  PuzzleAssistanceMode,
  SolvedGalleryEntry,
  WinStats,
} from '../types/index.ts'

const CHALLENGE_MEDAL_RANK: Record<ChallengeMedal, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  diamond: 4,
}

const CHALLENGE_MEDALS_ASCENDING: ChallengeMedal[] = ['bronze', 'silver', 'gold', 'diamond']
const MIN_REACHABLE_MOVE_COUNT = 1

export const CHALLENGE_GOLD_IMPROVEMENT_PERCENT = 20
const CHALLENGE_GOLD_TARGET_FACTOR = (100 - CHALLENGE_GOLD_IMPROVEMENT_PERCENT) / 100
export const CHALLENGE_DIAMOND_IMPROVEMENT_PERCENT = 40
const CHALLENGE_DIAMOND_TARGET_FACTOR = (100 - CHALLENGE_DIAMOND_IMPROVEMENT_PERCENT) / 100

type ChallengeTargetMetrics = Pick<GalleryChallengeTarget, 'time' | 'moves'>

export type ChallengeMedalAvailability = Record<ChallengeMedal, boolean>

export const CHALLENGE_MEDAL_COLORS: Record<ChallengeMedal, string> = {
  diamond: '#67e8f9',
  gold: '#fbbf24',
  silver: '#cbd5e1',
  bronze: '#fb923c',
}

export function getChallengeGoldTargets(target: Pick<GalleryChallengeTarget, 'time' | 'moves'>): {
  time: number
  moves: number
} {
  return {
    time: Math.floor(target.time * CHALLENGE_GOLD_TARGET_FACTOR),
    moves: Math.floor(target.moves * CHALLENGE_GOLD_TARGET_FACTOR),
  }
}

export function getChallengeDiamondTargets(target: Pick<GalleryChallengeTarget, 'time' | 'moves'>): {
  time: number
  moves: number
} {
  return {
    time: Math.floor(target.time * CHALLENGE_DIAMOND_TARGET_FACTOR),
    moves: Math.floor(target.moves * CHALLENGE_DIAMOND_TARGET_FACTOR),
  }
}

export function getChallengeMedalRank(medal: ChallengeMedal): number {
  return CHALLENGE_MEDAL_RANK[medal]
}

function canBeatChallengeTime(target: ChallengeTargetMetrics): boolean {
  return Number.isFinite(target.time) && target.time > 0
}

function canBeatChallengeMoves(target: ChallengeTargetMetrics): boolean {
  return Number.isFinite(target.moves) && target.moves > MIN_REACHABLE_MOVE_COUNT
}

export function getChallengeMedalAvailability(target: ChallengeTargetMetrics): ChallengeMedalAvailability {
  const goldTargets = getChallengeGoldTargets(target)
  const diamondTargets = getChallengeDiamondTargets(target)
  const canBeatTime = canBeatChallengeTime(target)
  const canBeatMoves = canBeatChallengeMoves(target)

  return {
    bronze: canBeatTime || canBeatMoves,
    silver: canBeatTime && canBeatMoves,
    gold: canBeatTime && goldTargets.moves >= MIN_REACHABLE_MOVE_COUNT,
    diamond: canBeatTime && diamondTargets.moves >= MIN_REACHABLE_MOVE_COUNT,
  }
}

function isChallengeMedalAvailable(target: ChallengeTargetMetrics, medal: ChallengeMedal): boolean {
  return getChallengeMedalAvailability(target)[medal]
}

export function deriveChallengeMedal(
  stats: WinStats,
  target: GalleryChallengeTarget
): ChallengeMedal | null {
  const isClean = isChallengeCleanRun(stats)
  const availability = getChallengeMedalAvailability(target)
  const beatTime = canBeatChallengeTime(target) && stats.time < target.time
  const beatMoves = canBeatChallengeMoves(target) && stats.moves < target.moves
  const goldTargets = getChallengeGoldTargets(target)
  const diamondTargets = getChallengeDiamondTargets(target)
  const reachedGoldTime = stats.time <= goldTargets.time
  const reachedGoldMoves = stats.moves <= goldTargets.moves
  const reachedDiamondTime = stats.time <= diamondTargets.time
  const reachedDiamondMoves = stats.moves <= diamondTargets.moves

  if (!isClean) return null
  if (availability.diamond && reachedDiamondTime && reachedDiamondMoves) return 'diamond'
  if (availability.gold && reachedGoldTime && reachedGoldMoves) return 'gold'
  if (availability.silver && beatTime && beatMoves) return 'silver'
  if (availability.bronze && (beatTime || beatMoves)) return 'bronze'
  return null
}

export interface LiveChallengeForecast {
  medal: ChallengeMedal | null
  diamondAvailable: boolean
  goldAvailable: boolean
  isClean: boolean
  timeReached: boolean
  movesReached: boolean
  timeBeaten: boolean
  movesBeaten: boolean
  goldTimeReached: boolean
  goldMovesReached: boolean
}

export function isChallengeDiamondAvailable(target: GalleryChallengeTarget): boolean {
  return isChallengeMedalAvailable(target, 'diamond')
}

export function isChallengeGoldAvailable(target: GalleryChallengeTarget): boolean {
  return isChallengeMedalAvailable(target, 'gold')
}

export function deriveLiveChallengeForecast(
  metrics: {
    moves: number
    time: number
    assistanceMode: PuzzleAssistanceMode
    ghostUsageCount?: number
    heatmapUsageCount?: number
  },
  target: GalleryChallengeTarget
): LiveChallengeForecast {
  const isClean = isChallengeCleanRun(metrics)
  const availability = getChallengeMedalAvailability(target)
  const timeReached = canBeatChallengeTime(target) && metrics.time <= target.time
  const movesReached = canBeatChallengeMoves(target) && metrics.moves <= target.moves
  const timeBeaten = canBeatChallengeTime(target) && metrics.time < target.time
  const movesBeaten = canBeatChallengeMoves(target) && metrics.moves < target.moves
  const goldTargets = getChallengeGoldTargets(target)
  const diamondTargets = getChallengeDiamondTargets(target)
  const goldTimeReached = metrics.time <= goldTargets.time
  const goldMovesReached = metrics.moves <= goldTargets.moves
  const diamondTimeReached = metrics.time <= diamondTargets.time
  const diamondMovesReached = metrics.moves <= diamondTargets.moves
  const diamondAvailable = availability.diamond
  const goldAvailable = availability.gold

  const medal =
    !isClean
      ? null
      : availability.diamond && diamondTimeReached && diamondMovesReached
      ? 'diamond'
      : availability.gold && goldTimeReached && goldMovesReached
        ? 'gold'
        : availability.silver && timeBeaten && movesBeaten
          ? 'silver'
          : availability.bronze && (timeBeaten || movesBeaten)
            ? 'bronze'
            : null

  return {
    medal,
    diamondAvailable,
    goldAvailable,
    isClean,
    timeReached,
    movesReached,
    timeBeaten,
    movesBeaten,
    goldTimeReached,
    goldMovesReached,
  }
}

export interface ChallengeMedalGoal {
  medal: ChallengeMedal | null
  label: string
}

export function getNextChallengeMedalGoal(
  stats: WinStats,
  target: GalleryChallengeTarget,
  medal: ChallengeMedal | null
): ChallengeMedalGoal {
  const isClean = isChallengeCleanRun(stats)
  const availability = getChallengeMedalAvailability(target)
  const currentRank = medal ? getChallengeMedalRank(medal) : 0
  const nextAvailableMedal = CHALLENGE_MEDALS_ASCENDING.find(
    (candidate) => getChallengeMedalRank(candidate) > currentRank && availability[candidate]
  ) ?? null
  const timeGapToBeat = Math.max(0, stats.time - target.time + 1)
  const movesGapToBeat = Math.max(0, stats.moves - target.moves + 1)
  const goldTargets = getChallengeGoldTargets(target)
  const diamondTargets = getChallengeDiamondTargets(target)
  const timeGapToGold = Math.max(0, stats.time - goldTargets.time)
  const movesGapToGold = Math.max(0, stats.moves - goldTargets.moves)
  const timeGapToDiamond = Math.max(0, stats.time - diamondTargets.time)
  const movesGapToDiamond = Math.max(0, stats.moves - diamondTargets.moves)

  if (!isClean) {
    return {
      medal: nextAvailableMedal,
      label: nextAvailableMedal
        ? 'Ohne Hilfe neu starten. Medaillen werden nur fuer absolut cleane Laeufe vergeben.'
        : 'Diese Vorlage enthaelt keine erreichbaren Medaillenziele.',
    }
  }

  if (!nextAvailableMedal) {
    return {
      medal: null,
      label: medal === null
        ? 'Diese Vorlage enthaelt keine erreichbaren Medaillenziele.'
        : 'Hoechste verfuegbare Medaillenstufe erreicht.',
    }
  }

  if (nextAvailableMedal === 'bronze') {
    const bronzeRequirements = [
      canBeatChallengeTime(target) && timeGapToBeat > 0 ? `${timeGapToBeat} Sek. schneller` : null,
      canBeatChallengeMoves(target) && movesGapToBeat > 0 ? `${movesGapToBeat} ${movesGapToBeat === 1 ? 'Zug' : 'Zuege'} weniger` : null,
    ].filter((requirement): requirement is string => requirement !== null)

    return {
      medal: 'bronze',
      label: bronzeRequirements.join(' oder ') || 'Mindestens ein Ziel der Vorlage strikt unterbieten.',
    }
  }

  if (nextAvailableMedal === 'diamond') {
    const requirements = [
      timeGapToDiamond > 0 ? `${timeGapToDiamond} Sek. schneller bis zum 40-Prozent-Zeitziel` : null,
      movesGapToDiamond > 0 ? `${movesGapToDiamond} ${movesGapToDiamond === 1 ? 'Zug' : 'Zuege'} weniger bis zum 40-Prozent-Zugziel` : null,
    ].filter((requirement): requirement is string => requirement !== null)

    return {
      medal: 'diamond',
      label: requirements.length > 0
        ? requirements.join(' + ')
        : 'Zeit und Zuege jeweils um mindestens 40 % unterbieten.',
    }
  }

  if (nextAvailableMedal === 'gold') {
    const requirements = [
      timeGapToGold > 0 ? `${timeGapToGold} Sek. schneller bis zum 20-Prozent-Zeitziel` : null,
      movesGapToGold > 0 ? `${movesGapToGold} ${movesGapToGold === 1 ? 'Zug' : 'Zuege'} weniger bis zum 20-Prozent-Zugziel` : null,
    ].filter((requirement): requirement is string => requirement !== null)

    return {
      medal: 'gold',
      label: requirements.length > 0
        ? requirements.join(' + ')
        : 'Zeit und Zuege jeweils um mindestens 20 % unterbieten.',
    }
  }

  const silverRequirements = [
    canBeatChallengeTime(target) && timeGapToBeat > 0 ? `${timeGapToBeat} Sek. schneller bis unter das Zeitziel` : null,
    canBeatChallengeMoves(target) && movesGapToBeat > 0 ? `${movesGapToBeat} ${movesGapToBeat === 1 ? 'Zug' : 'Zuege'} weniger bis unter das Zugziel` : null,
  ].filter((requirement): requirement is string => requirement !== null)

  return {
    medal: 'silver',
    label: silverRequirements.join(' + ') || 'Beide Ziele der Vorlage strikt unterbieten.',
  }
}

export function getChallengeMedalExplanation(
  stats: WinStats,
  target: GalleryChallengeTarget,
  medal: ChallengeMedal | null
): string {
  if (!isChallengeCleanRun(stats)) {
    return 'Mit Hilfe abgeschlossen: Dieser Lauf bleibt eine Uebung und erhaelt keine Medaille.'
  }
  if (!CHALLENGE_MEDALS_ASCENDING.some((candidate) => getChallengeMedalAvailability(target)[candidate])) {
    return 'Challenge abgeschlossen, aber diese Vorlage enthaelt keine erreichbaren Medaillenziele.'
  }
  if (medal === null) return 'Challenge abgeschlossen, aber kein Ziel der Vorlage strikt unterboten.'
  if (medal === 'diamond') return 'Clean geloest und beide Ziele um mindestens 40 % unterboten.'
  if (medal === 'gold') return 'Clean geloest und beide Ziele um mindestens 20 % unterboten.'
  if (medal === 'silver') return 'Clean geloest und beide Ziele der Vorlage strikt unterboten.'
  return 'Clean geloest und genau ein Ziel der Vorlage strikt unterboten.'
}

export function isChallengeCleanRun(metrics: {
  assistanceMode: PuzzleAssistanceMode
  ghostUsageCount?: number
  heatmapUsageCount?: number
}): boolean {
  return metrics.assistanceMode === 'clean'
    && (metrics.ghostUsageCount ?? 0) <= 0
    && (metrics.heatmapUsageCount ?? 0) <= 0
}

export function getBestChallengeMedal(
  entries: Pick<SolvedGalleryEntry, 'challengeMedal'>[]
): ChallengeMedal | null {
  let bestMedal: ChallengeMedal | null = null

  for (const entry of entries) {
    const medal = entry.challengeMedal
    if (medal && (!bestMedal || CHALLENGE_MEDAL_RANK[medal] > CHALLENGE_MEDAL_RANK[bestMedal])) {
      bestMedal = medal
    }
  }

  return bestMedal
}

export function getPreviousBestChallengeMedalForMotif(
  entries: SolvedGalleryEntry[],
  targetId: string
): ChallengeMedal | null {
  const target = entries.find((entry) => entry.id === targetId)
  if (!target) return null

  const motifKey = target.sourceImage ?? target.previewImage
  if (!motifKey) return null

  return getBestChallengeMedal(
    entries.filter((entry) => (entry.sourceImage ?? entry.previewImage) === motifKey)
  )
}

export function formatChallengeMedalLabel(medal: ChallengeMedal): string {
  switch (medal) {
    case 'diamond':
      return 'Diamant'
    case 'gold':
      return 'Gold'
    case 'silver':
      return 'Silber'
    case 'bronze':
      return 'Bronze'
  }
}

export function getChallengeMedalEmoji(medal: ChallengeMedal): string {
  switch (medal) {
    case 'diamond':
      return '\u{1F48E}'
    case 'gold':
      return '\u{1F947}'
    case 'silver':
      return '\u{1F948}'
    case 'bronze':
      return '\u{1F949}'
  }
}

export type ChallengeMedalProgressStatus =
  | 'completed'
  | 'current'
  | 'next'
  | 'locked'
  | 'unavailable'

export interface ChallengeMedalProgressStage {
  medal: ChallengeMedal
  status: ChallengeMedalProgressStatus
}

export interface ChallengeMedalProgress {
  currentMedal: ChallengeMedal | null
  nextMedal: ChallengeMedal | null
  stages: ChallengeMedalProgressStage[]
  label: string
}

export function getChallengeMedalProgress(
  entries: Pick<SolvedGalleryEntry, 'id' | 'time' | 'moves' | 'challengeMedal' | 'challengeTargetId' | 'replaySetup'>[]
): ChallengeMedalProgress {
  let bestMedalEntry: Pick<SolvedGalleryEntry, 'id' | 'time' | 'moves' | 'challengeMedal' | 'challengeTargetId' | 'replaySetup'> | null = null

  for (const entry of entries) {
    const medal = entry.challengeMedal
    if (!medal) continue
    if (
      !bestMedalEntry?.challengeMedal
      || getChallengeMedalRank(medal) > getChallengeMedalRank(bestMedalEntry.challengeMedal)
    ) {
      bestMedalEntry = entry
    }
  }

  const currentMedal = bestMedalEntry?.challengeMedal ?? null
  if (!currentMedal) {
    return {
      currentMedal: null,
      nextMedal: 'bronze',
      stages: CHALLENGE_MEDALS_ASCENDING.map((medal) => ({
        medal,
        status: medal === 'bronze' ? 'next' : 'locked',
      })),
      label: 'Noch keine Challenge-Medaille. Erstes Ziel: Bronze durch einen absolut cleanen Lauf, der einen Zielwert strikt unterbietet.',
    }
  }

  const target = bestMedalEntry?.challengeTargetId
    ? entries.find((entry) => entry.id === bestMedalEntry?.challengeTargetId)
    : null
  const targetAvailability = target ? getChallengeMedalAvailability(target) : null
  const unavailableMedals = new Set<ChallengeMedal>(
    targetAvailability
      ? CHALLENGE_MEDALS_ASCENDING.filter((medal) => !targetAvailability[medal])
      : []
  )

  const currentRank = getChallengeMedalRank(currentMedal)
  const nextMedal = CHALLENGE_MEDALS_ASCENDING.find(
    (medal) => getChallengeMedalRank(medal) > currentRank && !unavailableMedals.has(medal)
  ) ?? null
  const stages = CHALLENGE_MEDALS_ASCENDING.map((medal): ChallengeMedalProgressStage => {
    if (medal === currentMedal) return { medal, status: 'current' }
    if (getChallengeMedalRank(medal) < currentRank) return { medal, status: 'completed' }
    if (unavailableMedals.has(medal)) return { medal, status: 'unavailable' }
    if (medal === nextMedal) return { medal, status: 'next' }
    return { medal, status: 'locked' }
  })
  const unavailableLabels = CHALLENGE_MEDALS_ASCENDING
    .filter((medal) => unavailableMedals.has(medal) && getChallengeMedalRank(medal) > currentRank)
    .map(formatChallengeMedalLabel)

  return {
    currentMedal,
    nextMedal,
    stages,
    label: [
      `Aktuell ${formatChallengeMedalLabel(currentMedal)}.`,
      nextMedal
        ? `Naechstes Ziel: ${formatChallengeMedalLabel(nextMedal)}.`
        : 'Hoechste verfuegbare Medaillenstufe erreicht.',
      unavailableLabels.length > 0
        ? `${unavailableLabels.join(' und ')} ${unavailableLabels.length === 1 ? 'ist' : 'sind'} fuer die beste Vorlage nicht erreichbar.`
        : null,
    ].filter((part): part is string => part !== null).join(' '),
  }
}
