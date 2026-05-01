import { useCallback, useEffect, useRef } from 'react'
import type {
  ExactPuzzleSolverWorkerRequest,
  ExactPuzzleSolverWorkerResponse,
  ExactStartMoveCountResult,
} from '../../services/ExactPuzzleSolverProtocol.ts'

interface PendingExactSolverRequest {
  resolve: (result: ExactStartMoveCountResult) => void
  reject: (error: Error) => void
}

interface ExactSolverRequestPayload {
  board: number[]
  emptyPos: number
  config: ExactPuzzleSolverWorkerRequest['config']
  maxVisitedNodes: number
}

export function useExactPuzzleSolverWorker() {
  const workerRef = useRef<Worker | null>(null)
  const pendingRequestsRef = useRef<Map<number, PendingExactSolverRequest>>(new Map())
  const nextRequestIdRef = useRef(0)

  useEffect(() => {
    const pendingRequests = pendingRequestsRef.current
    const worker = new Worker(new URL('../../workers/exact-puzzle-solver.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent<ExactPuzzleSolverWorkerResponse>) => {
      const pending = pendingRequests.get(event.data.requestId)
      if (!pending) return

      pendingRequests.delete(event.data.requestId)
      if (event.data.status === 'success') {
        pending.resolve(event.data.result)
        return
      }

      pending.reject(new Error(event.data.error))
    }

    worker.onerror = () => {
      const pending = [...pendingRequests.values()]
      pendingRequests.clear()
      for (const request of pending) {
        request.reject(new Error('Exakter Solver-Worker ist ausgefallen'))
      }
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
      workerRef.current = null
      const pending = [...pendingRequests.values()]
      pendingRequests.clear()
      for (const request of pending) {
        request.reject(new Error('Exakter Solver-Worker wurde beendet'))
      }
    }
  }, [])

  const requestExactStartMoveCount = useCallback(async ({
    board,
    emptyPos,
    config,
    maxVisitedNodes,
  }: ExactSolverRequestPayload): Promise<ExactStartMoveCountResult | null> => {
    const worker = workerRef.current
    if (!worker) return null

    const requestId = ++nextRequestIdRef.current
    const payload: ExactPuzzleSolverWorkerRequest = {
      requestId,
      board: [...board],
      emptyPos,
      config,
      maxVisitedNodes,
    }

    try {
      return await new Promise<ExactStartMoveCountResult>((resolve, reject) => {
        pendingRequestsRef.current.set(requestId, { resolve, reject })
        worker.postMessage(payload)
      })
    } catch {
      return null
    }
  }, [])

  return {
    requestExactStartMoveCount,
  }
}
