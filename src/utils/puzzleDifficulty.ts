import { PuzzleConfig } from '../types/index'

export interface DifficultyOption {
  key: 'leicht' | 'normal' | 'schwer' | 'sehr_schwer'
  label: string
  description: string
  rows: number
  cols: number
  tileCount: number
}

export const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  {
    key: 'leicht',
    label: 'Leicht',
    description: '3x3',
    rows: 3,
    cols: 3,
    tileCount: 9,
  },
  {
    key: 'normal',
    label: 'Normal',
    description: '4x4',
    rows: 4,
    cols: 4,
    tileCount: 16,
  },
  {
    key: 'schwer',
    label: 'Schwer',
    description: '5x5',
    rows: 5,
    cols: 5,
    tileCount: 25,
  },
  {
    key: 'sehr_schwer',
    label: 'Sehr Schwer',
    description: '6x6',
    rows: 6,
    cols: 6,
    tileCount: 36,
  },
]

export const DEFAULT_PUZZLE_CONFIG: PuzzleConfig = {
  rows: 4,
  cols: 4,
}

export function getDifficultyOption(config: PuzzleConfig): DifficultyOption | null {
  return (
    DIFFICULTY_OPTIONS.find((option) => option.rows === config.rows && option.cols === config.cols) ?? null
  )
}

export function formatPuzzleSize(config: PuzzleConfig): string {
  return `${config.rows}x${config.cols}`
}

export function formatDifficultyLabel(config: PuzzleConfig): string {
  const option = getDifficultyOption(config)
  if (!option) {
    return formatPuzzleSize(config)
  }

  return `${option.label} ${formatPuzzleSize(config)}`
}

export function getNextDifficultyOption(config: PuzzleConfig): DifficultyOption | null {
  const currentIndex = DIFFICULTY_OPTIONS.findIndex(
    (option) => option.rows === config.rows && option.cols === config.cols
  )

  if (currentIndex < 0 || currentIndex >= DIFFICULTY_OPTIONS.length - 1) {
    return null
  }

  return DIFFICULTY_OPTIONS[currentIndex + 1]
}

export function shouldUseFastSuggestion(config: PuzzleConfig): boolean {
  return config.rows * config.cols >= 25
}

