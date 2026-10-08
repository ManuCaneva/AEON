export const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export interface MonthCell {
  date: string | null
  dayOfMonth: number
}

export function formatYyyyMmDd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Índice de día con semana iniciada en lunes: 0 = lunes … 6 = domingo. */
export function dayIndexOfWeek(date: Date): number {
  return (date.getDay() + 6) % 7
}

export function yearBounds(year: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export function monthGrid(year: number, month: number, weekStartsOn = 0): MonthCell[][] {
  const firstDay = new Date(year, month, 1)
  const startDow = firstDay.getDay()
  const diff = (startDow - weekStartsOn + 7) % 7
  const cursor = new Date(year, month, 1 - diff)

  const weeks: MonthCell[][] = []
  for (let w = 0; w < 6; w++) {
    const week: MonthCell[] = []
    for (let d = 0; d < 7; d++) {
      const inMonth = cursor.getMonth() === month && cursor.getFullYear() === year
      week.push({
        date: inMonth ? formatYyyyMmDd(cursor) : null,
        dayOfMonth: cursor.getDate(),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}
