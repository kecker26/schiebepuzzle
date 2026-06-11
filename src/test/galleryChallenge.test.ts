import { describe, expect, it } from 'vitest'
import type { GalleryChallengeTarget, WinStats } from '../types/index.ts'
import {
  deriveChallengeMedal,
  deriveLiveChallengeForecast,
  getBestChallengeMedal,
  getChallengeMedalExplanation,
  getNextChallengeMedalGoal,
  isChallengeDiamondAvailable,
  isChallengeGoldAvailable,
} from '../utils/galleryChallenge.ts'

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

const optimalTarget: GalleryChallengeTarget = {
  ...target,
  moves: 18,
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

  it('vergibt Gold strikt und Silber auch fuer einen Gleichstand', () => {
    expect(deriveChallengeMedal(createStats(), target)).toBe('gold')
    expect(deriveChallengeMedal(createStats({ time: 60 }), target)).toBe('silver')
    expect(deriveChallengeMedal(createStats({ moves: 20 }), target)).toBe('silver')
    expect(deriveChallengeMedal(createStats({ moves: 20, time: 60 }), target)).toBe('silver')
    expect(deriveChallengeMedal(createStats({ moves: 21, time: 61 }), target)).toBe('bronze')
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

  it('prognostiziert die aktuell erreichbare Medaille und Assistance-Deckelung', () => {
    expect(deriveLiveChallengeForecast(createStats({ moves: 18, time: 40 }), target)).toMatchObject({
      medal: 'diamond',
      diamondAvailable: true,
      goldAvailable: true,
      isClean: true,
    })
    expect(deriveLiveChallengeForecast(createStats({ moves: 19, time: 40 }), target).medal).toBe('gold')
    expect(deriveLiveChallengeForecast(createStats({
      moves: 19,
      time: 40,
      assistanceMode: 'hinted',
    }), target).medal).toBe('silver')
    expect(deriveLiveChallengeForecast(createStats({ moves: 21, time: 61 }), target).medal).toBe('bronze')
  })

  it('erklaert Assistance-Deckelung und das naechste Medaillenziel', () => {
    const assistedStats = createStats({ assistanceMode: 'hinted' })
    expect(getChallengeMedalExplanation(assistedStats, target, 'silver')).toContain('ohne Hinweise')
    expect(getNextChallengeMedalGoal(assistedStats, target, 'silver')).toEqual({
      medal: 'gold',
      label: 'ohne Hilfe',
    })
    expect(getNextChallengeMedalGoal(createStats({ moves: 23, time: 64 }), target, 'bronze').label)
      .toContain('Zeitgleichstand')
  })

  it('meldet Diamant nur bei einer exakten optimalen Zugzahl als verfuegbar', () => {
    expect(isChallengeDiamondAvailable(target)).toBe(true)
    expect(isChallengeDiamondAvailable({ ...target, optimalStartMoveCountKind: 'lower-bound' })).toBe(false)
  })

  it('ueberspringt Gold, wenn die Vorlage bereits exakt optimal geloest wurde', () => {
    expect(isChallengeGoldAvailable(optimalTarget)).toBe(false)
    expect(deriveChallengeMedal(createStats({ moves: 18, time: 40 }), optimalTarget)).toBe('diamond')
    expect(deriveLiveChallengeForecast(createStats({ moves: 0, time: 0 }), optimalTarget)).toMatchObject({
      medal: 'diamond',
      diamondAvailable: true,
      goldAvailable: false,
    })
    expect(getNextChallengeMedalGoal(
      createStats({ moves: 18, time: 40, assistanceMode: 'hinted' }),
      optimalTarget,
      'silver'
    )).toEqual({
      medal: 'diamond',
      label: 'Gold ist gegen die bereits optimale Vorlage mathematisch nicht erreichbar. Fuer Diamant: ohne Hilfe.',
    })
  })
})
