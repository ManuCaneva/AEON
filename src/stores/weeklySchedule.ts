import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as db from '../lib/db'
import {
  type BlockColorToken,
  type CreateScheduleBlockDraft,
  type CreateScheduleSlotDraft,
  type SaveScheduleSlotDraft,
  type ScheduleBlock,
  type ScheduleBlockWithSlots,
  type ScheduleSlot,
  type UpdateScheduleBlockDraft,
  type WeeklyScheduleSettings,
  DEFAULT_WEEKLY_SCHEDULE_SETTINGS,
  SCHEDULE_VALIDATION_ERRORS,
  rowToScheduleBlock,
  rowToScheduleSlot,
} from '../schemas/weeklySchedule'

function nowIsoUtc(): string {
  return new Date().toISOString()
}
function uuidv4(): string {
  return crypto.randomUUID()
}

export function minutesToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
export function hhmmToMinutes(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) throw new Error(`HH:MM inválido: ${s}`)
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h < 0 || h > 23 || mm < 0 || mm > 59) throw new Error(`HH:MM fuera de rango: ${s}`)
  return h * 60 + mm
}

export function overlaps(
  a: { start_minutes: number; end_minutes: number },
  b: { start_minutes: number; end_minutes: number }
): boolean {
  return a.start_minutes < b.end_minutes && b.start_minutes < a.end_minutes
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: 'overlap'; day: number; start: number; end: number }
  | {
      ok: false
      reason: 'overlapBlock'
      day: number
      start: number
      end: number
      blockTitle: string
    }

export const DEFAULT_VISIBLE_WINDOW = { start_minutes: 360, end_minutes: 1380 } as const
export type VisibleWindow = { start_minutes: number; end_minutes: number }

export function computeVisibleWindow(
  blocksWithSlots: Pick<ScheduleBlockWithSlots, 'slots'>[]
): VisibleWindow {
  let minStart: number | null = null
  let maxEnd: number | null = null
  for (const bw of blocksWithSlots) {
    for (const slot of bw.slots) {
      if (minStart === null || slot.start_minutes < minStart) minStart = slot.start_minutes
      if (maxEnd === null || slot.end_minutes > maxEnd) maxEnd = slot.end_minutes
    }
  }
  if (minStart === null || maxEnd === null) {
    return { ...DEFAULT_VISIBLE_WINDOW }
  }
  return {
    start_minutes: Math.floor(minStart / 60) * 60,
    end_minutes: Math.ceil(maxEnd / 60) * 60,
  }
}

export const useWeeklyScheduleStore = defineStore('weeklySchedule', () => {
  const blocksWithSlots = ref<ScheduleBlockWithSlots[]>([])
  const settings = ref<WeeklyScheduleSettings>({ ...DEFAULT_WEEKLY_SCHEDULE_SETTINGS })
  const loading = ref(false)
  const lastError = ref<string | null>(null)

  const blocksByDay = computed(() => {
    const map = new Map<number, ScheduleSlot[]>()
    for (let d = 0; d < 7; d++) map.set(d, [])
    for (const bw of blocksWithSlots.value) {
      for (const slot of bw.slots) {
        const list = map.get(slot.day_of_week)
        if (list) {
          list.push(slot)
        }
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_minutes - b.start_minutes)
    }
    return map
  })

  const enabledDays = computed(() => [...settings.value.enabled_days].sort((a, b) => a - b))

  function isDayEnabled(day: number): boolean {
    return enabledDays.value.includes(day)
  }

  const visibleWindow = computed(() => {
    const enabled = new Set(enabledDays.value)
    return computeVisibleWindow(
      blocksWithSlots.value.map((block) => ({
        slots: block.slots.filter((slot) => enabled.has(slot.day_of_week)),
      }))
    )
  })

  function wouldOverlapOnDay(
    day: number,
    start: number,
    end: number,
    ignoreSlotId?: string
  ): boolean {
    const list = blocksByDay.value.get(day) ?? []
    return list.some(
      (s) =>
        (ignoreSlotId === undefined || s.id !== ignoreSlotId) &&
        overlaps(s, { start_minutes: start, end_minutes: end })
    )
  }

  function validateSlot(
    draft: { day_of_week: number; start_minutes: number; end_minutes: number },
    ignoreSlotId?: string
  ): ValidationResult {
    if (wouldOverlapOnDay(draft.day_of_week, draft.start_minutes, draft.end_minutes, ignoreSlotId))
      return {
        ok: false,
        reason: 'overlap',
        day: draft.day_of_week,
        start: draft.start_minutes,
        end: draft.end_minutes,
      }
    return { ok: true }
  }

  /**
   * Vacía los bloques y slots en memoria. Conserva los ajustes del
   * cronograma. Para «Borrar datos».
   */
  function reset(): void {
    blocksWithSlots.value = []
    lastError.value = null
  }

  async function loadAll() {
    loading.value = true
    lastError.value = null
    try {
      const [blockRows, slotRows] = await Promise.all([
        db.listScheduleBlocks(),
        db.listScheduleSlots(),
      ])
      const blocksMap = new Map<string, ScheduleBlock>()
      for (const r of blockRows) {
        blocksMap.set(r.id, rowToScheduleBlock(r))
      }
      const slotsByBlock = new Map<string, ScheduleSlot[]>()
      for (const r of slotRows) {
        const slot = rowToScheduleSlot(r)
        const list = slotsByBlock.get(slot.block_id) ?? []
        list.push(slot)
        slotsByBlock.set(slot.block_id, list)
      }
      blocksWithSlots.value = blockRows.map((r) => {
        const block = rowToScheduleBlock(r)
        return { ...block, slots: slotsByBlock.get(block.id) ?? [] }
      })
      settings.value = await db.loadWeeklyScheduleSettings()
    } catch (e) {
      console.error('WeeklySchedule loadAll failed:', e)
      lastError.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function createBlock(
    draft: CreateScheduleBlockDraft,
    slots: CreateScheduleSlotDraft[]
  ): Promise<ScheduleBlockWithSlots> {
    for (const s of slots) {
      const v = validateSlot(s)
      if (!v.ok) throw new Error('Un slot se solapa con otro existente en ese día')
    }
    const blockId = uuidv4()
    const ts = nowIsoUtc()
    const blockRow = await db.createScheduleBlock(draft, blockId, ts, ts)
    const block = rowToScheduleBlock(blockRow)
    const createdSlots: ScheduleSlot[] = []
    for (const s of slots) {
      const slotId = uuidv4()
      const slotRow = await db.createScheduleSlot(s, slotId, blockId, ts, ts)
      createdSlots.push(rowToScheduleSlot(slotRow))
    }
    const bw: ScheduleBlockWithSlots = { ...block, slots: createdSlots }
    blocksWithSlots.value = [...blocksWithSlots.value, bw]
    return bw
  }

  async function updateBlock(id: string, patch: UpdateScheduleBlockDraft): Promise<void> {
    const existing = blocksWithSlots.value.find((bw) => bw.id === id)
    if (!existing) throw new Error('Bloque no encontrado')
    const ts = nowIsoUtc()
    const row = await db.updateScheduleBlock(id, patch, ts)
    const updated = rowToScheduleBlock(row)
    blocksWithSlots.value = blocksWithSlots.value.map((bw) =>
      bw.id === id ? { ...updated, slots: bw.slots } : bw
    )
  }

  async function addSlot(blockId: string, draft: CreateScheduleSlotDraft): Promise<ScheduleSlot> {
    const v = validateSlot(draft)
    if (!v.ok) throw new Error('El slot se solapa con otro existente en ese día')
    const existing = blocksWithSlots.value.find((bw) => bw.id === blockId)
    if (!existing) throw new Error('Bloque no encontrado')
    const slotId = uuidv4()
    const ts = nowIsoUtc()
    const slotRow = await db.createScheduleSlot(draft, slotId, blockId, ts, ts)
    const slot = rowToScheduleSlot(slotRow)
    blocksWithSlots.value = blocksWithSlots.value.map((bw) =>
      bw.id === blockId ? { ...bw, slots: [...bw.slots, slot] } : bw
    )
    return slot
  }

  async function updateSlot(
    slotId: string,
    patch: {
      day_of_week?: number
      start_minutes?: number
      end_minutes?: number
    }
  ): Promise<void> {
    const bw = blocksWithSlots.value.find((b) => b.slots.some((s) => s.id === slotId))
    if (!bw) throw new Error('Slot no encontrado')
    const existingSlot = bw.slots.find((s) => s.id === slotId)!
    const merged = { ...existingSlot, ...patch }
    const v = validateSlot(merged, slotId)
    if (!v.ok) throw new Error('El slot se solapa con otro existente en ese día')
    const ts = nowIsoUtc()
    const row = await db.updateScheduleSlot(slotId, patch, ts)
    const updated = rowToScheduleSlot(row)
    blocksWithSlots.value = blocksWithSlots.value.map((b) =>
      b.id === bw.id ? { ...b, slots: b.slots.map((s) => (s.id === slotId ? updated : s)) } : b
    )
  }

  async function deleteSlot(slotId: string): Promise<void> {
    await db.deleteScheduleSlot(slotId)
    blocksWithSlots.value = blocksWithSlots.value.map((bw) =>
      bw.id === bw.slots.find((s) => s.id === slotId)?.block_id
        ? { ...bw, slots: bw.slots.filter((s) => s.id !== slotId) }
        : bw
    )
  }

  async function deleteBlock(id: string): Promise<void> {
    await db.deleteScheduleBlock(id)
    blocksWithSlots.value = blocksWithSlots.value.filter((bw) => bw.id !== id)
  }

  interface FinalSlot {
    id: string
    day: number
    start: number
    end: number
    blockTitle: string
    fromSelf: boolean
  }

  function overlapMessage(desired: SaveScheduleSlotDraft[], selfBlockId?: string): string | null {
    const selfTitle =
      selfBlockId !== undefined
        ? blocksWithSlots.value.find((bw) => bw.id === selfBlockId)?.title
        : undefined
    const selfTitleFallback = selfTitle ?? 'este bloque'
    const finals: FinalSlot[] = []
    for (const bw of blocksWithSlots.value) {
      if (selfBlockId !== undefined && bw.id === selfBlockId) continue
      for (const s of bw.slots) {
        finals.push({
          id: s.id,
          day: s.day_of_week,
          start: s.start_minutes,
          end: s.end_minutes,
          blockTitle: bw.title,
          fromSelf: false,
        })
      }
    }
    desired.forEach((s, i) => {
      finals.push({
        id: s.id ?? `new-${i}`,
        day: s.day_of_week,
        start: s.start_minutes,
        end: s.end_minutes,
        blockTitle: selfTitleFallback,
        fromSelf: true,
      })
    })
    for (const a of finals) {
      for (const b of finals) {
        if (a.id >= b.id || a.day !== b.day) continue
        if (
          !overlaps(
            { start_minutes: a.start, end_minutes: a.end },
            { start_minutes: b.start, end_minutes: b.end }
          )
        )
          continue
        if (a.fromSelf && b.fromSelf) {
          return `Los horarios se superponen entre sí en el día de la semana`
        }
        const other = a.fromSelf ? b : a
        return `Los horarios se superponen con «${other.blockTitle}»`
      }
    }
    return null
  }

  interface SaveScheduleBlockInput {
    blockId?: string
    title: string
    color: BlockColorToken
    slots: SaveScheduleSlotDraft[]
  }

  async function saveBlock(input: SaveScheduleBlockInput): Promise<void> {
    const title = input.title.trim()
    if (!title) throw new Error(SCHEDULE_VALIDATION_ERRORS.titleRequired)
    if (input.slots.length === 0) throw new Error(SCHEDULE_VALIDATION_ERRORS.atLeastOneSlot)
    for (const s of input.slots) {
      if (s.end_minutes <= s.start_minutes) {
        throw new Error(SCHEDULE_VALIDATION_ERRORS.endAfterStart)
      }
      if (!isDayEnabled(s.day_of_week)) {
        throw new Error('El día está desactivado en la configuración')
      }
    }
    const clash = overlapMessage(input.slots, input.blockId)
    if (clash) throw new Error(clash)

    const ts = nowIsoUtc()
    if (input.blockId === undefined) {
      await createBlock(
        { title, color: input.color, sort_order: 0 },
        input.slots.map((s) => ({
          day_of_week: s.day_of_week,
          start_minutes: s.start_minutes,
          end_minutes: s.end_minutes,
        }))
      )
      return
    }

    const existing = blocksWithSlots.value.find((bw) => bw.id === input.blockId)
    if (!existing) throw new Error('Bloque no encontrado')
    const existingById = new Map(existing.slots.map((s) => [s.id, s]))
    const desiredById = new Map(
      input.slots
        .filter((s): s is SaveScheduleSlotDraft & { id: string } => !!s.id)
        .map((s) => [s.id, s])
    )

    for (const oldSlot of existing.slots) {
      if (!desiredById.has(oldSlot.id)) {
        await db.deleteScheduleSlot(oldSlot.id)
      }
    }
    const blockChanged = title !== existing.title || input.color !== existing.color
    if (blockChanged) {
      await db.updateScheduleBlock(input.blockId, { title, color: input.color }, ts)
    }

    const finalSlots: ScheduleSlot[] = []
    for (const draft of input.slots) {
      if (draft.id !== undefined) {
        const old = existingById.get(draft.id)
        if (!old) throw new Error('Slot no encontrado')
        if (
          old.day_of_week !== draft.day_of_week ||
          old.start_minutes !== draft.start_minutes ||
          old.end_minutes !== draft.end_minutes
        ) {
          const row = await db.updateScheduleSlot(
            draft.id,
            {
              day_of_week: draft.day_of_week,
              start_minutes: draft.start_minutes,
              end_minutes: draft.end_minutes,
            },
            ts
          )
          finalSlots.push(rowToScheduleSlot(row))
        } else {
          finalSlots.push(old)
        }
      } else {
        const slotId = uuidv4()
        const row = await db.createScheduleSlot(
          {
            day_of_week: draft.day_of_week,
            start_minutes: draft.start_minutes,
            end_minutes: draft.end_minutes,
          },
          slotId,
          existing.id,
          ts,
          ts
        )
        finalSlots.push(rowToScheduleSlot(row))
      }
    }

    const updatedBlock: ScheduleBlock = {
      id: existing.id,
      title,
      color: input.color,
      sort_order: existing.sort_order,
      created_at: existing.created_at,
      updated_at: blockChanged ? ts : existing.updated_at,
    }
    blocksWithSlots.value = blocksWithSlots.value.map((bw) =>
      bw.id === existing.id ? { ...updatedBlock, slots: finalSlots } : bw
    )
  }

  async function saveSettings(patch: Partial<WeeklyScheduleSettings>): Promise<void> {
    settings.value = { ...settings.value, ...patch }
    await db.saveWeeklyScheduleSettings(settings.value)
  }

  return {
    blocksWithSlots,
    settings,
    loading,
    lastError,
    blocksByDay,
    enabledDays,
    isDayEnabled,
    visibleWindow,
    wouldOverlapOnDay,
    validateSlot,
    reset,
    loadAll,
    createBlock,
    updateBlock,
    deleteBlock,
    addSlot,
    updateSlot,
    deleteSlot,
    saveBlock,
    saveSettings,
  }
})
