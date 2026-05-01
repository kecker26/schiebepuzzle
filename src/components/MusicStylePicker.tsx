import { useCallback, useSyncExternalStore } from 'react'
import audioService from '../services/AudioService.ts'
import { MUSIC_STYLE_DEFINITIONS } from '../services/musicStyles.ts'
import '../styles/components/music-style-picker.css'

interface MusicStylePickerProps {
  variant?: 'grid' | 'compact' | 'popover' | 'sidebar'
  onSelect?: () => void
}

function useSelectedMusicStyle() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return audioService.subscribeToSelectedMusicStyle(onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => audioService.getSelectedMusicStyle(), [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

export default function MusicStylePicker({ variant = 'grid', onSelect }: MusicStylePickerProps) {
  const selectedMusicStyle = useSelectedMusicStyle()
  const showDescriptions = variant !== 'compact'

  return (
    <div className={`music-style-picker music-style-picker--${variant}`} aria-label="Musikstile">
      {MUSIC_STYLE_DEFINITIONS.map((style) => {
        const isSelected = style.id === selectedMusicStyle

        return (
          <button
            key={style.id}
            type="button"
            className={`music-style-picker-button${isSelected ? ' is-selected' : ''}`}
            aria-pressed={isSelected}
            onClick={() => {
              audioService.setSelectedMusicStyle(style.id)
              onSelect?.()
            }}
            title={`${style.label}: ${style.description}`}
          >
            <span className="music-style-picker-label">{style.label}</span>
            {showDescriptions && <span className="music-style-picker-copy">{style.description}</span>}
          </button>
        )
      })}
    </div>
  )
}
