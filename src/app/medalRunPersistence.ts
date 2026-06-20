import type { GalleryChallengeTarget } from '../types/index.ts'

export function shouldAutosavePuzzleRun(
  challengeTarget: GalleryChallengeTarget | null | undefined
): boolean {
  return !challengeTarget
}

export type DiscardMedalRunSaveResult =
  | { ok: true; deletedSaveId: string | null }
  | { ok: false; error: unknown }

export async function discardMedalRunSave(
  saveId: string | null,
  deleteSave: (saveId: string) => Promise<void>
): Promise<DiscardMedalRunSaveResult> {
  if (!saveId) {
    return { ok: true, deletedSaveId: null }
  }

  try {
    await deleteSave(saveId)
    return { ok: true, deletedSaveId: saveId }
  } catch (error) {
    return { ok: false, error }
  }
}
