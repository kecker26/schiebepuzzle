import type {
  ChallengeMedal,
  GalleryChallengeTarget,
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
): ChallengeMedal {
  const isClean = stats.assistanceMode === 'clean'
  const beatTime = stats.time < target.time
  const beatMoves = stats.moves < target.moves
  const reachedExactOptimal =
    target.optimalStartMoveCountKind === 'exact'
    && typeof target.optimalStartMoveCount === 'number'
    && stats.moves <= target.optimalStartMoveCount

  if (isClean && beatTime && reachedExactOptimal) return 'diamond'
  if (isClean && beatTime && beatMoves) return 'gold'
  if (beatTime || beatMoves) return 'silver'
  return 'bronze'
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
