export const MIN_TIRA_CELL = 9
export const TIRA_AUTO_RATIO = 1.15

export const STRIP_CHROME = {
  header: 24,
  bodyPadding: 8,
  gap: 2,
} as const

/** Ancho de la columna de etiquetas de día (D..S) en la tira. */
export const STRIP_LABEL_W = 18

export type StripModePreference = 'auto' | 'meses' | 'tira'
export type ResolvedStripMode = 'meses' | 'tira'

export const STRIP_MODE_KEY = 'aeon:yearcal-mode'

export function parseStripPreference(raw: string | null): StripModePreference {
  if (raw === 'meses' || raw === 'tira' || raw === 'auto') return raw
  return 'auto'
}

export function loadStripPreference(): StripModePreference {
  try {
    return parseStripPreference(localStorage.getItem(STRIP_MODE_KEY))
  } catch {
    // En entornos sin localStorage (tests) el default es auto.
    return 'auto'
  }
}

export function saveStripPreference(pref: StripModePreference): void {
  try {
    localStorage.setItem(STRIP_MODE_KEY, pref)
  } catch {
    // Si no se puede persistir, el modo vive solo en memoria.
  }
}

/**
 * Resuelve el modo visible de la tira/meses.
 * Auto: 1x1 siempre va a meses; ancho > alto*1.15 va a tira;
 * alto >= ancho va a meses; la zona gris intermedia conserva el anterior.
 */
export function resolveStripMode(
  pref: StripModePreference,
  availW: number,
  availH: number,
  itemW?: number,
  itemH?: number,
  prev: ResolvedStripMode = 'meses'
): ResolvedStripMode {
  if (pref === 'meses') return 'meses'
  if (pref === 'tira') return 'tira'
  if (itemW !== undefined && itemH !== undefined && itemW <= 1 && itemH <= 1) {
    return 'meses'
  }
  if (availW <= 0 || availH <= 0) return prev
  const ratio = availW / availH
  if (ratio > TIRA_AUTO_RATIO) return 'tira'
  if (ratio < 1) return 'meses'
  return prev
}

export interface StripCell {
  date: string | null
  dayOfMonth: number
  month: number | null
}

export interface StripWeek {
  cells: StripCell[]
}

export interface MonthSpan {
  month: number
  startCol: number
  span: number
}

export interface DividerVertex {
  x: number
  y: number
}

export interface MonthDivider {
  fromMonth: number
  toMonth: number
  points: DividerVertex[]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Tira continua del año: columnas = semanas Dom-Sáb que cubren
 * 1-ene..31-dic. Las celdas fuera del año quedan en null.
 */
export function buildYearStrip(year: number): { weeks: StripWeek[]; spans: MonthSpan[] } {
  const jan1 = new Date(year, 0, 1)
  const cursor = new Date(year, 0, 1 - jan1.getDay())
  const end = new Date(year, 11, 31)
  const endDay = end.getDay()
  const last = new Date(year, 11, 31 + (6 - endDay))

  const weeks: StripWeek[] = []
  const c = new Date(cursor)
  while (c <= last) {
    const cells: StripCell[] = []
    for (let r = 0; r < 7; r++) {
      const inYear = c.getFullYear() === year
      cells.push({
        date: inYear ? `${c.getFullYear()}-${pad2(c.getMonth() + 1)}-${pad2(c.getDate())}` : null,
        dayOfMonth: c.getDate(),
        month: inYear ? c.getMonth() : null,
      })
      c.setDate(c.getDate() + 1)
    }
    weeks.push({ cells })
  }

  const owners = weeks.map(columnOwnerMonth)
  const spans: MonthSpan[] = []
  let start = 0
  for (let m = 0; m < 12; m++) {
    const cols: number[] = []
    owners.forEach((o, i) => {
      if (o === m) cols.push(i)
    })
    if (cols.length === 0) {
      spans.push({ month: m, startCol: start, span: 0 })
    } else {
      spans.push({ month: m, startCol: cols[0], span: cols.length })
      start = cols[cols.length - 1] + 1
    }
  }
  return { weeks, spans }
}

/**
 * Dueño de una columna: mes con mayoría de días del año.
 * Empate -> mes del miércoles (índice 3).
 */
export function columnOwnerMonth(week: StripWeek): number {
  const counts = new Map<number, number>()
  for (const cell of week.cells) {
    if (cell.month === null) continue
    counts.set(cell.month, (counts.get(cell.month) ?? 0) + 1)
  }
  if (counts.size === 0) return 0
  let best = -1
  let bestCount = -1
  for (const [month, count] of counts) {
    if (count > bestCount) {
      best = month
      bestCount = count
    }
  }
  const tied = [...counts.entries()].filter(([, count]) => count === bestCount)
  if (tied.length > 1) {
    const wed = week.cells[3]?.month
    if (wed !== null && wed !== undefined) return wed
  }
  return best
}

function effectiveMonth(weeks: StripWeek[], owners: number[], col: number, row: number): number {
  const month = weeks[col].cells[row].month
  return month === null ? owners[col] : month
}

/**
 * Divisores escalonados entre meses consecutivos, en coordenadas de grilla:
 * x = borde de columna (0..N), y = borde de fila (0..7). El path es
 * ortogonal y corre por los gaps, sin pisar celdas.
 */
export function monthDividers(weeks: StripWeek[], spans: MonthSpan[]): MonthDivider[] {
  void spans
  const n = weeks.length
  const owners = weeks.map(columnOwnerMonth)
  const dividers: MonthDivider[] = []
  for (let m = 0; m < 11; m++) {
    const xs: number[] = []
    for (let r = 0; r < 7; r++) {
      let x = n
      for (let c = 0; c < n; c++) {
        if (effectiveMonth(weeks, owners, c, r) > m) {
          x = c
          break
        }
      }
      xs.push(x)
    }
    const points: DividerVertex[] = [{ x: xs[0], y: 0 }]
    for (let r = 0; r < 7; r++) {
      points.push({ x: xs[r], y: r + 1 })
      if (r < 6) points.push({ x: xs[r + 1], y: r + 1 })
    }
    dividers.push({ fromMonth: m, toMonth: m + 1, points })
  }
  return dividers
}

/**
 * Gap de la tira proporcional a la celda (piso 2px): uniforme en todo el año
 * —no separa meses, solo le da aire a la línea divisoria—. El divisor SVG
 * corre por el medio del gap, así que a celdas más grandes, gap más ancho.
 */
export function stripGap(cell: number): number {
  return Math.max(2, Math.round(cell * 0.4))
}

/**
 * Celda de tira que llena el cuerpo: manda la más restrictiva entre las 7
 * filas y las `weekCount` columnas, con piso legible y sin tope superior.
 * El gap se refina una pasada a partir de la celda candidata y se usa en
 * AMBAS dimensiones, para que la última fila nunca se recorte.
 */
export function computeStripCellSize(availW: number, availH: number, weekCount = 53): number {
  const heightFit = (gap: number) =>
    Math.floor((availH - 2 * STRIP_CHROME.bodyPadding - STRIP_CHROME.header - 6 * gap) / 7)
  const widthFit = (gap: number) =>
    Math.floor((availW - STRIP_LABEL_W - gap - (weekCount - 1) * gap) / weekCount)
  const first = Math.min(heightFit(STRIP_CHROME.gap), widthFit(STRIP_CHROME.gap))
  const gap = stripGap(first)
  const cell = Math.min(heightFit(gap), widthFit(gap))
  if (!Number.isFinite(cell)) return MIN_TIRA_CELL
  return Math.max(MIN_TIRA_CELL, cell)
}
