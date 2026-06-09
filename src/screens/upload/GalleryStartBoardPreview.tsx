import type { CSSProperties } from 'react'
import type { SolvedGalleryEntry } from '../../types/index'
import { isGalleryReplaySetupCompatible } from '../../utils/galleryReplaySetup.ts'

interface GalleryStartBoardPreviewProps {
  entry: SolvedGalleryEntry | null
  className?: string
}

function getBackgroundPosition(index: number, count: number): string {
  if (count <= 1) return '0%'
  return `${(index / (count - 1)) * 100}%`
}

export default function GalleryStartBoardPreview({
  entry,
  className = '',
}: GalleryStartBoardPreviewProps) {
  const image = entry?.previewImage ?? entry?.sourceImage ?? null
  const hasStartBoard = Boolean(
    entry
    && image
    && isGalleryReplaySetupCompatible(entry.replaySetup, entry.config)
  )
  const rootClassName = `gallery-start-board-preview${hasStartBoard ? ' has-start-board' : ''}${className ? ` ${className}` : ''}`

  if (!entry || !image) {
    return (
      <div className={rootClassName} aria-label="Startbrett nicht mehr verfuegbar" role="img">
        <span className="gallery-start-board-preview-placeholder">Archiv</span>
      </div>
    )
  }

  if (!hasStartBoard || !entry.replaySetup) {
    return (
      <div className={rootClassName} aria-label="Motivvorschau; gespeichertes Startbrett nicht verfuegbar" role="img">
        <img src={image} alt="" loading="lazy" decoding="async" />
        <span className="gallery-start-board-preview-label">Motiv</span>
      </div>
    )
  }

  const { rows, cols } = entry.config
  const emptyTileValue = rows * cols - 1
  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  }

  return (
    <div
      className={rootClassName}
      aria-label={`Gemischtes Startbrett mit ${rows} mal ${cols} Kacheln`}
      role="img"
    >
      <div className="gallery-start-board-preview-grid" style={gridStyle}>
        {entry.replaySetup.startBoard.map((tileValue, position) => {
          const isEmpty = tileValue === emptyTileValue
          const sourceRow = Math.floor(tileValue / cols)
          const sourceCol = tileValue % cols
          const tileStyle = isEmpty
            ? undefined
            : {
                backgroundImage: `url("${image}")`,
                backgroundSize: `${cols * 100}% ${rows * 100}%`,
                backgroundPosition: `${getBackgroundPosition(sourceCol, cols)} ${getBackgroundPosition(sourceRow, rows)}`,
              } as CSSProperties

          return (
            <span
              key={position}
              className={`gallery-start-board-preview-tile${isEmpty ? ' is-empty' : ''}`}
              style={tileStyle}
              data-board-value={tileValue}
              aria-hidden="true"
            />
          )
        })}
      </div>
      <span className="gallery-start-board-preview-label">Startbrett</span>
    </div>
  )
}
