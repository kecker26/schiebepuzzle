import { useEffect, useState } from 'react'

export default function useDelayedBusy(isBusy: boolean, delayMs = 350) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!isBusy) {
      setIsVisible(false)
      return
    }

    const timeoutId = window.setTimeout(() => setIsVisible(true), delayMs)
    return () => window.clearTimeout(timeoutId)
  }, [delayMs, isBusy])

  return isVisible
}
