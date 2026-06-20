import { describe, expect, it, vi } from 'vitest'
import {
  discardMedalRunSave,
  shouldAutosavePuzzleRun,
} from '../app/medalRunPersistence.ts'

describe('medal run persistence', () => {
  it('disables autosave while a challenge target is active', () => {
    expect(shouldAutosavePuzzleRun(null)).toBe(true)
    expect(shouldAutosavePuzzleRun(undefined)).toBe(true)
    expect(shouldAutosavePuzzleRun({
      entryId: 'target-entry',
      completedAt: '2026-06-19T20:00:00.000Z',
      time: 120,
      moves: 80,
      actionMoves: 80,
      assistanceMode: 'clean',
    })).toBe(false)
  })

  it('deletes an existing challenge save when the run is discarded', async () => {
    const deleteSave = vi.fn().mockResolvedValue(undefined)

    await expect(discardMedalRunSave('challenge-save', deleteSave)).resolves.toEqual({
      ok: true,
      deletedSaveId: 'challenge-save',
    })
    expect(deleteSave).toHaveBeenCalledWith('challenge-save')
  })

  it('reports deletion failures so leaving the medal run can be blocked', async () => {
    const error = new Error('delete failed')
    const deleteSave = vi.fn().mockRejectedValue(error)

    await expect(discardMedalRunSave('challenge-save', deleteSave)).resolves.toEqual({
      ok: false,
      error,
    })
  })
})
