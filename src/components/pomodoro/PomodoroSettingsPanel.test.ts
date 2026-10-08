import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PomodoroSettingsPanel from './PomodoroSettingsPanel.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

const mockPrepareAudio = vi.fn().mockResolvedValue(undefined)
const mockPlayTestSound = vi.fn(() => true)

vi.mock('@/stores/pomodoro', () => ({
  usePomodoroStore: () => ({
    prepareAudio: mockPrepareAudio,
    playTestSound: mockPlayTestSound,
  }),
}))

afterEach(() => {
  mockPrepareAudio.mockClear()
  mockPlayTestSound.mockClear()
  mockPlayTestSound.mockReturnValue(true)
})

const settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreak: true,
  autoStartFocus: false,
  volume: 1,
  muted: false,
}

describe('PomodoroSettingsPanel', () => {
  it('emits a patch when each duration and interval changes', async () => {
    const wrapper = mount(PomodoroSettingsPanel, { props: { settings } })
    const inputs = wrapper.findAll('input[type="number"]')

    await inputs[0].setValue('30')
    await inputs[1].setValue('10')
    await inputs[2].setValue('20')
    await inputs[3].setValue('6')

    expect(wrapper.emitted('update:settings')).toEqual([
      [{ focusMinutes: 30 }],
      [{ shortBreakMinutes: 10 }],
      [{ longBreakMinutes: 20 }],
      [{ longBreakInterval: 6 }],
    ])
  })

  it('emits both auto-start toggles and volume settings', async () => {
    const wrapper = mount(PomodoroSettingsPanel, { props: { settings } })

    await wrapper.get('[data-testid="setting-auto-start-break"] input').setValue(false)
    await wrapper.get('[data-testid="setting-auto-start-focus"] input').setValue(true)
    await wrapper.get('[data-testid="setting-volume"]').setValue('0.4')
    await wrapper.get('[data-testid="setting-mute"] input').setValue(true)

    expect(wrapper.emitted('update:settings')).toEqual([
      [{ autoStartBreak: false }],
      [{ autoStartFocus: true }],
      [{ volume: 0.4 }],
      [{ muted: true }],
    ])
  })

  it('does not emit invalid numeric settings', async () => {
    const wrapper = mount(PomodoroSettingsPanel, { props: { settings } })
    const inputs = wrapper.findAll('input[type="number"]')

    await inputs[0].setValue('0')
    await inputs[1].setValue('1.5')

    expect(wrapper.emitted('update:settings')).toBeUndefined()
  })

  it.each([true, false])(
    'plays a test sound on demand without rendering diagnostics (muted=%s)',
    async (muted) => {
      mockPlayTestSound.mockReturnValue(false)
      const wrapper = mount(PomodoroSettingsPanel, {
        props: { settings: { ...settings, muted } },
      })

      await wrapper.get('[data-testid="setting-test-sound"]').trigger('click')
      await new Promise((r) => setTimeout(r, 0))

      expect(mockPrepareAudio).toHaveBeenCalledOnce()
      expect(mockPlayTestSound).toHaveBeenCalledOnce()
      expect(wrapper.find('[data-testid="setting-test-sound-status"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Audio no disponible')
    }
  )

  it('no usa colores de paleta cruda de Tailwind', () => {
    const wrapper = mount(PomodoroSettingsPanel, { props: { settings } })
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })
})
