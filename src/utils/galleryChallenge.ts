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

export const CHALLENGE_GOLD_IMPROVEMENT_PERCENT = 20
const CHALLENGE_GOLD_TARGET_FACTOR = (100 - CHALLENGE_GOLD_IMPROVEMENT_PERCENT) / 100

export function getChallengeGoldTargets(target: Pick<GalleryChallengeTarget, 'time' | 'moves'>): {
  time: number
  moves: number
} {
  return {
    time: Math.floor(target.time * CHALLENGE_GOLD_TARGET_FACTOR),
    moves: Math.floor(target.moves * CHALLENGE_GOLD_TARGET_FACTOR),
  }
}

export function getChallengeMedalRank(medal: ChallengeMedal): number {
  return CHALLENGE_MEDAL_RANK[medal]
}

export function deriveChallengeMedal(
  stats: WinStats,
  target: GalleryChallengeTarget
): ChallengeMedal | null {
  const isClean = isChallengeCleanRun(stats)
  const beatTime = stats.time < target.time
  const beatMoves = stats.moves < target.moves
  const goldTargets = getChallengeGoldTargets(target)
  const reachedGoldTime = stats.time <= goldTargets.time
  const reachedGoldMoves = stats.moves <= goldTargets.moves
  const reachedExactOptimal =
    target.optimalStartMoveCountKind === 'exact'
    && typeof target.optimalStartMoveCount === 'number'
    && stats.moves <= target.optimalStartMoveCount

  if (!isClean) return null
  if (reachedGoldTime && reachedGoldMoves && reachedExactOptimal) return 'diamond'
  if (reachedGoldTime && reachedGoldMoves) return 'gold'
  if (beatTime && beatMoves) return 'silver'
  if (beatTime || beatMoves) return 'bronze'
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
  return target.optimalStartMoveCountKind === 'exact'
    && typeof target.optimalStartMoveCount === 'number'
    && isChallengeGoldAvailable(target)
}

export function isChallengeGoldAvailable(target: GalleryChallengeTarget): boolean {
  if (
    target.optimalStartMoveCountKind !== 'exact'
    || typeof target.optimalStartMoveCount !== 'number'
  ) {
    return true
  }

  return getChallengeGoldTargets(target).moves >= target.optimalStartMoveCount
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
  const timeReached = metrics.time <= target.time
  const movesReached = metrics.moves <= target.moves
  const timeBeaten = metrics.time < target.time
  const movesBeaten = metrics.moves < target.moves
  const goldTargets = getChallengeGoldTargets(target)
  const goldTimeReached = metrics.time <= goldTargets.time
  const goldMovesReached = metrics.moves <= goldTargets.moves
  const diamondAvailable = isChallengeDiamondAvailable(target)
  const goldAvailable = isChallengeGoldAvailable(target)
  const canStillReachExactOptimal =
    diamondAvailable
    && typeof target.optimalStartMoveCount === 'number'
    && metrics.moves <= target.optimalStartMoveCount

  const medal =
    !isClean
      ? null
      : diamondAvailable && goldTimeReached && goldMovesReached && canStillReachExactOptimal
      ? 'diamond'
      : goldAvailable && goldTimeReached && goldMovesReached
        ? 'gold'
        : timeBeaten && movesBeaten
          ? 'silver'
          : timeBeaten || movesBeaten
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
  const timeGapToBeat = Math.max(0, stats.time - target.time + 1)
  const movesGapToBeat = Math.max(0, stats.moves - target.moves + 1)
  const goldTargets = getChallengeGoldTargets(target)
  const timeGapToGold = Math.max(0, stats.time - goldTargets.time)
  const movesGapToGold = Math.max(0, stats.moves - goldTargets.moves)
  const exactOptimalGap =
    typeof target.optimalStartMoveCount === 'number'
      ? Math.max(0, stats.moves - target.optimalStartMoveCount)
      : 0

  if (!isClean) {
    return {
      medal: 'bronze',
      label: 'Ohne Hilfe neu starten. Medaillen werden nur fuer absolut cleane Laeufe vergeben.',
    }
  }

  if (medal === null) {
    const bronzeRequirements = [
      timeGapToBeat > 0 ? `${timeGapToBeat} Sek. schneller` : null,
      movesGapToBeat > 0 ? `${movesGapToBeat} ${movesGapToBeat === 1 ? 'Zug' : 'Zuege'} weniger` : null,
    ].filter((requirement): requirement is string => requirement !== null)

    return {
      medal: 'bronze',
      label: bronzeRequirements.join(' oder ') || 'Mindestens ein Ziel der Vorlage strikt unterbieten.',
    }
  }

  if (medal === 'diamond') {
    return { medal: null, label: 'Hoechste Medaillenstufe erreicht.' }
  }

  if (medal === 'gold') {
    if (!isChallengeDiamondAvailable(target)) {
      return {
        medal: null,
        label: isChallengeGoldAvailable(target)
          ? 'Diamant ist fuer dieses Puzzle nicht verfuegbar, weil keine exakte optimale Zugzahl berechnet werden konnte.'
          : 'Diamant ist nicht erreichbar, weil das exakte Solver-Optimum ueber dem 20-Prozent-Zugziel liegt.',
      }
    }

    return {
      medal: 'diamond',
      label: exactOptimalGap > 0
        ? `${exactOptimalGap} ${exactOptimalGap === 1 ? 'Zug' : 'Zuege'} weniger bis zur exakt optimalen Loesung.`
        : 'Gold-Ziele halten und exakt solver-optimal loesen.',
    }
  }

  if (medal === 'silver') {
    if (!isChallengeGoldAvailable(target)) {
      return {
        medal: null,
        label: 'Gold und Diamant sind fuer diese Vorlage nicht erreichbar: Das exakte Solver-Optimum liegt ueber dem 20-Prozent-Zugziel.',
      }
    }

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
    timeGapToBeat > 0 ? `${timeGapToBeat} Sek. schneller bis unter das Zeitziel` : null,
    movesGapToBeat > 0 ? `${movesGapToBeat} ${movesGapToBeat === 1 ? 'Zug' : 'Zuege'} weniger bis unter das Zugziel` : null,
  ].filter((requirement): requirement is string => requirement !== null)

  return {
    medal: 'silver',
    label: silverRequirements.join(' + ') || 'Beide Ziele der Vorlage strikt unterbieten.',
  }
}

export function getChallengeMedalExplanation(
  stats: WinStats,
  _target: GalleryChallengeTarget,
  medal: ChallengeMedal | null
): string {
  if (!isChallengeCleanRun(stats)) {
    return 'Mit Hilfe abgeschlossen: Dieser Lauf bleibt eine Uebung und erhaelt keine Medaille.'
  }
  if (medal === null) return 'Challenge abgeschlossen, aber kein Ziel der Vorlage strikt unterboten.'
  if (medal === 'diamond') return 'Clean, beide Ziele um mindestens 20 % unterboten und exakt solver-optimal.'
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

const CHALLENGE_MEDALS_ASCENDING: ChallengeMedal[] = ['bronze', 'silver', 'gold', 'diamond']

export function getChallengeMedalProgress(
  entries: Pick<SolvedGalleryEntry, 'id' | 'time' | 'moves' | 'challengeMedal' | 'challengeTargetId' | 'replaySetup'>[]
): ChallengeMedalProgress {
  const currentMedal = getBestChallengeMedal(entries)
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

  const bestAttempt = entries.find((entry) => entry.challengeMedal === currentMedal)
  const targetEntry = bestAttempt?.challengeTargetId
    ? entries.find((entry) => entry.id === bestAttempt.challengeTargetId)
    : null
  const exactOptimalMoveCount = targetEntry?.replaySetup?.optimalStartMoveCount
  const hasExactOptimal =
    targetEntry?.replaySetup?.optimalStartMoveCountKind === 'exact'
    && typeof exactOptimalMoveCount === 'number'
  const unavailableMedals = new Set<ChallengeMedal>()

  if (targetEntry && !hasExactOptimal) {
    unavailableMedals.add('diamond')
  }

  if (
    targetEntry
    && hasExactOptimal
    && typeof exactOptimalMoveCount === 'number'
    && getChallengeGoldTargets(targetEntry).moves < exactOptimalMoveCount
  ) {
    unavailableMedals.add('gold')
    unavailableMedals.add('diamond')
  }

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
