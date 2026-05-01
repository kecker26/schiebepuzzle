/// <reference lib="webworker" />

import { resolveExactStartMoveCount } from '../services/ExactPuzzleSolver.ts'
import type {
  ExactPuzzleSolverWorkerRequest,
  ExactPuzzleSolverWorkerResponse,
} from '../services/ExactPuzzleSolverProtocol.ts'

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (event: MessageEvent<ExactPuzzleSolverWorkerRequest>) => {
  const { requestId, board, emptyPos, config, maxVisitedNodes } = event.data

  try {
    const result = resolveExactStartMoveCount(config, board, emptyPos, maxVisitedNodes)
    const response: ExactPuzzleSolverWorkerResponse = {
      requestId,
      status: 'success',
      result,
    }
    self.postMessage(response)
  } catch (error) {
    const response: ExactPuzzleSolverWorkerResponse = {
      requestId,
      status: 'error',
      error: error instanceof Error ? error.message : 'Exakter Solver fehlgeschlagen',
    }
    self.postMessage(response)
  }
}

export {}
