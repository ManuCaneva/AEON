const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Fecha local `YYYY-MM-DD` del día siguiente. Es el fin exclusivo que Google
 * Calendar espera para un evento de todo el día.
 *
 * Aritmética pura sobre la cadena (en UTC) para no arrastrar corrimientos de
 * zona horaria: `2026-01-31` → `2026-02-01`, `2026-12-31` → `2027-01-01`.
 */
export function nextLocalDate(date: string): string {
  const match = LOCAL_DATE_RE.exec(date)
  if (!match) {
    throw new Error(`Fecha local inválida: ${date}. Se esperaba YYYY-MM-DD.`)
  }
  const [, year, month, day] = match
  const next = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + 1))
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
