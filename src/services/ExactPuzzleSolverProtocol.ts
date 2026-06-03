import type { PuzzleConfig } from '../types/index'

export type ExactStartMoveCountResult =
  | {
      status: 'exact'
      moveCount: number
      solverVersion: string
    }
  | {
      status: 'lower-bound'
      moveCount: number
      solverVersion: string
    }
  | {
      status: 'unavailable'
      moveCount: null
      solverVersion: string
    }

export interface ExactPuzzleSolverWorkerRequest {
  requestId: number
  board: number[]
  emptyPos: number
  config: PuzzleConfig
  maxVisitedNodes: number
}

interface ExactPuzzleSolverWorkerSuccessResponse {
  requestId: number
  status: 'success'
  result: ExactStartMoveCountResult
}

interface ExactPuzzleSolverWorkerErrorResponse {
  requestId: number
  status: 'error'
  error: string
}

export type ExactPuzzleSolverWorkerResponse =
  | ExactPuzzleSolverWorkerSuccessResponse
  | ExactPuzzleSolverWorkerErrorResponse
