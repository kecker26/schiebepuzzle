import { PuzzleConfig } from '../types/index'

export interface PuzzleSolverWorkerRequest {
  requestId: number
  board: number[]
  emptyPos: number
  config: PuzzleConfig
  maxVisitedNodes: number
}

interface PuzzleSolverWorkerSuccessResponse {
  requestId: number
  status: 'success'
  solutionValues: number[] | null
}

interface PuzzleSolverWorkerErrorResponse {
  requestId: number
  status: 'error'
  error: string
}

export type PuzzleSolverWorkerResponse =
  | PuzzleSolverWorkerSuccessResponse
  | PuzzleSolverWorkerErrorResponse
