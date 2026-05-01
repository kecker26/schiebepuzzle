import type {
  PuzzleAssistanceMode,
  PuzzleCompletionRecord,
  PuzzleConfig,
  WinStats,
} from '../types/index'

export type ComparisonTrend = 'better' | 'worse' | 'same' | 'unknown'

export type ComparisonTone = 'positive' | 'negative' | 'neutral'

type ComparableRunInput =
  | Pick<
      PuzzleCompletionRecord,
      | 'moves'
      | 'time'
      | 'actionMoves'
      | 'assistanceMode'
      | 'hintCount'
      | 'suggestedMoveCount'
      | 'hasDetailedProfile'
    >
  | Pick<
      WinStats,
      'moves' | 'time' | 'actionMoves' | 'assistanceMode' | 'hintCount' | 'suggestedMoveCount'
    >

export interface ComparablePuzzleRun {
  moves: number
  time: number
  actionMoves: number
  assistanceMode: PuzzleAssistanceMode
  hintCount: number
  suggestedMoveCount: number
  hasDetailedProfile: boolean
}

export interface NumericMetricComparison {
  current: number
  previous: number | null
  deltaToPrevious: number | null
  trend: ComparisonTrend
}

export interface BestGapComparison {
  best: number | null
  currentGap: number | null
  previousGap: number | null
  deltaToPreviousGap: number | null
  trend: ComparisonTrend
}

export interface AssistanceComparison {
  previousMode: PuzzleAssistanceMode | null
  hintDelta: number | null
  suggestedMoveDelta: number | null
  trend: ComparisonTrend
}

export function toComparableRun(run: ComparableRunInput): ComparablePuzzleRun {
  return {
    moves: run.moves,
    time: run.time,
    actionMoves: run.actionMoves,
    assistanceMode: run.assistanceMode,
    hintCount: run.hintCount,
    suggestedMoveCount: run.suggestedMoveCount,
    hasDetailedProfile: 'hasDetailedProfile' in run ? run.hasDetailedProfile : true,
  }
}

export function countExtraMoves(run: Pick<ComparablePuzzleRun, 'moves' | 'actionMoves'>): number {
  return Math.max(0, run.actionMoves - run.moves)
}

export function isSamePuzzleConfig(left: PuzzleConfig, right: PuzzleConfig): boolean {
  return left.rows === right.rows && left.cols === right.cols
}

export function compareLowerIsBetterMetric(
  current: number,
  previous: number | null
): NumericMetricComparison {
  if (previous === null) {
    return {
      current,
      previous,
      deltaToPrevious: null,
      trend: 'unknown',
    }
  }

  const deltaToPrevious = current - previous
  return {
    current,
    previous,
    deltaToPrevious,
    trend: resolveLowerIsBetterTrend(deltaToPrevious),
  }
}

export function compareGapToBest(
  current: number,
  previous: number | null,
  best: number | null
): BestGapComparison {
  if (best === null) {
    return {
      best,
      currentGap: null,
      previousGap: null,
      deltaToPreviousGap: null,
      trend: 'unknown',
    }
  }

  const currentGap = Math.max(0, current - best)
  const previousGap = previous === null ? null : Math.max(0, previous - best)
  const deltaToPreviousGap = previousGap === null ? null : currentGap - previousGap

  return {
    best,
    currentGap,
    previousGap,
    deltaToPreviousGap,
    trend: resolveLowerIsBetterTrend(deltaToPreviousGap),
  }
}

export function compareAssistance(
  current: ComparablePuzzleRun,
  previous: ComparablePuzzleRun | null
): AssistanceComparison {
  if (!current.hasDetailedProfile || !previous?.hasDetailedProfile) {
    return {
      previousMode: previous?.assistanceMode ?? null,
      hintDelta: null,
      suggestedMoveDelta: null,
      trend: 'unknown',
    }
  }

  const currentRank = getAssistanceRank(current.assistanceMode)
  const previousRank = getAssistanceRank(previous.assistanceMode)
  const rankDelta = currentRank - previousRank
  const hintDelta = current.hintCount - previous.hintCount
  const suggestedMoveDelta = current.suggestedMoveCount - previous.suggestedMoveCount

  let trend: ComparisonTrend = resolveLowerIsBetterTrend(rankDelta)

  if (trend === 'same') {
    trend = resolveLowerIsBetterTrend(suggestedMoveDelta)
  }

  if (trend === 'same') {
    trend = resolveLowerIsBetterTrend(hintDelta)
  }

  return {
    previousMode: previous.assistanceMode,
    hintDelta,
    suggestedMoveDelta,
    trend,
  }
}

export function resolveComparisonTone(...trends: ComparisonTrend[]): ComparisonTone {
  const knownTrends = trends.filter((trend) => trend !== 'unknown' && trend !== 'same')

  if (knownTrends.length === 0) {
    return 'neutral'
  }

  if (knownTrends.every((trend) => trend === 'better')) {
    return 'positive'
  }

  if (knownTrends.every((trend) => trend === 'worse')) {
    return 'negative'
  }

  return 'neutral'
}

function resolveLowerIsBetterTrend(delta: number | null): ComparisonTrend {
  if (delta === null) {
    return 'unknown'
  }

  if (delta === 0) {
    return 'same'
  }

  return delta < 0 ? 'better' : 'worse'
}

function getAssistanceRank(mode: PuzzleAssistanceMode): number {
  switch (mode) {
    case 'clean':
      return 0
    case 'hinted':
      return 1
    case 'auto-assisted':
      return 2
  }
}
