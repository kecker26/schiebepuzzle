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
  const reachedTime = stats.time <= target.time
  const reachedMoves = stats.moves <= target.moves
  const reachedExactOptimal =
    target.optimalStartMoveCountKind === 'exact'
    && typeof target.optimalStartMoveCount === 'number'
    && stats.moves <= target.optimalStartMoveCount

  if (isClean && beatTime && reachedExactOptimal) return 'diamond'
  if (isClean && beatTime && beatMoves) return 'gold'
  if (reachedTime && reachedMoves) return 'silver'
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
}

export function isChallengeDiamondAvailable(target: GalleryChallengeTarget): boolean {
  return target.optimalStartMoveCountKind === 'exact'
    && typeof target.optimalStartMoveCount === 'number'
}

export function isChallengeGoldAvailable(target: GalleryChallengeTarget): boolean {
  return !isChallengeDiamondAvailable(target)
    || (
      typeof target.optimalStartMoveCount === 'number'
      && target.moves > target.optimalStartMoveCount
    )
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
  const diamondAvailable = isChallengeDiamondAvailable(target)
  const goldAvailable = isChallengeGoldAvailable(target)
  const canStillReachExactOptimal =
    diamondAvailable
    && typeof target.optimalStartMoveCount === 'number'
    && metrics.moves <= target.optimalStartMoveCount

  const medal =
    isClean && timeBeaten && canStillReachExactOptimal
      ? 'diamond'
      : goldAvailable && isClean && timeBeaten && movesBeaten
        ? 'gold'
        : timeReached && movesReached
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
  const exactOptimalGap =
    typeof target.optimalStartMoveCount === 'number'
      ? Math.max(0, stats.moves - target.optimalStartMoveCount)
      : 0

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
        label: 'Diamant ist fuer dieses Puzzle nicht verfuegbar, weil keine exakte optimale Zugzahl berechnet werden konnte.',
      }
    }

    return {
      medal: 'diamond',
      label: exactOptimalGap > 0
        ? `${exactOptimalGap} ${exactOptimalGap === 1 ? 'Zug' : 'Zuege'} weniger bis zur exakt optimalen Loesung.`
        : 'Exakt solver-optimal und schneller als die Vorlage loesen.',
    }
  }

  if (medal === 'silver') {
    if (!isChallengeGoldAvailable(target) && isChallengeDiamondAvailable(target)) {
      const diamondRequirements = [
        timeGapToBeat > 0 ? `${timeGapToBeat} Sek. schneller` : null,
        exactOptimalGap > 0
          ? `${exactOptimalGap} ${exactOptimalGap === 1 ? 'Zug' : 'Zuege'} weniger bis zur exakt optimalen Loesung`
          : null,
        !isClean ? 'ohne Hilfe' : null,
      ].filter((requirement): requirement is string => requirement !== null)

      return {
        medal: 'diamond',
        label: `Gold ist gegen die bereits optimale Vorlage mathematisch nicht erreichbar. Fuer Diamant: ${
          diamondRequirements.join(' + ') || 'exakt optimal und schneller als die Vorlage loesen'
        }.`,
      }
    }

    const requirements = [
      timeGapToBeat > 0 ? `${timeGapToBeat} Sek. schneller` : null,
      movesGapToBeat > 0 ? `${movesGapToBeat} ${movesGapToBeat === 1 ? 'Zug' : 'Zuege'} weniger` : null,
      !isClean ? 'ohne Hilfe' : null,
    ].filter((requirement): requirement is string => requirement !== null)

    return {
      medal: 'gold',
      label: requirements.length > 0
        ? requirements.join(' + ')
        : 'Beide Ziele strikt unterbieten und ohne Hilfe loesen.',
    }
  }

  const silverRequirements = [
    stats.time > target.time ? `${stats.time - target.time} Sek. bis zum Zeitgleichstand` : null,
    stats.moves > target.moves ? `${stats.moves - target.moves} ${stats.moves - target.moves === 1 ? 'Zug' : 'Zuege'} bis zum Zuggleichstand` : null,
  ].filter((requirement): requirement is string => requirement !== null)

  return {
    medal: 'silver',
    label: silverRequirements.join(' + ') || 'Beide Ziele der Vorlage erreichen.',
  }
}

export function getChallengeMedalExplanation(
  stats: WinStats,
  target: GalleryChallengeTarget,
  medal: ChallengeMedal | null
): string {
  if (medal === null) return 'Challenge abgeschlossen, aber kein Ziel der Vorlage strikt unterboten.'
  if (medal === 'diamond') return 'Clean, schneller als die Vorlage und exakt solver-optimal.'
  if (medal === 'gold') return 'Clean geloest und beide Ziele strikt unterboten.'
  if (medal === 'silver') {
    const beatBoth = stats.time < target.time && stats.moves < target.moves
    if (beatBoth && !isChallengeCleanRun(stats)) {
      return 'Beide Ziele unterboten, aber Gold erfordert einen sauberen Lauf ohne Hilfe.'
    }
    return 'Beide Ziele der Vorlage erreicht oder unterboten.'
  }
  return 'Mindestens ein Ziel der Vorlage strikt unterboten.'
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
  entries: Pick<SolvedGalleryEntry, 'id' | 'moves' | 'challengeMedal' | 'challengeTargetId' | 'replaySetup'>[]
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
      label: 'Noch keine Challenge-Medaille. Erstes Ziel: Bronze durch das strikte Unterbieten eines Zielwerts.',
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
    && targetEntry.moves <= exactOptimalMoveCount
  ) {
    unavailableMedals.add('gold')
  }

  const currentRank = getChallengeMedalRank(currentMedal)
  const nextMedal = CHALLENGE_MEDALS_ASCENDING.find(
    (medal) => getChallengeMedalRank(medal) > currentRank && !unavailableMedals.has(medal)
  ) ?? null
  const stages = CHALLENGE_MEDALS_ASCENDING.map((medal): ChallengeMedalProgressStage => {
    if (unavailableMedals.has(medal)) return { medal, status: 'unavailable' }
    if (medal === currentMedal) return { medal, status: 'current' }
    if (getChallengeMedalRank(medal) < currentRank) return { medal, status: 'completed' }
    if (medal === nextMedal) return { medal, status: 'next' }
    return { medal, status: 'locked' }
  })
  const unavailableLabels = CHALLENGE_MEDALS_ASCENDING
    .filter((medal) => unavailableMedals.has(medal))
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
