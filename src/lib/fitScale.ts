/** Escala uniforme (0..1] para que un diseño entre en el viewport sin scroll. */
export function fitScale(
  designW: number,
  designH: number,
  viewportW: number,
  viewportH: number,
  margin = 32
): number {
  const availW = viewportW - margin
  const availH = viewportH - margin
  if (availW <= 0 || availH <= 0 || designW <= 0 || designH <= 0) return 0
  return Math.min(1, availW / designW, availH / designH)
}
