import type { RefObject } from 'react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedReveal from '../../motion/AnimatedReveal.tsx'
import AnimatedStateSwap from '../../motion/AnimatedStateSwap.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'
import BusyIndicator from '../../motion/BusyIndicator.tsx'

interface UploadDataTransferPanelProps {
  savedGamesCount: number
  totalSolved: number
  galleryEntriesCount: number
  isExportingBackup: boolean
  isLoadingBackupFiles: boolean
  isImportingBackup: boolean
  statusMessage: string | null
  onExportBackup: () => void
  onOpenBackupImport: () => void
  importActionRef?: RefObject<HTMLButtonElement>
}

export default function UploadDataTransferPanel({
  savedGamesCount,
  totalSolved,
  galleryEntriesCount,
  isExportingBackup,
  isLoadingBackupFiles,
  isImportingBackup,
  statusMessage,
  onExportBackup,
  onOpenBackupImport,
  importActionRef,
}: UploadDataTransferPanelProps) {
  const statusStateKey = isExportingBackup
    ? 'exporting'
    : isLoadingBackupFiles
      ? 'loading-backups'
      : isImportingBackup
      ? 'importing'
      : statusMessage
        ? 'success'
        : 'idle'

  return (
    <AnimatedStaggerGroup
      as="section"
      className="data-transfer-panel"
      aria-labelledby="data-transfer-title"
      interaction="surface"
      level="medium"
    >
      <AnimatedReveal className="data-transfer-copy" level="medium">
        <span className="upload-kicker">Datensicherung</span>
        <div className="upload-section-title-row">
          <span className="upload-section-title-icon-shell" aria-hidden="true">
            <UploadScreenIcon name="archiveRestore" className="upload-section-title-icon" />
          </span>
          <h2 id="data-transfer-title" className="data-transfer-title">
            Backup, Import und Export
          </h2>
        </div>
        <p className="data-transfer-text">
          Sichere Spielstaende, Statistik und Galerie gemeinsam als Backup-Datei. Beim Import wird der
          aktuelle Datenstand komplett ersetzt.
        </p>
        <div className="dashboard-inline-chips data-transfer-chips">
          <span className="saved-game-chip">
            <UploadScreenIcon name="folder" className="saved-game-chip-icon" />
            <span>{savedGamesCount} Spielstaende</span>
          </span>
          <span className="saved-game-chip">
            <UploadScreenIcon name="award" className="saved-game-chip-icon" />
            <span>{totalSolved} Siege</span>
          </span>
          <span className="saved-game-chip">
            <UploadScreenIcon name="gallery" className="saved-game-chip-icon" />
            <span>{galleryEntriesCount} Galerie-Bilder</span>
          </span>
        </div>
      </AnimatedReveal>

      <div className="data-transfer-controls">
        <AnimatedStaggerGroup
          className="data-transfer-actions"
          level="subtle"
          onKeyDown={handleDirectionalFocusNavigation}
        >
          <AnimatedButton
            onClick={onExportBackup}
            disabled={isImportingBackup}
            busy={isExportingBackup}
            busyLabel="Exportiere Backup ..."
            data-app-tooltip="Speichert Spielstaende, Statistik, Galerie und Sammlungen als lokale Backup-Datei."
            data-app-tooltip-position="top"
            reveal
            revealLevel="subtle"
          >
            Backup exportieren
          </AnimatedButton>
          <AnimatedButton
            ref={importActionRef}
            className="secondary"
            onClick={onOpenBackupImport}
            disabled={isExportingBackup}
            busy={isImportingBackup || isLoadingBackupFiles}
            busyLabel={isLoadingBackupFiles ? 'Lade Backups ...' : 'Importiere Backup ...'}
            data-app-tooltip="Lokales Backup auswaehlen. Import ersetzt den aktuellen Datenstand komplett."
            data-app-tooltip-position="top"
            reveal
            revealLevel="subtle"
          >
            Backup importieren
          </AnimatedButton>
        </AnimatedStaggerGroup>

        <p className="data-transfer-action-note">
          Es werden immer nur die 3 neuesten lokalen Backups behalten. Beim neuen Export wird das
          aelteste automatisch entfernt.
        </p>
      </div>

      <AnimatedStateSwap stateKey={statusStateKey} className="data-transfer-status-swap">
        {isExportingBackup ? (
          <AnimatedReveal
            as="div"
            className="data-transfer-status is-busy"
            role="status"
            aria-live="polite"
            level="subtle"
          >
            <BusyIndicator />
            Backup wird exportiert ...
          </AnimatedReveal>
        ) : isLoadingBackupFiles ? (
          <AnimatedReveal
            as="div"
            className="data-transfer-status is-busy"
            role="status"
            aria-live="polite"
            level="subtle"
          >
            <BusyIndicator />
            Vorhandene Backups werden geladen ...
          </AnimatedReveal>
        ) : isImportingBackup ? (
          <AnimatedReveal
            as="div"
            className="data-transfer-status is-busy"
            role="status"
            aria-live="polite"
            level="subtle"
          >
            <BusyIndicator />
            Backup wird importiert ...
          </AnimatedReveal>
        ) : statusMessage ? (
          <AnimatedReveal
            as="div"
            className="data-transfer-status is-success"
            role="status"
            aria-live="polite"
            level="subtle"
          >
            {statusMessage}
          </AnimatedReveal>
        ) : (
          <AnimatedReveal as="div" className="data-transfer-status is-muted" level="subtle">
            Exportiert Spielstaende, Statistik und Galerie in den Backup-Ordner der App und zeigt beim Import nur die dort vorhandenen Backup-Dateien an.
          </AnimatedReveal>
        )}
      </AnimatedStateSwap>
    </AnimatedStaggerGroup>
  )
}
