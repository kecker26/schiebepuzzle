import { Medal } from 'lucide-react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import {
  formatChallengeMedalLabel,
  getChallengeMedalEmoji,
} from '../../utils/galleryChallenge.ts'
import type {
  GalleryMedalCollectionItem,
  GalleryMedalFilter,
} from './UploadGalleryDisplayUtils.ts'

interface UploadGalleryMedalCollectionProps {
  items: GalleryMedalCollectionItem[]
  activeFilter: GalleryMedalFilter
  onFilterChange: (filter: GalleryMedalFilter) => void
}

export default function UploadGalleryMedalCollection({
  items,
  activeFilter,
  onFilterChange,
}: UploadGalleryMedalCollectionProps) {
  const totalMedalMotifs = items.reduce((sum, item) => sum + item.count, 0)

  return (
    <section className="gallery-medal-collection" aria-labelledby="gallery-medal-collection-title">
      <div className="gallery-medal-collection-head">
        <span className="gallery-medal-collection-icon" aria-hidden="true">
          <Medal size={19} strokeWidth={2.4} />
        </span>
        <div className="gallery-medal-collection-copy">
          <span className="saved-games-kicker">Challenge-Erfolge</span>
          <strong id="gallery-medal-collection-title">Deine Medaillen</strong>
          <small>
            {totalMedalMotifs === 1 ? 'Hat' : 'Haben'} bereits eine Challenge-Medaille.
          </small>
        </div>
      </div>

      <div className="gallery-medal-collection-body">
        <div className="gallery-medal-collection-actions">
          <span className="gallery-medal-collection-count">
            {totalMedalMotifs} {totalMedalMotifs === 1 ? 'Motiv' : 'Motive'}
          </span>
          <button
            type="button"
            className={`dashboard-filter-chip gallery-medal-filter-clear${activeFilter === 'all' ? ' is-active' : ''}`}
            aria-pressed={activeFilter === 'all'}
            onClick={() => onFilterChange('all')}
          >
            Alle Medaillen
          </button>
        </div>

        <div
          className="gallery-medal-collection-list"
          role="group"
          aria-label="Galerie nach bester Medaille filtern"
          onKeyDown={handleDirectionalFocusNavigation}
        >
          {items.map(({ medal, count }) => {
            const label = formatChallengeMedalLabel(medal)
            const isActive = activeFilter === medal

            return (
              <button
                key={medal}
                type="button"
                className={`gallery-medal-collection-item is-${medal}`}
                aria-pressed={isActive}
                aria-label={`${label}-Medaillen filtern, ${count} ${count === 1 ? 'Motiv' : 'Motive'}`}
                disabled={count === 0}
                onClick={() => onFilterChange(isActive ? 'all' : medal)}
                data-app-tooltip={`${count} ${count === 1 ? 'Motiv hat' : 'Motive haben'} als beste Challenge-Medaille ${label}.`}
                data-app-tooltip-position="top"
              >
                <span className="gallery-medal-collection-emoji" aria-hidden="true">
                  {getChallengeMedalEmoji(medal)}
                </span>
                <span>
                  <strong>{label}</strong>
                  <small>{count} {count === 1 ? 'Motiv' : 'Motive'}</small>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
