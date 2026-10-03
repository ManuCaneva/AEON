export const TEXT_SIZES = ['small', 'medium', 'large'] as const

export type TextSize = (typeof TEXT_SIZES)[number]

const DEFAULT_TEXT_SIZE: TextSize = 'medium'

const TEXT_SIZE_SCALE: Record<TextSize, number> = {
  small: 0.9,
  medium: 1,
  large: 1.15,
}

export function isTextSize(value: unknown): value is TextSize {
  return TEXT_SIZES.includes(value as TextSize)
}

export function textSizeScale(value: unknown): number {
  if (!isTextSize(value)) return TEXT_SIZE_SCALE[DEFAULT_TEXT_SIZE]
  return TEXT_SIZE_SCALE[value]
}
