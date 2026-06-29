import { describe, expect, it } from 'vitest'
import type { GalleryChallengeTarget, WinStats } from '../types/index.ts'
import {
  deriveChallengeMedal,
  getChallengeDiamondTargets,
  deriveLiveChallengeForecast,
  getBestChallengeMedal,
  getChallengeGoldTargets,
  getChallengeMedalAvailability,
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

const lowMoveTarget: GalleryChallengeTarget = {
  ...target,
  moves: 1,
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
    expect(getChallengeDiamondTargets(target)).toEqual({ time: 72, moves: 60 })
  })

  it('vergibt Diamant bei 40 Prozent in beiden Zielen ohne Solver-Abhaengigkeit', () => {
    expect(deriveChallengeMedal(createStats({ moves: 60, time: 72 }), target)).toBe('diamond')
    expect(deriveChallengeMedal(createStats({ moves: 60, time: 73 }), target)).toBe('gold')
    expect(deriveChallengeMedal(createStats({ moves: 80, time: 96 }), target)).toBe('gold')
    expect(deriveChallengeMedal(createStats({ moves: 60, time: 72, assistanceMode: 'hinted' }), target)).toBeNull()
  })

  it('ignoriert Solver-Untergrenzen fuer Diamant', () => {
    expect(deriveChallengeMedal(createStats({ moves: 60, time: 72 }), {
      ...target,
      optimalStartMoveCountKind: 'lower-bound',
      optimalStartMoveCount: 999,
    })).toBe('diamond')
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
    expect(deriveLiveChallengeForecast(createStats({ moves: 60, time: 72 }), target)).toMatchObject({
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

  it('meldet Diamant fuer positive Zielwerte als verfuegbar', () => {
    expect(isChallengeDiamondAvailable(target)).toBe(true)
    expect(isChallengeDiamondAvailable({ ...target, optimalStartMoveCountKind: 'lower-bound' })).toBe(true)
  })

  it('markiert Gold und Diamant nicht mehr wegen Solver-Optimum als unerreichbar', () => {
    expect(isChallengeGoldAvailable(goldUnavailableTarget)).toBe(true)
    expect(isChallengeDiamondAvailable(goldUnavailableTarget)).toBe(true)
    expect(deriveChallengeMedal(createStats({ moves: 81, time: 96 }), goldUnavailableTarget)).toBe('silver')
    expect(deriveLiveChallengeForecast(createStats({ moves: 0, time: 0 }), goldUnavailableTarget)).toMatchObject({
      medal: 'diamond',
      diamondAvailable: true,
      goldAvailable: true,
    })
    expect(getNextChallengeMedalGoal(
      createStats({ moves: 80, time: 96 }),
      goldUnavailableTarget,
      'gold'
    )).toEqual({
      medal: 'diamond',
      label: '24 Sek. schneller bis zum 40-Prozent-Zeitziel + 20 Zuege weniger bis zum 40-Prozent-Zugziel',
    })
  })

  it('sperrt Gold und Diamant, wenn das gerundete Zugziel mathematisch unerreichbar waere', () => {
    expect(getChallengeGoldTargets(lowMoveTarget)).toEqual({ time: 96, moves: 0 })
    expect(getChallengeDiamondTargets(lowMoveTarget)).toEqual({ time: 72, moves: 0 })
    expect(getChallengeMedalAvailability(lowMoveTarget)).toEqual({
      bronze: true,
      silver: false,
      gold: false,
      diamond: false,
    })
    expect(isChallengeGoldAvailable(lowMoveTarget)).toBe(false)
    expect(isChallengeDiamondAvailable(lowMoveTarget)).toBe(false)
    expect(deriveChallengeMedal(createStats({ moves: 0, time: 0 }), lowMoveTarget)).toBe('bronze')
    expect(deriveLiveChallengeForecast(createStats({ moves: 0, time: 0 }), lowMoveTarget)).toMatchObject({
      medal: 'bronze',
      diamondAvailable: false,
      goldAvailable: false,
    })
    expect(getNextChallengeMedalGoal(
      createStats({ moves: 1, time: 0 }),
      lowMoveTarget,
      'bronze'
    )).toEqual({
      medal: null,
      label: 'Hoechste verfuegbare Medaillenstufe erreicht.',
    })
  })
})
