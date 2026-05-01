/// <reference lib="webworker" />

import { findSolutionValues } from '../services/PuzzleSolver.ts'
import type {
  PuzzleSolverWorkerRequest,
  PuzzleSolverWorkerResponse,
} from '../services/PuzzleSolverWorkerProtocol.ts'

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (event: MessageEvent<PuzzleSolverWorkerRequest>) => {
  const { requestId, board, emptyPos, config, maxVisitedNodes } = event.data

  try {
    const solutionValues = findSolutionValues(config, board, emptyPos, maxVisitedNodes)
    const response: PuzzleSolverWorkerResponse = {
      requestId,
      status: 'success',
      solutionValues,
    }
    self.postMessage(response)
  } catch (error) {
    const response: PuzzleSolverWorkerResponse = {
      requestId,
      status: 'error',
      error: error instanceof Error ? error.message : 'Solver fehlgeschlagen',
    }
    self.postMessage(response)
  }
}

export {}
