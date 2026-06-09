import { describe, expect, it } from 'vitest'
import type { GalleryChallengeTarget, WinStats } from '../types/index.ts'
import { deriveChallengeMedal, getBestChallengeMedal } from '../utils/galleryChallenge.ts'

const target: GalleryChallengeTarget = {
  entryId: 'target',
  completedAt: '2026-06-09T10:00:00.000Z',
  time: 60,
  moves: 20,
  actionMoves: 24,
  assistanceMode: 'clean',
  optimalStartMoveCount: 18,
  optimalStartMoveCountKind: 'exact',
}

function createStats(overrides: Partial<WinStats> = {}): WinStats {
  return {
    moves: 19,
    time: 59,
    actionMoves: 21,
    undoCount: 0,
    redoCount: 0,
    hintCount: 0,
    suggestedMoveCount: 0,
    assistanceMode: 'clean',
    ...overrides,
  }
}

describe('galleryChallenge', () => {
  it('vergibt Diamant nur fuer einen cleanen, schnelleren und exakt optimalen Lauf', () => {
    expect(deriveChallengeMedal(createStats({ moves: 18 }), target)).toBe('diamond')
    expect(deriveChallengeMedal(createStats({ moves: 18, time: 60 }), target)).toBe('silver')
    expect(deriveChallengeMedal(createStats({ moves: 18, assistanceMode: 'hinted' }), target)).toBe('silver')
  })

  it('vergibt keinen Diamanten fuer eine Solver-Untergrenze', () => {
    expect(deriveChallengeMedal(createStats({ moves: 18 }), {
      ...target,
      optimalStartMoveCountKind: 'lower-bound',
    })).toBe('gold')
  })

  it('vergibt Gold, Silber und Bronze anhand strikt unterbotener Ziele', () => {
    expect(deriveChallengeMedal(createStats(), target)).toBe('gold')
    expect(deriveChallengeMedal(createStats({ time: 60 }), target)).toBe('silver')
    expect(deriveChallengeMedal(createStats({ moves: 20 }), target)).toBe('silver')
    expect(deriveChallengeMedal(createStats({ moves: 20, time: 60 }), target)).toBe('bronze')
  })

  it('begrenzt assistierte Laeufe trotz zweier unterbotener Ziele auf Silber', () => {
    expect(deriveChallengeMedal(createStats({ assistanceMode: 'auto-assisted' }), target)).toBe('silver')
  })

  it('ermittelt die beste gespeicherte Medaille', () => {
    expect(getBestChallengeMedal([
      { challengeMedal: 'bronze' },
      { challengeMedal: 'diamond' },
      { challengeMedal: 'gold' },
    ])).toBe('diamond')
    expect(getBestChallengeMedal([{}])).toBeNull()
  })
})
