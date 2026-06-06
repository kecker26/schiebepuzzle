import type { RefObject } from 'react'
import AnimatedReveal from '../../motion/AnimatedReveal.tsx'
import AnimatedStateSwap from '../../motion/AnimatedStateSwap.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'
import { PuzzleCompletionRecord, PuzzleDifficultyStats, PuzzleStats } from '../../types/index'
import UploadStatsVisualReport, { type VisualStatsView } from './UploadStatsVisualReport.tsx'
import UploadStateNotice from './UploadStateNotice.tsx'
import {
  HistoryFilter,
  HistoryFilterDefinition,
  StandardDifficultyStatsEntry,
} from './uploadUtils.ts'

interface UploadStatsReportProps {
  isLoadingStats: boolean
  stats: PuzzleStats | null
  latestCompletion: PuzzleCompletionRecord | null
  favoriteDifficulty: PuzzleDifficultyStats | null
  fastestDifficulty: PuzzleDifficultyStats | null
  completionHistory: PuzzleCompletionRecord[]
  filteredHistory: PuzzleCompletionRecord[]
  historyFilter: HistoryFilter
  historyFilterOptions: HistoryFilterDefinition[]
  standardDifficultyStats: StandardDifficultyStatsEntry[]
  onHistoryFilterChange: (filter: HistoryFilter) => void
  onReloadView: () => void
  onBackToStart: () => void
  activeVisualView: VisualStatsView
  onActiveVisualViewChange: (view: VisualStatsView) => void
  primaryFocusRef?: RefObject<HTMLButtonElement>
}

export default function UploadStatsReport({
  isLoadingStats,
  stats,
  latestCompletion,
  favoriteDifficulty,
  fastestDifficulty,
  completionHistory,
  filteredHistory,
  historyFilter,
  historyFilterOptions,
  standardDifficultyStats,
  onHistoryFilterChange,
  onReloadView,
  onBackToStart,
  activeVisualView,
  onActiveVisualViewChange,
  primaryFocusRef,
}: UploadStatsReportProps) {
  const reportStateKey = isLoadingStats
    ? 'loading'
    : completionHistory.length === 0
      ? 'empty'
      : 'content'

  return (
    <AnimatedStateSwap
      stateKey={reportStateKey}
      className="dashboard-panel-scroll stats-report-scroll"
    >
      {isLoadingStats ? (
        <UploadStateNotice
          icon={'\u{1F4CA}'}
          title="Statistik wird geladen ..."
          detail="Vergleichswerte, Rekorde und Verlauf werden gerade vorbereitet."
          role="status"
          ariaLive="polite"
          busy
        />
      ) : completionHistory.length === 0 ? (
        <UploadStateNotice
          icon={'\u{1F4DD}'}
          title="Noch keine Statistikdaten vorhanden."
          detail="Nach dem ersten Sieg erscheinen hier automatisch Vergleichswerte, Schwierigkeitsdetails und dein kompletter Verlauf."
        />
      ) : (
        <AnimatedStaggerGroup aria-label="Statistikbericht" className="stats-report-stack" level="medium">
          <AnimatedReveal level="medium">
            <UploadStatsVisualReport
              primaryFocusRef={primaryFocusRef}
              stats={stats}
              latestCompletion={latestCompletion}
              favoriteDifficulty={favoriteDifficulty}
              fastestDifficulty={fastestDifficulty}
              completionHistory={completionHistory}
              filteredHistory={filteredHistory}
              historyFilter={historyFilter}
              historyFilterOptions={historyFilterOptions}
              standardDifficultyStats={standardDifficultyStats}
              onHistoryFilterChange={onHistoryFilterChange}
              onReloadView={onReloadView}
              onBackToStart={onBackToStart}
              activeView={activeVisualView}
              onActiveViewChange={onActiveVisualViewChange}
            />
          </AnimatedReveal>
        </AnimatedStaggerGroup>
      )}
    </AnimatedStateSwap>
  )
}
