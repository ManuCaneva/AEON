import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWeeklyScheduleStore, minutesToHHMM, hhmmToMinutes, overlaps } from './weeklySchedule'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  listScheduleBlocks: vi.fn().mockResolvedValue([]),
  listScheduleSlots: vi.fn().mockResolvedValue([]),
  createScheduleBlock: vi.fn(),
  createScheduleSlot: vi.fn(),
  updateScheduleBlock: vi.fn(),
  updateScheduleSlot: vi.fn(),
  deleteScheduleBlock: vi.fn(),
  deleteScheduleSlot: vi.fn(),
  loadWeeklyScheduleSettings: vi.fn().mockResolvedValue({
    granularity_minutes: 30,
    week_starts_monday: true,
    enabled_days: [0, 1, 2, 3, 4, 5, 6],
  }),
  saveWeeklyScheduleSettings: vi.fn(),
}))

const validUuid = '550e8400-e29b-41d4-a716-446655440000'
const validIso = '2026-07-12T19:00:00.000Z'

describe('weeklySchedule store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('HH:MM y minutos conversions', () => {
    it('convierte minutos a string HH:MM', () => {
      expect(minutesToHHMM(0)).toBe('00:00')
      expect(minutesToHHMM(360)).toBe('06:00')
      expect(minutesToHHMM(1439)).toBe('23:59')
    })

    it('convierte string HH:MM a minutos', () => {
      expect(hhmmToMinutes('00:00')).toBe(0)
      expect(hhmmToMinutes('06:00')).toBe(360)
      expect(hhmmToMinutes('23:59')).toBe(1439)
    })

    it('lanza error con HH:MM inválidos', () => {
      expect(() => hhmmToMinutes('invalid')).toThrow()
      expect(() => hhmmToMinutes('25:00')).toThrow()
      expect(() => hhmmToMinutes('12:60')).toThrow()
    })
  })

  describe('overlaps', () => {
    it('detecta solapamientos', () => {
      expect(
        overlaps({ start_minutes: 360, end_minutes: 420 }, { start_minutes: 390, end_minutes: 450 })
      ).toBe(true)

      expect(
        overlaps({ start_minutes: 360, end_minutes: 420 }, { start_minutes: 420, end_minutes: 480 })
      ).toBe(false)

      expect(
        overlaps({ start_minutes: 360, end_minutes: 480 }, { start_minutes: 390, end_minutes: 420 })
      ).toBe(true)
    })
  })

  describe('validateSlot (destino de un arrastre)', () => {
    const gym = {
      id: '333e8400-e29b-41d4-a716-446655440000',
      title: 'Gimnasio',
      color: 'lavender' as const,
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      slots: [
        {
          id: '333e8400-e29b-41d4-a716-446655440001',
          block_id: '333e8400-e29b-41d4-a716-446655440000',
          day_of_week: 1,
          start_minutes: 960,
          end_minutes: 1020,
          created_at: validIso,
          updated_at: validIso,
        },
      ],
    }

    it('identifica el bloque que ocupa el destino', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [gym]

      const result = store.validateSlot({
        day_of_week: 1,
        start_minutes: 995,
        end_minutes: 1040,
      })

      expect(result).toEqual({
        ok: false,
        reason: 'overlapBlock',
        day: 1,
        start: 995,
        end: 1040,
        blockTitle: 'Gimnasio',
      })
    })

    it('no cuenta el propio slot que se mueve como choque', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [gym]

      const result = store.validateSlot(
        { day_of_week: 1, start_minutes: 995, end_minutes: 1040 },
        gym.slots[0].id
      )

      expect(result).toEqual({ ok: true })
    })

    it('acepta un destino libre', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [gym]

      expect(store.validateSlot({ day_of_week: 2, start_minutes: 995, end_minutes: 1040 })).toEqual(
        { ok: true }
      )
    })
  })

  describe('blockForSlot (bloque dueño de un horario)', () => {
    const slotId = '550e8400-e29b-41d4-a716-446655440001'
    const blockWithSlot = () => ({
      id: validUuid,
      title: 'Gimnasio',
      color: 'lavender' as const,
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      slots: [
        {
          id: slotId,
          block_id: validUuid,
          day_of_week: 1,
          start_minutes: 960,
          end_minutes: 1020,
          created_at: validIso,
          updated_at: validIso,
        },
      ],
    })

    it('devuelve el bloque que contiene la ocurrencia pedida', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [blockWithSlot()]

      expect(store.blockForSlot(slotId)?.id).toBe(validUuid)
    })

    it('devuelve null cuando la ocurrencia no existe', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [blockWithSlot()]

      expect(store.blockForSlot('550e8400-e29b-41d4-a716-4466554400ff')).toBeNull()
    })
  })

  describe('visibleWindow (Ventana visible auto-ajustable)', () => {
    const slot = (
      overrides: Partial<{ day_of_week: number; start_minutes: number; end_minutes: number }>,
      ids?: { slotId?: string; blockId?: string }
    ) => ({
      id: ids?.slotId ?? '550e8400-e29b-41d4-a716-446655440001',
      block_id: ids?.blockId ?? validUuid,
      day_of_week: overrides.day_of_week ?? 1,
      start_minutes: overrides.start_minutes ?? 950,
      end_minutes: overrides.end_minutes ?? 1085,
      created_at: validIso,
      updated_at: validIso,
    })
    const blockWith = (slots: ReturnType<typeof slot>[], blockId = validUuid) => ({
      id: blockId,
      title: 'Bloque',
      color: 'cyan' as const,
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      slots,
    })

    it('sin slots muestra el default 08:00–18:00', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = []
      expect(store.visibleWindow).toEqual({ start_minutes: 480, end_minutes: 1080 })
    })

    it('el default 08:00–18:00 no es un piso: con slots manda el rango real', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith([slot({ day_of_week: 2, start_minutes: 600, end_minutes: 660 })]),
      ]
      expect(store.visibleWindow).toEqual({ start_minutes: 600, end_minutes: 660 })
    })

    it('slot 15:50–18:05 → 15:00–19:00', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith([slot({ day_of_week: 1, start_minutes: 950, end_minutes: 1085 })]),
      ]
      expect(store.visibleWindow).toEqual({ start_minutes: 900, end_minutes: 1140 })
    })

    it('slot 18:10–20:25 → 18:00–21:00', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith([slot({ day_of_week: 3, start_minutes: 1090, end_minutes: 1225 })]),
      ]
      expect(store.visibleWindow).toEqual({ start_minutes: 1080, end_minutes: 1260 })
    })

    it('ambos en días distintos → 15:00–21:00', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith([slot({ day_of_week: 1, start_minutes: 950, end_minutes: 1085 })]),
        blockWith(
          [
            slot(
              { day_of_week: 3, start_minutes: 1090, end_minutes: 1225 },
              {
                slotId: '550e8400-e29b-41d4-a716-446655440002',
                blockId: '660e8400-e29b-41d4-a716-446655440000',
              }
            ),
          ],
          '660e8400-e29b-41d4-a716-446655440000'
        ),
      ]
      expect(store.visibleWindow).toEqual({ start_minutes: 900, end_minutes: 1260 })
    })

    it('slot exacto 15:00–16:00 → 15:00–16:00 (sin mínimo artificial)', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith([slot({ day_of_week: 2, start_minutes: 900, end_minutes: 960 })]),
      ]
      expect(store.visibleWindow).toEqual({ start_minutes: 900, end_minutes: 960 })
    })

    it('se expande al agregar un slot más temprano y uno más tardío', () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith([slot({ day_of_week: 1, start_minutes: 950, end_minutes: 1085 })]),
      ]
      expect(store.visibleWindow).toEqual({ start_minutes: 900, end_minutes: 1140 })

      store.blocksWithSlots = [
        blockWith([
          slot({ day_of_week: 1, start_minutes: 950, end_minutes: 1085 }),
          slot(
            { day_of_week: 2, start_minutes: 480, end_minutes: 540 },
            { slotId: '550e8400-e29b-41d4-a716-446655440002' }
          ),
          slot(
            { day_of_week: 4, start_minutes: 1320, end_minutes: 1390 },
            { slotId: '550e8400-e29b-41d4-a716-446655440003' }
          ),
        ]),
      ]
      expect(store.visibleWindow).toEqual({ start_minutes: 480, end_minutes: 1440 })
    })
  })

  describe('Días habilitados (enabled_days)', () => {
    const slot = (
      overrides: Partial<{ day_of_week: number; start_minutes: number; end_minutes: number }> = {},
      blockId = validUuid
    ) => ({
      id: '550e8400-e29b-41d4-a716-446655440001',
      block_id: blockId,
      day_of_week: overrides.day_of_week ?? 1,
      start_minutes: overrides.start_minutes ?? 950,
      end_minutes: overrides.end_minutes ?? 1085,
      created_at: validIso,
      updated_at: validIso,
    })
    const blockWith = (id: string, slots: ReturnType<typeof slot>[]) => ({
      id,
      title: 'Bloque',
      color: 'cyan' as const,
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      slots,
    })

    it('expone los días habilitados ordenados de menor a mayor', () => {
      const store = useWeeklyScheduleStore()
      store.settings = { ...store.settings, enabled_days: [5, 1, 3] }
      expect(store.enabledDays).toEqual([1, 3, 5])
    })

    it('isDayEnabled distingue días activos de inactivos', () => {
      const store = useWeeklyScheduleStore()
      store.settings = { ...store.settings, enabled_days: [1, 2] }
      expect(store.isDayEnabled(1)).toBe(true)
      expect(store.isDayEnabled(6)).toBe(false)
    })

    it('la ventana visible ignora los slots de días deshabilitados', () => {
      const store = useWeeklyScheduleStore()
      store.settings = { ...store.settings, enabled_days: [1] }
      store.blocksWithSlots = [
        blockWith(validUuid, [
          slot({ day_of_week: 1, start_minutes: 950, end_minutes: 1085 }, validUuid),
        ]),
        blockWith('660e8400-e29b-41d4-a716-446655440000', [
          slot(
            { day_of_week: 6, start_minutes: 480, end_minutes: 540 },
            '660e8400-e29b-41d4-a716-446655440000'
          ),
        ]),
      ]
      expect(store.visibleWindow).toEqual({ start_minutes: 900, end_minutes: 1140 })
    })

    it('saveBlock rechaza un slot en un día deshabilitado y no persiste', async () => {
      const store = useWeeklyScheduleStore()
      store.settings = { ...store.settings, enabled_days: [1] }

      await expect(
        store.saveBlock({
          title: 'Estudio',
          color: 'green',
          slots: [{ day_of_week: 3, start_minutes: 480, end_minutes: 540 }],
        })
      ).rejects.toThrow('desactivado')
      expect(db.createScheduleBlock).not.toHaveBeenCalled()
    })
  })

  describe('Lógica del Store', () => {
    it('carga bloques con sus slots', async () => {
      const store = useWeeklyScheduleStore()
      const mockBlockRow = {
        id: validUuid,
        title: 'Redes de datos',
        color: 'cyan',
        sort_order: 0,
        created_at: validIso,
        updated_at: validIso,
      }
      const mockSlotRows = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          block_id: validUuid,
          day_of_week: 1,
          start_minutes: 995,
          end_minutes: 1230,
          created_at: validIso,
          updated_at: validIso,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          block_id: validUuid,
          day_of_week: 3,
          start_minutes: 1230,
          end_minutes: 1365,
          created_at: validIso,
          updated_at: validIso,
        },
      ]
      vi.mocked(db.listScheduleBlocks).mockResolvedValue([mockBlockRow])
      vi.mocked(db.listScheduleSlots).mockResolvedValue(mockSlotRows)

      await store.loadAll()

      expect(store.blocksWithSlots).toHaveLength(1)
      expect(store.blocksWithSlots[0].title).toBe('Redes de datos')
      expect(store.blocksWithSlots[0].slots).toHaveLength(2)
      expect(store.blocksWithSlots[0].slots[0].day_of_week).toBe(1)
      expect(store.blocksWithSlots[0].slots[1].day_of_week).toBe(3)
      expect(store.settings.granularity_minutes).toBe(30)
    })

    it('crea un bloque con slots si no hay solapamiento', async () => {
      const store = useWeeklyScheduleStore()
      const mockBlockRow = {
        id: validUuid,
        title: 'Estudio',
        color: 'green',
        sort_order: 0,
        created_at: validIso,
        updated_at: validIso,
      }
      const mockSlotRow = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        block_id: validUuid,
        day_of_week: 1,
        start_minutes: 480,
        end_minutes: 540,
        created_at: validIso,
        updated_at: validIso,
      }
      vi.mocked(db.createScheduleBlock).mockResolvedValue(mockBlockRow)
      vi.mocked(db.createScheduleSlot).mockResolvedValue(mockSlotRow)

      const blockDraft = {
        title: 'Estudio',
        color: 'green' as const,
        sort_order: 0,
      }
      const slotsDraft = [{ day_of_week: 1, start_minutes: 480, end_minutes: 540 }]

      const block = await store.createBlock(blockDraft, slotsDraft)

      expect(block.id).toBe(validUuid)
      expect(block.title).toBe('Estudio')
      expect(block.slots).toHaveLength(1)
      expect(store.blocksWithSlots).toContainEqual(block)
      expect(db.createScheduleBlock).toHaveBeenCalledTimes(1)
      expect(db.createScheduleSlot).toHaveBeenCalledTimes(1)
    })

    it('rechaza la creación si un slot se solapa', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        {
          id: '333e8400-e29b-41d4-a716-446655440000',
          title: 'Gimnasio',
          color: 'lavender',
          sort_order: 0,
          created_at: validIso,
          updated_at: validIso,
          slots: [
            {
              id: '333e8400-e29b-41d4-a716-446655440001',
              block_id: '333e8400-e29b-41d4-a716-446655440000',
              day_of_week: 1,
              start_minutes: 480,
              end_minutes: 540,
              created_at: validIso,
              updated_at: validIso,
            },
          ],
        },
      ]

      const blockDraft = {
        title: 'Estudio',
        color: 'green' as const,
        sort_order: 0,
      }
      const slotsDraft = [{ day_of_week: 1, start_minutes: 500, end_minutes: 560 }]

      await expect(store.createBlock(blockDraft, slotsDraft)).rejects.toThrow('solapa')
      expect(db.createScheduleBlock).not.toHaveBeenCalled()
    })

    it('agrega un slot a un bloque existente', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        {
          id: validUuid,
          title: 'Gimnasio',
          color: 'lavender',
          sort_order: 0,
          created_at: validIso,
          updated_at: validIso,
          slots: [],
        },
      ]

      const mockSlotRow = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        block_id: validUuid,
        day_of_week: 2,
        start_minutes: 600,
        end_minutes: 660,
        created_at: validIso,
        updated_at: validIso,
      }
      vi.mocked(db.createScheduleSlot).mockResolvedValue(mockSlotRow)

      const slotDraft = { day_of_week: 2, start_minutes: 600, end_minutes: 660 }
      const slot = await store.addSlot(validUuid, slotDraft)

      expect(slot.day_of_week).toBe(2)
      expect(store.blocksWithSlots[0].slots).toHaveLength(1)
      expect(db.createScheduleSlot).toHaveBeenCalledTimes(1)
    })

    it('elimina un slot individual y conserva el bloque con sus otros horarios', async () => {
      const store = useWeeklyScheduleStore()
      const tuesdaySlotId = '550e8400-e29b-41d4-a716-446655440001'
      const thursdaySlotId = '550e8400-e29b-41d4-a716-446655440002'
      const slot = (id: string, day: number) => ({
        id,
        block_id: validUuid,
        day_of_week: day,
        start_minutes: 480,
        end_minutes: 540,
        created_at: validIso,
        updated_at: validIso,
      })
      store.blocksWithSlots = [
        {
          id: validUuid,
          title: 'Gimnasio',
          color: 'lavender',
          sort_order: 0,
          created_at: validIso,
          updated_at: validIso,
          slots: [slot(tuesdaySlotId, 1), slot(thursdaySlotId, 3)],
        },
      ]

      await store.deleteSlot(tuesdaySlotId)

      expect(store.blocksWithSlots).toHaveLength(1)
      expect(store.blocksWithSlots[0].slots.map((s) => s.id)).toEqual([thursdaySlotId])
      expect(db.deleteScheduleSlot).toHaveBeenCalledWith(tuesdaySlotId)
      expect(db.deleteScheduleBlock).not.toHaveBeenCalled()
    })

    it('borra el bloque en cascada cuando se elimina su último horario', async () => {
      const store = useWeeklyScheduleStore()
      const slotId = '550e8400-e29b-41d4-a716-446655440001'
      store.blocksWithSlots = [
        {
          id: validUuid,
          title: 'Gimnasio',
          color: 'lavender',
          sort_order: 0,
          created_at: validIso,
          updated_at: validIso,
          slots: [
            {
              id: slotId,
              block_id: validUuid,
              day_of_week: 1,
              start_minutes: 480,
              end_minutes: 540,
              created_at: validIso,
              updated_at: validIso,
            },
          ],
        },
      ]

      await store.deleteSlot(slotId)

      expect(store.blocksWithSlots).toHaveLength(0)
      expect(db.deleteScheduleSlot).toHaveBeenCalledWith(slotId)
      expect(db.deleteScheduleBlock).toHaveBeenCalledWith(validUuid)
    })

    it('elimina un bloque completo con todos sus slots', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        {
          id: validUuid,
          title: 'Gimnasio',
          color: 'lavender',
          sort_order: 0,
          created_at: validIso,
          updated_at: validIso,
          slots: [
            {
              id: '550e8400-e29b-41d4-a716-446655440001',
              block_id: validUuid,
              day_of_week: 1,
              start_minutes: 480,
              end_minutes: 540,
              created_at: validIso,
              updated_at: validIso,
            },
          ],
        },
      ]

      await store.deleteBlock(validUuid)

      expect(store.blocksWithSlots).toHaveLength(0)
      expect(db.deleteScheduleBlock).toHaveBeenCalledWith(validUuid)
    })
  })

  describe('renameOccurrence (renombrar una sola ocurrencia)', () => {
    const blockId = '333e8400-e29b-41d4-a716-446655440000'
    const tuesdaySlotId = '550e8400-e29b-41d4-a716-446655440001'
    const thursdaySlotId = '550e8400-e29b-41d4-a716-446655440002'
    const slot = (id: string, day: number) => ({
      id,
      block_id: blockId,
      day_of_week: day,
      start_minutes: 540,
      end_minutes: 570,
      created_at: validIso,
      updated_at: validIso,
    })
    const makeBlock = (slots = [slot(tuesdaySlotId, 1), slot(thursdaySlotId, 3)]) => ({
      id: blockId,
      title: 'Gimnasio',
      color: 'lavender' as const,
      sort_order: 2,
      created_at: validIso,
      updated_at: validIso,
      slots,
    })

    it('no hace nada si el nombre no cambió', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [makeBlock()]

      await store.renameOccurrence(tuesdaySlotId, '  Gimnasio  ')

      expect(db.updateScheduleBlock).not.toHaveBeenCalled()
      expect(db.createScheduleBlock).not.toHaveBeenCalled()
      expect(db.deleteScheduleSlot).not.toHaveBeenCalled()
      expect(store.blocksWithSlots).toHaveLength(1)
    })

    it('renombra el bloque entero cuando la ocurrencia es la única', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [makeBlock([slot(tuesdaySlotId, 1)])]
      vi.mocked(db.updateScheduleBlock).mockResolvedValue({
        id: blockId,
        title: 'Pesas',
        color: 'lavender',
        sort_order: 2,
        created_at: validIso,
        updated_at: validIso,
      })

      await store.renameOccurrence(tuesdaySlotId, 'Pesas')

      expect(db.updateScheduleBlock).toHaveBeenCalledWith(
        blockId,
        { title: 'Pesas' },
        expect.any(String)
      )
      expect(db.createScheduleBlock).not.toHaveBeenCalled()
      expect(db.deleteScheduleSlot).not.toHaveBeenCalled()
      expect(store.blocksWithSlots).toHaveLength(1)
      expect(store.blocksWithSlots[0].title).toBe('Pesas')
      expect(store.blocksWithSlots[0].slots[0].id).toBe(tuesdaySlotId)
    })

    it('separa la ocurrencia en un bloque nuevo con el mismo color cuando el bloque tiene más horarios', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [makeBlock()]
      vi.mocked(db.createScheduleBlock).mockImplementation(
        async (draft, id, created_at, updated_at) => ({
          id,
          title: draft.title,
          color: draft.color,
          sort_order: draft.sort_order,
          created_at,
          updated_at,
        })
      )
      vi.mocked(db.createScheduleSlot).mockImplementation(
        async (draft, id, newBlockId, created_at, updated_at) => ({
          id,
          block_id: newBlockId,
          day_of_week: draft.day_of_week,
          start_minutes: draft.start_minutes,
          end_minutes: draft.end_minutes,
          created_at,
          updated_at,
        })
      )

      await store.renameOccurrence(tuesdaySlotId, 'Pesas')

      expect(db.updateScheduleBlock).not.toHaveBeenCalled()
      expect(db.createScheduleBlock).toHaveBeenCalledWith(
        { title: 'Pesas', color: 'lavender', sort_order: 2 },
        expect.any(String),
        expect.any(String),
        expect.any(String)
      )
      const newBlockId = vi.mocked(db.createScheduleBlock).mock.calls[0][1]
      expect(db.createScheduleSlot).toHaveBeenCalledWith(
        { day_of_week: 1, start_minutes: 540, end_minutes: 570 },
        expect.any(String),
        newBlockId,
        expect.any(String),
        expect.any(String)
      )
      expect(db.deleteScheduleSlot).toHaveBeenCalledWith(tuesdaySlotId)

      expect(store.blocksWithSlots).toHaveLength(2)
      const original = store.blocksWithSlots.find((bw) => bw.id === blockId)!
      expect(original.title).toBe('Gimnasio')
      expect(original.slots.map((s) => s.id)).toEqual([thursdaySlotId])
      const split = store.blocksWithSlots.find((bw) => bw.id === newBlockId)!
      expect(split.title).toBe('Pesas')
      expect(split.color).toBe('lavender')
      expect(split.slots).toHaveLength(1)
      expect(split.slots[0]).toMatchObject({
        day_of_week: 1,
        start_minutes: 540,
        end_minutes: 570,
      })
    })

    it('usa "Sin título" cuando el nombre queda vacío', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [makeBlock([slot(tuesdaySlotId, 1)])]
      vi.mocked(db.updateScheduleBlock).mockResolvedValue({
        id: blockId,
        title: 'Sin título',
        color: 'lavender',
        sort_order: 2,
        created_at: validIso,
        updated_at: validIso,
      })

      await store.renameOccurrence(tuesdaySlotId, '   ')

      expect(db.updateScheduleBlock).toHaveBeenCalledWith(
        blockId,
        { title: 'Sin título' },
        expect.any(String)
      )
      expect(store.blocksWithSlots[0].title).toBe('Sin título')
    })

    it('lanza si la ocurrencia no existe', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [makeBlock()]

      await expect(
        store.renameOccurrence('550e8400-e29b-41d4-a716-4466554400ff', 'Pesas')
      ).rejects.toThrow('Slot no encontrado')
      expect(db.createScheduleBlock).not.toHaveBeenCalled()
      expect(db.deleteScheduleSlot).not.toHaveBeenCalled()
    })

    it('si falla la creación del slot nuevo, borra el bloque creado y deja intacto el original', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [makeBlock()]
      vi.mocked(db.createScheduleBlock).mockImplementation(
        async (draft, id, created_at, updated_at) => ({
          id,
          title: draft.title,
          color: draft.color,
          sort_order: draft.sort_order,
          created_at,
          updated_at,
        })
      )
      vi.mocked(db.createScheduleSlot).mockRejectedValue(new Error('db caída'))

      await expect(store.renameOccurrence(tuesdaySlotId, 'Pesas')).rejects.toThrow('db caída')

      const newBlockId = vi.mocked(db.createScheduleBlock).mock.calls[0][1]
      expect(db.deleteScheduleBlock).toHaveBeenCalledWith(newBlockId)
      expect(db.deleteScheduleSlot).not.toHaveBeenCalled()
      expect(store.blocksWithSlots).toHaveLength(1)
      expect(store.blocksWithSlots[0].title).toBe('Gimnasio')
      expect(store.blocksWithSlots[0].slots).toHaveLength(2)
    })
  })

  describe('saveBlock (Guardar único del modal)', () => {
    const blockId = '333e8400-e29b-41d4-a716-446655440000'
    const slotAId = '550e8400-e29b-41d4-a716-446655440001'
    const slotBId = '550e8400-e29b-41d4-a716-446655440002'

    const blockWith = (id: string, slots: any[], title = 'Redes de datos') => ({
      id,
      title,
      color: 'cyan' as const,
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      slots,
    })
    const slot = (id: string, block: string, day: number, start: number, end: number) => ({
      id,
      block_id: block,
      day_of_week: day,
      start_minutes: start,
      end_minutes: end,
      created_at: validIso,
      updated_at: validIso,
    })

    beforeEach(() => {
      vi.mocked(db.createScheduleBlock).mockImplementation(async (draft, id) => ({
        id,
        ...draft,
        created_at: validIso,
        updated_at: validIso,
      }))
      vi.mocked(db.createScheduleSlot).mockImplementation(async (draft, id, block) => ({
        id,
        block_id: block,
        ...draft,
        created_at: validIso,
        updated_at: validIso,
      }))
      vi.mocked(db.updateScheduleSlot).mockImplementation(async (id, patch) => ({
        id,
        block_id: blockId,
        day_of_week: patch.day_of_week ?? 1,
        start_minutes: patch.start_minutes ?? 480,
        end_minutes: patch.end_minutes ?? 540,
        created_at: validIso,
        updated_at: validIso,
      }))
    })

    it('en modo crear persiste UN bloque y todos los slots, en orden, exactamente una vez', async () => {
      const store = useWeeklyScheduleStore()

      await store.saveBlock({
        title: 'AACSW',
        color: 'cyan',
        slots: [
          { day_of_week: 1, start_minutes: 950, end_minutes: 1085 },
          { day_of_week: 3, start_minutes: 1090, end_minutes: 1225 },
        ],
      })

      expect(db.createScheduleBlock).toHaveBeenCalledTimes(1)
      expect(db.createScheduleSlot).toHaveBeenCalledTimes(2)
      const persistedBlockId = vi.mocked(db.createScheduleBlock).mock.calls[0][1]
      expect(db.createScheduleSlot).toHaveBeenNthCalledWith(
        1,
        { day_of_week: 1, start_minutes: 950, end_minutes: 1085 },
        expect.any(String),
        persistedBlockId,
        expect.any(String),
        expect.any(String)
      )
      expect(db.createScheduleSlot).toHaveBeenNthCalledWith(
        2,
        { day_of_week: 3, start_minutes: 1090, end_minutes: 1225 },
        expect.any(String),
        persistedBlockId,
        expect.any(String),
        expect.any(String)
      )
      expect(store.blocksWithSlots).toHaveLength(1)
      expect(store.blocksWithSlots[0].slots).toHaveLength(2)
      expect(store.blocksWithSlots[0].slots.map((s) => s.day_of_week)).toEqual([1, 3])
    })

    it('en modo edición solo crea/actualiza/elimina los slots del diff y deja el bloque consistente', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith(blockId, [
          slot(slotAId, blockId, 1, 950, 1085),
          slot(slotBId, blockId, 3, 1090, 1225),
        ]),
      ]

      // A queda igual, B se mueve a otro día/hora, y se agrega C nuevo.
      await store.saveBlock({
        blockId,
        title: 'Redes de datos',
        color: 'cyan',
        slots: [
          { id: slotAId, day_of_week: 1, start_minutes: 950, end_minutes: 1085 },
          { id: slotBId, day_of_week: 2, start_minutes: 480, end_minutes: 540 },
          { day_of_week: 4, start_minutes: 1090, end_minutes: 1225 },
        ],
      })

      expect(db.updateScheduleBlock).toHaveBeenCalledTimes(0)
      expect(db.createScheduleSlot).toHaveBeenCalledTimes(1)
      expect(db.updateScheduleSlot).toHaveBeenCalledTimes(1)
      expect(db.updateScheduleSlot).toHaveBeenCalledWith(
        slotBId,
        { day_of_week: 2, start_minutes: 480, end_minutes: 540 },
        expect.any(String)
      )
      expect(db.deleteScheduleSlot).not.toHaveBeenCalled()
      expect(store.blocksWithSlots[0].slots).toHaveLength(3)
      expect(store.blocksWithSlots[0].slots.map((s) => s.day_of_week).sort()).toEqual([1, 2, 4])
    })

    it('en modo edición elimina los slots ausentes del diff', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith(blockId, [
          slot(slotAId, blockId, 1, 950, 1085),
          slot(slotBId, blockId, 3, 1090, 1225),
        ]),
      ]

      await store.saveBlock({
        blockId,
        title: 'Redes de datos',
        color: 'cyan',
        slots: [{ id: slotAId, day_of_week: 1, start_minutes: 950, end_minutes: 1085 }],
      })

      expect(db.deleteScheduleSlot).toHaveBeenCalledWith(slotBId)
      expect(db.createScheduleSlot).not.toHaveBeenCalled()
      expect(db.updateScheduleSlot).not.toHaveBeenCalled()
      expect(store.blocksWithSlots[0].slots).toHaveLength(1)
    })

    it('actualiza el título/color del bloque editado si cambiaron', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith(blockId, [
          slot(slotAId, blockId, 1, 950, 1085),
          slot(slotBId, blockId, 3, 1090, 1225),
        ]),
      ]

      await store.saveBlock({
        blockId,
        title: 'Base de datos',
        color: 'green',
        slots: [
          { id: slotAId, day_of_week: 1, start_minutes: 950, end_minutes: 1085 },
          { id: slotBId, day_of_week: 3, start_minutes: 1090, end_minutes: 1225 },
        ],
      })

      expect(db.updateScheduleBlock).toHaveBeenCalledTimes(1)
      expect(db.updateScheduleBlock).toHaveBeenCalledWith(
        blockId,
        { title: 'Base de datos', color: 'green' },
        expect.any(String)
      )
      expect(store.blocksWithSlots[0].title).toBe('Base de datos')
    })

    it('rechaza Guardar sin horarios con mensaje humano y no persiste nada', async () => {
      const store = useWeeklyScheduleStore()

      await expect(store.saveBlock({ title: 'AACSW', color: 'cyan', slots: [] })).rejects.toThrow(
        'Agregá al menos un horario'
      )
      expect(db.createScheduleBlock).not.toHaveBeenCalled()
      expect(db.createScheduleSlot).not.toHaveBeenCalled()

      // También en edición: vaciar la lista no elimina los slots persistidos.
      store.blocksWithSlots = [blockWith(blockId, [slot(slotAId, blockId, 1, 950, 1085)])]
      await expect(
        store.saveBlock({ blockId, title: 'AACSW', color: 'cyan', slots: [] })
      ).rejects.toThrow('Agregá al menos un horario')
      expect(db.deleteScheduleSlot).not.toHaveBeenCalled()
    })

    it('rechaza Guardar con título vacío y no persiste nada', async () => {
      const store = useWeeklyScheduleStore()

      await expect(
        store.saveBlock({
          title: '   ',
          color: 'cyan',
          slots: [{ day_of_week: 1, start_minutes: 950, end_minutes: 1085 }],
        })
      ).rejects.toThrow('El título es obligatorio')
      expect(db.createScheduleBlock).not.toHaveBeenCalled()
    })

    it('rechaza Guardar si dos horarios del mismo bloque se superponen en el mismo día', async () => {
      const store = useWeeklyScheduleStore()

      await expect(
        store.saveBlock({
          title: 'AACSW',
          color: 'cyan',
          slots: [
            { day_of_week: 1, start_minutes: 950, end_minutes: 1085 },
            { day_of_week: 1, start_minutes: 1000, end_minutes: 1100 },
          ],
        })
      ).rejects.toThrow('superponen')
      expect(db.createScheduleBlock).not.toHaveBeenCalled()
    })

    it('rechaza Guardar si un horario se superpone con otro bloque ya existente', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        {
          id: blockId,
          title: 'Gimnasio',
          color: 'lavender',
          sort_order: 0,
          created_at: validIso,
          updated_at: validIso,
          slots: [slot(slotAId, blockId, 1, 950, 1085)],
        },
      ]

      await expect(
        store.saveBlock({
          title: 'Estudio',
          color: 'green',
          slots: [{ day_of_week: 1, start_minutes: 1000, end_minutes: 1100 }],
        })
      ).rejects.toThrow('superponen con «Gimnasio»')
      expect(db.createScheduleBlock).not.toHaveBeenCalled()
    })

    it('en modo edición, rechaza si el slot editado se superpone con otro bloque y lo nombra', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith(blockId, [
          slot(slotAId, blockId, 1, 950, 1085),
          slot(slotBId, blockId, 3, 1090, 1225),
        ]),
        {
          id: '999e8400-e29b-41d4-a716-446655440000',
          title: 'Gimnasio',
          color: 'lavender',
          sort_order: 0,
          created_at: validIso,
          updated_at: validIso,
          slots: [
            slot(
              '888e8400-e29b-41d4-a716-446655440001',
              '999e8400-e29b-41d4-a716-446655440000',
              3,
              1100,
              1200
            ),
          ],
        },
      ]

      // Muevo el slot B al jueves 18:20-20:25 → choca con Gimnasio (jueves 18:20-20:00)
      await expect(
        store.saveBlock({
          blockId,
          title: 'Redes de datos',
          color: 'cyan',
          slots: [
            { id: slotAId, day_of_week: 1, start_minutes: 950, end_minutes: 1085 },
            { id: slotBId, day_of_week: 3, start_minutes: 1100, end_minutes: 1225 },
          ],
        })
      ).rejects.toThrow('superponen con «Gimnasio»')
      expect(db.updateScheduleSlot).not.toHaveBeenCalled()
    })

    it('en modo edición, rechaza si el slot editado choca contra un slot propio sin tocar', async () => {
      const store = useWeeklyScheduleStore()
      store.blocksWithSlots = [
        blockWith(blockId, [
          slot(slotAId, blockId, 1, 950, 1085),
          slot(slotBId, blockId, 1, 1000, 1100), // choca con A si A se mueve encima
        ]),
      ]

      await expect(
        store.saveBlock({
          blockId,
          title: 'Redes de datos',
          color: 'cyan',
          slots: [
            { id: slotAId, day_of_week: 1, start_minutes: 1000, end_minutes: 1100 },
            { id: slotBId, day_of_week: 1, start_minutes: 950, end_minutes: 1085 },
          ],
        })
      ).rejects.toThrow('superponen')
      expect(db.updateScheduleSlot).not.toHaveBeenCalled()
    })
  })
})
