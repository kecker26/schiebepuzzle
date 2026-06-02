import type { CSSProperties } from 'react'
import type { PuzzleConfig } from '../../types/index'
import type { DifficultyReportRow } from './uploadUtils.ts'

export const DIFFICULTY_TREND_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee']

type DifficultyColorStyle = CSSProperties & {
  '--stats-difficulty-color'?: string
}

export function getDifficultyKey(config: PuzzleConfig): `${number}x${number}` {
  return `${config.rows}x${config.cols}`
}

export function buildDifficultyColorMap(rows: DifficultyReportRow[]): ReadonlyMap<string, string> {
  return new Map(
    rows
      .filter((row) => row.solveCount > 0)
      .map((row, index) => [
        `${row.option.rows}x${row.option.cols}`,
        DIFFICULTY_TREND_COLORS[index % DIFFICULTY_TREND_COLORS.length],
      ])
  )
}

export function getDifficultyColor(
  difficultyColorMap: ReadonlyMap<string, string>,
  config: PuzzleConfig
): string | null {
  return difficultyColorMap.get(getDifficultyKey(config)) ?? null
}

export function getDifficultyColorStyle(
  difficultyColorMap: ReadonlyMap<string, string>,
  config: PuzzleConfig
): DifficultyColorStyle | undefined {
  const color = getDifficultyColor(difficultyColorMap, config)

  return color ? { '--stats-difficulty-color': color } : undefined
}
