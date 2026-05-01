import { useCallback, useEffect, useRef } from 'react'
import type {
  PuzzleSolverWorkerRequest,
  PuzzleSolverWorkerResponse,
} from '../../services/PuzzleSolverWorkerProtocol.ts'

interface PendingSolverRequest {
  resolve: (solutionValues: number[] | null) => void
  reject: (error: Error) => void
}

interface SolverRequestPayload {
  board: number[]
  emptyPos: number
  config: PuzzleSolverWorkerRequest['config']
  maxVisitedNodes: number
}

export function usePuzzleSolverWorker() {
  const workerRef = useRef<Worker | null>(null)
  const pendingSolverRequestsRef = useRef<Map<number, PendingSolverRequest>>(new Map())
  const nextSolverRequestIdRef = useRef(0)

  useEffect(() => {
    const pendingRequests = pendingSolverRequestsRef.current
    const worker = new Worker(new URL('../../workers/puzzle-solver.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent<PuzzleSolverWorkerResponse>) => {
      const pending = pendingRequests.get(event.data.requestId)
      if (!pending) return

      pendingRequests.delete(event.data.requestId)
      if (event.data.status === 'success') {
        pending.resolve(event.data.solutionValues)
        return
      }

      pending.reject(new Error(event.data.error))
    }

    worker.onerror = () => {
      const pending = [...pendingRequests.values()]
      pendingRequests.clear()
      for (const request of pending) {
        request.reject(new Error('Solver-Worker ist ausgefallen'))
      }
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
      workerRef.current = null
      const pending = [...pendingRequests.values()]
      pendingRequests.clear()
      for (const request of pending) {
        request.reject(new Error('Solver-Worker wurde beendet'))
      }
    }
  }, [])

  const requestSolutionValues = useCallback(async ({
    board,
    emptyPos,
    config,
    maxVisitedNodes,
  }: SolverRequestPayload): Promise<number[] | null> => {
    const worker = workerRef.current
    if (!worker) return null

    const requestId = ++nextSolverRequestIdRef.current
    const payload: PuzzleSolverWorkerRequest = {
      requestId,
      board: [...board],
      emptyPos,
      config,
      maxVisitedNodes,
    }

    try {
      return await new Promise<number[] | null>((resolve, reject) => {
        pendingSolverRequestsRef.current.set(requestId, { resolve, reject })
        worker.postMessage(payload)
      })
    } catch {
      return null
    }
  }, [])

  return {
    requestSolutionValues,
  }
}
