import { describe, expect, it } from 'vitest'
import type { GalleryChallengeTarget, WinStats } from '../types/index.ts'
import {
  deriveChallengeMedal,
  deriveLiveChallengeForecast,
  getBestChallengeMedal,
  getChallengeGoldTargets,
  getChallengeMedalExplanation,
  getNextChallengeMedalGoal,
  isChallengeDiamondAvailable,
  isChallengeGoldAvailable,
} from '../utils/galleryChallenge.ts'

const target: GalleryChallengeTarget = {
  entryId: 'target',
  completedAt: '2026-06-09T10:00:00.000Z',
  time: 120,
  moves: 100,
  actionMoves: 110,
  assistanceMode: 'clean',
  optimalStartMoveCount: 70,
  optimalStartMoveCountKind: 'exact',
}

const goldUnavailableTarget: GalleryChallengeTarget = {
  ...target,
  optimalStartMoveCount: 81,
}

function createStats(overrides: Partial<WinStats> = {}): WinStats {
  return {
    moves: 85,
    time: 100,
    actionMoves: 90,
    undoCount: 0,
    redoCount: 0,
    hintCount: 0,
    suggestedMoveCount: 0,
    assistanceMode: 'clean',
    ...overrides,
  }
}

describe('galleryChallenge', () => {
  it('berechnet die 20-Prozent-Ziele mit ganzzahligen Grenzwerten', () => {
    expect(getChallengeGoldTargets(target)).toEqual({ time: 96, moves: 80 })
    expect(getChallengeGoldTargets({ ...target, time: 121, moves: 101 })).toEqual({ time: 96, moves: 80 })
  })

  it('vergibt Diamant nur fuer Gold plus exakte Solver-Optimalitaet', () => {
    expect(deriveChallengeMedal(createStats({ moves: 70, time: 96 }), target)).toBe('diamond')
    expect(deriveChallengeMedal(createStats({ moves: 70, time: 97 }), target)).toBe('silver')
    expect(deriveChallengeMedal(createStats({ moves: 80, time: 96 }), target)).toBe('gold')
    expect(deriveChallengeMedal(createStats({ moves: 70, time: 96, assistanceMode: 'hinted' }), target)).toBeNull()
  })

  it('vergibt keinen Diamanten fuer eine Solver-Untergrenze', () => {
    expect(deriveChallengeMedal(createStats({ moves: 80, time: 96 }), {
      ...target,
      optimalStartMoveCountKind: 'lower-bound',
    })).toBe('gold')
  })

  it('vergibt Gold ab 20 Prozent in beiden Zielen und Silber bei zwei kleineren Verbesserungen', () => {
    expect(deriveChallengeMedal(createStats({ moves: 80, time: 96 }), target)).toBe('gold')
    expect(deriveChallengeMedal(createStats({ moves: 81, time: 96 }), target)).toBe('silver')
    expect(deriveChallengeMedal(createStats({ moves: 85, time: 100 }), target)).toBe('silver')
    expect(deriveChallengeMedal(createStats({ moves: 99, time: 119 }), target)).toBe('silver')
    expect(deriveChallengeMedal(createStats({ moves: 99, time: 120 }), target)).toBe('bronze')
    expect(deriveChallengeMedal(createStats({ moves: 100, time: 120 }), target)).toBeNull()
  })

  it('unterscheidet Gold und Silber an der 20-Prozent-Grenze', () => {
    expect(deriveChallengeMedal(createStats({ time: 90, moves: 80 }), target)).toBe('gold')
    expect(deriveChallengeMedal(createStats({ time: 100, moves: 85 }), target)).toBe('silver')
  })

  it('vergibt Bronze nur, wenn genau ein Ziel strikt unterboten wird', () => {
    expect(deriveChallengeMedal(createStats({ moves: 101, time: 119 }), target)).toBe('bronze')
    expect(deriveChallengeMedal(createStats({ moves: 99, time: 121 }), target)).toBe('bronze')
    expect(deriveChallengeMedal(createStats({ moves: 101, time: 120 }), target)).toBeNull()
    expect(deriveChallengeMedal(createStats({ moves: 100, time: 121 }), target)).toBeNull()
  })

  it('vergibt assistierten Laeufen unabhaengig von den Zielwerten keine Medaille', () => {
    expect(deriveChallengeMedal(createStats({ assistanceMode: 'auto-assisted' }), target)).toBeNull()
    expect(deriveChallengeMedal(createStats({ ghostUsageCount: 1 }), target)).toBeNull()
    expect(deriveChallengeMedal(createStats({ heatmapUsageCount: 1 }), target)).toBeNull()
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
    expect(deriveLiveChallengeForecast(createStats({ moves: 70, time: 96 }), target)).toMatchObject({
      medal: 'diamond',
      diamondAvailable: true,
      goldAvailable: true,
      isClean: true,
    })
    expect(deriveLiveChallengeForecast(createStats({ moves: 80, time: 96 }), target).medal).toBe('gold')
    expect(deriveLiveChallengeForecast(createStats({
      moves: 80,
      time: 96,
      assistanceMode: 'hinted',
    }), target).medal).toBeNull()
    expect(deriveLiveChallengeForecast(createStats({ moves: 101, time: 119 }), target).medal).toBe('bronze')
    expect(deriveLiveChallengeForecast(createStats({ moves: 101, time: 121 }), target).medal).toBeNull()
  })

  it('erklaert den vollstaendigen Medaillenausschluss nach Assistance', () => {
    const assistedStats = createStats({ assistanceMode: 'hinted' })
    expect(getChallengeMedalExplanation(assistedStats, target, null)).toContain('keine Medaille')
    expect(getNextChallengeMedalGoal(assistedStats, target, null)).toEqual({
      medal: 'bronze',
      label: 'Ohne Hilfe neu starten. Medaillen werden nur fuer absolut cleane Laeufe vergeben.',
    })
    expect(getNextChallengeMedalGoal(createStats({ moves: 105, time: 125 }), target, null)).toEqual({
      medal: 'bronze',
      label: '6 Sek. schneller oder 6 Zuege weniger',
    })
    expect(getChallengeMedalExplanation(createStats({ moves: 105, time: 125 }), target, null))
      .toContain('kein Ziel')
  })

  it('meldet Diamant nur bei einer exakten optimalen Zugzahl als verfuegbar', () => {
    expect(isChallengeDiamondAvailable(target)).toBe(true)
    expect(isChallengeDiamondAvailable({ ...target, optimalStartMoveCountKind: 'lower-bound' })).toBe(false)
  })

  it('markiert Gold und Diamant als unerreichbar, wenn das Solver-Optimum ueber dem Gold-Zugziel liegt', () => {
    expect(isChallengeGoldAvailable(goldUnavailableTarget)).toBe(false)
    expect(isChallengeDiamondAvailable(goldUnavailableTarget)).toBe(false)
    expect(deriveChallengeMedal(createStats({ moves: 81, time: 96 }), goldUnavailableTarget)).toBe('silver')
    expect(deriveLiveChallengeForecast(createStats({ moves: 0, time: 0 }), goldUnavailableTarget)).toMatchObject({
      medal: 'silver',
      diamondAvailable: false,
      goldAvailable: false,
    })
    expect(getNextChallengeMedalGoal(
      createStats({ moves: 81, time: 96 }),
      goldUnavailableTarget,
      'silver'
    )).toEqual({
      medal: null,
      label: 'Gold und Diamant sind fuer diese Vorlage nicht erreichbar: Das exakte Solver-Optimum liegt ueber dem 20-Prozent-Zugziel.',
    })
  })
})
