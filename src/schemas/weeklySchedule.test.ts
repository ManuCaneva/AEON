import { describe, expect, it } from 'vitest'
import {
  BLOCK_COLOR_TOKENS,
  blockColorSchema,
  SaveScheduleSlotDraftSchema,
  SCHEDULE_VALIDATION_ERRORS,
  ScheduleBlockSchema,
  ScheduleSlotSchema,
  ScheduleBlockWithSlotsSchema,
  rowToScheduleBlock,
  scheduleBlockToRow,
  rowToScheduleSlot,
  scheduleSlotToRow,
  WeeklyScheduleSettingsSchema,
  DEFAULT_WEEKLY_SCHEDULE_SETTINGS,
} from './weeklySchedule'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'
const validIso = '2026-07-12T19:00:00.000Z'

describe('weeklySchedule schema tests', () => {
  describe('BLOCK_COLOR_TOKENS', () => {
    it('has valid color tokens', () => {
      expect(BLOCK_COLOR_TOKENS).toContain('lavender')
      expect(BLOCK_COLOR_TOKENS).toContain('green')
    })

    it('validates color schema', () => {
      expect(blockColorSchema.parse('lavender')).toBe('lavender')
      expect(() => blockColorSchema.parse('invalid-color')).toThrow()
    })
  })

  describe('ScheduleBlockSchema', () => {
    const validBlock = {
      id: validUuid,
      title: 'Gimnasio',
      color: 'lavender',
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
    }

    it('acepta un bloque válido', () => {
      expect(ScheduleBlockSchema.parse(validBlock)).toEqual(validBlock)
    })

    it('recorta espacios en el título', () => {
      const block = { ...validBlock, title: '  Gimnasio  ' }
      expect(ScheduleBlockSchema.parse(block).title).toBe('Gimnasio')
    })

    it('rechaza título vacío', () => {
      const block = { ...validBlock, title: '' }
      expect(() => ScheduleBlockSchema.parse(block)).toThrow()
    })
  })

  describe('ScheduleSlotSchema', () => {
    const validSlot = {
      id: validUuid,
      block_id: validUuid,
      day_of_week: 1, // Martes
      start_minutes: 360, // 06:00
      end_minutes: 420, // 07:00
      created_at: validIso,
      updated_at: validIso,
    }

    it('acepta un slot válido', () => {
      expect(ScheduleSlotSchema.parse(validSlot)).toEqual(validSlot)
    })

    it('rechaza día de semana fuera de rango', () => {
      const slot = { ...validSlot, day_of_week: 7 }
      expect(() => ScheduleSlotSchema.parse(slot)).toThrow()
    })

    it('rechaza start_minutes fuera de rango', () => {
      const slot = { ...validSlot, start_minutes: 1440 }
      expect(() => ScheduleSlotSchema.parse(slot)).toThrow()
    })

    it('rechaza end_minutes fuera de rango', () => {
      const slot = { ...validSlot, end_minutes: 1441 }
      expect(() => ScheduleSlotSchema.parse(slot)).toThrow()
    })

    it('rechaza si end_minutes <= start_minutes', () => {
      const slot = { ...validSlot, start_minutes: 420, end_minutes: 360 }
      expect(() => ScheduleSlotSchema.parse(slot)).toThrow()
    })
  })

  describe('ScheduleBlockWithSlotsSchema', () => {
    const validBlockWithSlots = {
      id: validUuid,
      title: 'Redes de datos',
      color: 'cyan',
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
      slots: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          block_id: validUuid,
          day_of_week: 1, // Martes
          start_minutes: 995, // 16:35
          end_minutes: 1230, // 20:30
          created_at: validIso,
          updated_at: validIso,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          block_id: validUuid,
          day_of_week: 3, // Jueves
          start_minutes: 1230, // 20:30
          end_minutes: 1365, // 22:45
          created_at: validIso,
          updated_at: validIso,
        },
      ],
    }

    it('acepta un bloque con múltiples slots', () => {
      expect(ScheduleBlockWithSlotsSchema.parse(validBlockWithSlots)).toEqual(validBlockWithSlots)
    })

    it('acepta un bloque sin slots', () => {
      const blockWithEmptySlots = { ...validBlockWithSlots, slots: [] }
      expect(ScheduleBlockWithSlotsSchema.parse(blockWithEmptySlots)).toEqual(blockWithEmptySlots)
    })

    it('rechaza si algún slot es inválido', () => {
      const blockWithInvalidSlot = {
        ...validBlockWithSlots,
        slots: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            block_id: validUuid,
            day_of_week: 7, // inválido
            start_minutes: 995,
            end_minutes: 1230,
            created_at: validIso,
            updated_at: validIso,
          },
        ],
      }
      expect(() => ScheduleBlockWithSlotsSchema.parse(blockWithInvalidSlot)).toThrow()
    })
  })

  describe('Mappers', () => {
    const validBlockRow = {
      id: validUuid,
      title: 'Gimnasio',
      color: 'lavender',
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
    }

    const validBlock = {
      id: validUuid,
      title: 'Gimnasio',
      color: 'lavender' as const,
      sort_order: 0,
      created_at: validIso,
      updated_at: validIso,
    }

    const validSlotRow = {
      id: validUuid,
      block_id: validUuid,
      day_of_week: 1,
      start_minutes: 360,
      end_minutes: 420,
      created_at: validIso,
      updated_at: validIso,
    }

    const validSlot = {
      id: validUuid,
      block_id: validUuid,
      day_of_week: 1,
      start_minutes: 360,
      end_minutes: 420,
      created_at: validIso,
      updated_at: validIso,
    }

    it('convierte fila de bloque a bloque de dominio', () => {
      expect(rowToScheduleBlock(validBlockRow)).toEqual(validBlock)
    })

    it('convierte bloque de dominio a fila', () => {
      expect(scheduleBlockToRow(validBlock)).toEqual(validBlockRow)
    })

    it('convierte fila de slot a slot de dominio', () => {
      expect(rowToScheduleSlot(validSlotRow)).toEqual(validSlot)
    })

    it('convierte slot de dominio a fila', () => {
      expect(scheduleSlotToRow(validSlot)).toEqual(validSlotRow)
    })

    it('rowToScheduleBlock normaliza colores legacy', () => {
      const legacyRow = { ...validBlockRow, color: 'primary' }
      expect(rowToScheduleBlock(legacyRow).color).toBe('lavender')
    })
  })

  describe('SaveScheduleSlotDraftSchema', () => {
    const validDraft = {
      day_of_week: 1,
      start_minutes: 360,
      end_minutes: 420,
    }

    it('acepta un draft de slot sin id', () => {
      expect(SaveScheduleSlotDraftSchema.parse(validDraft)).toEqual(validDraft)
    })

    it('acepta un draft de slot con id (edición)', () => {
      const withId = { ...validDraft, id: validUuid }
      expect(SaveScheduleSlotDraftSchema.parse(withId)).toEqual(withId)
    })

    it('rechaza end_minutes <= start_minutes', () => {
      expect(() =>
        SaveScheduleSlotDraftSchema.parse({ ...validDraft, start_minutes: 420, end_minutes: 360 })
      ).toThrow()
    })
  })

  describe('SCHEDULE_VALIDATION_ERRORS', () => {
    it('expone los mensajes humanos para mostrar en la UI', () => {
      expect(SCHEDULE_VALIDATION_ERRORS.titleRequired).toBe('El título es obligatorio')
      expect(SCHEDULE_VALIDATION_ERRORS.atLeastOneSlot).toBe('Agregá al menos un horario')
      expect(SCHEDULE_VALIDATION_ERRORS.endAfterStart).toBe(
        'La hora de fin debe ser mayor que la de inicio'
      )
    })
  })

  describe('WeeklyScheduleSettingsSchema', () => {
    it('tiene valores por defecto correctos', () => {
      expect(DEFAULT_WEEKLY_SCHEDULE_SETTINGS).toEqual({
        granularity_minutes: 30,
        week_starts_monday: true,
        enabled_days: [0, 1, 2, 3, 4, 5, 6],
        show_block_times: true,
      })
    })

    it('acepta settings válidos', () => {
      const customSettings = {
        granularity_minutes: 15,
        week_starts_monday: true,
        enabled_days: [0, 1, 2, 3, 4],
        show_block_times: true,
      }
      expect(WeeklyScheduleSettingsSchema.parse(customSettings)).toEqual(customSettings)
    })

    it('completa los días activos cuando faltan en settings antiguos', () => {
      expect(
        WeeklyScheduleSettingsSchema.parse({ granularity_minutes: 30, week_starts_monday: true })
      ).toEqual(DEFAULT_WEEKLY_SCHEDULE_SETTINGS)
    })

    it('rechaza días inválidos, repetidos o dejar todos desactivados', () => {
      expect(() => WeeklyScheduleSettingsSchema.parse({ enabled_days: [0, 7] })).toThrow()
      expect(() => WeeklyScheduleSettingsSchema.parse({ enabled_days: [0, 0] })).toThrow()
      expect(() => WeeklyScheduleSettingsSchema.parse({ enabled_days: [] })).toThrow()
    })

    it('rechaza granularidad inválida', () => {
      expect(() =>
        WeeklyScheduleSettingsSchema.parse({
          granularity_minutes: 20,
          week_starts_monday: true,
        })
      ).toThrow()
    })
  })
})
