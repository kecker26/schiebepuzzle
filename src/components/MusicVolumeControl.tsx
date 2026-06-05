import { useCallback, useId, useSyncExternalStore } from 'react'
import audioService from '../services/AudioService.ts'
import '../styles/components/music-volume-control.css'

interface MusicVolumeControlProps {
  variant?: 'panel' | 'popover'
}

function useMusicVolume(): number {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return audioService.subscribeToMusicVolume(onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => audioService.getMusicVolume(), [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

export default function MusicVolumeControl({ variant = 'panel' }: MusicVolumeControlProps) {
  const musicVolume = useMusicVolume()
  const inputId = useId()
  const volumePercent = Math.round(musicVolume * 100)

  return (
    <div
      className={`music-volume-control music-volume-control--${variant}`}
      data-app-tooltip={`Musiklautstaerke: ${volumePercent}%.`}
      data-app-tooltip-align="start"
    >
      <div className="music-volume-control-head">
        <label className="music-volume-control-label" htmlFor={inputId}>
          Lautstaerke
        </label>
        <strong className="music-volume-control-value">{volumePercent}%</strong>
      </div>
      <input
        id={inputId}
        type="range"
        min="0"
        max="100"
        step="1"
        value={volumePercent}
        onChange={(event) => {
          audioService.setMusicVolume(Number(event.currentTarget.value) / 100)
        }}
        className="music-volume-control-input"
        aria-label="Musiklautstaerke"
      />
      <div className="music-volume-control-scale" aria-hidden="true">
        <span>Leise</span>
        <span>Laut</span>
      </div>
    </div>
  )
}
