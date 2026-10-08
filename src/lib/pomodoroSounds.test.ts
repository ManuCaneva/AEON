import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultPomodoroSettings } from '@/schemas/pomodoro'
import { createPomodoroSoundPlayer } from './pomodoroSounds'

type MockAudioNode = {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

function createAudioContextMock(initialState: AudioContextState = 'running') {
  const gain = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  }
  const oscillators: Array<
    MockAudioNode & {
      frequency: { setValueAtTime: ReturnType<typeof vi.fn> }
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
      type: string
    }
  > = []
  const context = {
    currentTime: 10,
    destination: {},
    state: initialState as AudioContextState,
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    suspend: vi.fn(async () => {
      context.state = 'suspended'
    }),
    createGain: vi.fn(() => gain),
    createOscillator: vi.fn(() => {
      const oscillator = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        frequency: { setValueAtTime: vi.fn() },
        start: vi.fn(),
        stop: vi.fn(),
        type: '',
      }
      oscillators.push(oscillator)
      return oscillator
    }),
  }

  return { context, gain, oscillators }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pomodoro sound player', () => {
  it('prepares audio on a user gesture and plays a focus chime with configured volume', async () => {
    const audio = createAudioContextMock('suspended')
    const AudioContextMock = vi.fn(function () {
      return audio.context
    })
    vi.stubGlobal('AudioContext', AudioContextMock)
    const player = createPomodoroSoundPlayer()

    await player.prepareFromUserGesture()
    player.playFocusEndChime({ ...defaultPomodoroSettings, volume: 0.4 })

    expect(AudioContextMock).toHaveBeenCalledOnce()
    expect(audio.context.resume).toHaveBeenCalledOnce()
    expect(audio.gain.gain.setValueAtTime).toHaveBeenCalledWith(0.4, 10)
    expect(audio.oscillators).toHaveLength(2)
    expect(audio.oscillators[0].start).toHaveBeenCalledWith(10)
    expect(audio.oscillators[0].stop).toHaveBeenCalledWith(10.45)
    expect(audio.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(880, 10)
    expect(audio.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(1174.66, 10.16)
  })

  it('uses a distinct break chime and does not play while muted', async () => {
    vi.useFakeTimers()
    const audio = createAudioContextMock('suspended')
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return audio.context
      })
    )
    const player = createPomodoroSoundPlayer()

    await player.prepareFromUserGesture()
    player.playBreakEndChime({ ...defaultPomodoroSettings, volume: 0.8 })
    player.playFocusEndChime({ ...defaultPomodoroSettings, muted: true })
    player.playBreakEndChime({ ...defaultPomodoroSettings, volume: 0 })

    expect(audio.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(523.25, 10)
    expect(audio.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(659.25, 10.16)
    expect(audio.oscillators).toHaveLength(2)

    // auto-suspend after the chime window
    await vi.advanceTimersByTimeAsync(1000)
    expect(audio.context.suspend).toHaveBeenCalled()
    expect(audio.context.state).toBe('suspended')
    vi.useRealTimers()
  })

  it('plays the test chime while muted but keeps regular chimes and zero volume silent', async () => {
    const audio = createAudioContextMock('running')
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return audio.context
      })
    )
    const player = createPomodoroSoundPlayer()
    await player.prepareFromUserGesture()

    // the mute toggle must not block the preview
    expect(player.playTestChime({ ...defaultPomodoroSettings, muted: true })).toBe(true)
    expect(audio.oscillators).toHaveLength(2)
    expect(audio.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(880, 10)
    expect(audio.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(1174.66, 10.16)

    // regular chimes still honor the mute toggle
    expect(player.playFocusEndChime({ ...defaultPomodoroSettings, muted: true })).toBe(false)

    // zero volume still silences the preview
    expect(player.playTestChime({ ...defaultPomodoroSettings, volume: 0 })).toBe(false)
    expect(audio.oscillators).toHaveLength(2)
  })

  it('suspends the context when preparation finds no chime scheduled', async () => {
    vi.useFakeTimers()
    const audio = createAudioContextMock('suspended')
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return audio.context
      })
    )
    const player = createPomodoroSoundPlayer()

    await player.prepareFromUserGesture()
    expect(audio.context.suspend).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)
    expect(audio.context.suspend).toHaveBeenCalledOnce()
    expect(audio.context.state).toBe('suspended')
    vi.useRealTimers()
  })

  it('does not create or play audio before preparation', () => {
    const AudioContextMock = vi.fn()
    vi.stubGlobal('AudioContext', AudioContextMock)
    const player = createPomodoroSoundPlayer()

    player.playFocusEndChime(defaultPomodoroSettings)

    expect(AudioContextMock).not.toHaveBeenCalled()
  })

  it('resolves safely when AudioContext construction throws (WebKitGTK backend unavailable)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const AudioContextMock = vi.fn(function () {
      throw new Error('WebKitGTK audio unavailable')
    })
    vi.stubGlobal('AudioContext', AudioContextMock)
    const player = createPomodoroSoundPlayer()

    await expect(player.prepareFromUserGesture()).resolves.toEqual({
      available: false,
      state: 'unavailable',
    })
    expect(AudioContextMock).toHaveBeenCalledOnce()

    // subsequent chime attempts degrade silently
    expect(() => player.playFocusEndChime(defaultPomodoroSettings)).not.toThrow()
    expect(() => player.playBreakEndChime(defaultPomodoroSettings)).not.toThrow()
    expect(player.playFocusEndChime(defaultPomodoroSettings)).toBe(false)

    warn.mockRestore()
  })

  it('reports availability state after preparation attempts', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const failing = vi.fn(function () {
      throw new Error('WebKitGTK audio unavailable')
    })
    vi.stubGlobal('AudioContext', failing)
    const player = createPomodoroSoundPlayer()
    expect(await player.prepareFromUserGesture()).toEqual({
      available: false,
      state: 'unavailable',
    })
    expect(warn).toHaveBeenCalledWith('[pomodoro] AudioContext unavailable:', expect.anything())

    const audio = createAudioContextMock()
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return audio.context
      })
    )
    expect(await player.prepareFromUserGesture()).toEqual({ available: true, state: 'running' })

    warn.mockRestore()
  })

  it('reports suspended state when resume fails and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const audio = createAudioContextMock('suspended')
    audio.context.resume = vi.fn(async () => {
      throw new Error('resume failed')
    })
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return audio.context
      })
    )
    const player = createPomodoroSoundPlayer()

    expect(await player.prepareFromUserGesture()).toEqual({ available: true, state: 'suspended' })
    expect(warn).toHaveBeenCalledWith('[pomodoro] AudioContext resume failed:', expect.anything())

    warn.mockRestore()
  })

  it('play methods return whether audio was actually scheduled', async () => {
    const audio = createAudioContextMock()
    audio.context.state = 'running'
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return audio.context
      })
    )
    const player = createPomodoroSoundPlayer()
    await player.prepareFromUserGesture()

    expect(player.playFocusEndChime(defaultPomodoroSettings)).toBe(true)
    expect(player.playBreakEndChime(defaultPomodoroSettings)).toBe(true)

    // not prepared → false
    const unprepared = createPomodoroSoundPlayer()
    expect(unprepared.playFocusEndChime(defaultPomodoroSettings)).toBe(false)

    // muted or zero volume → false
    expect(player.playFocusEndChime({ ...defaultPomodoroSettings, muted: true })).toBe(false)
    expect(player.playBreakEndChime({ ...defaultPomodoroSettings, volume: 0 })).toBe(false)
  })

  it('play resumes a suspended context and still schedules the chime', async () => {
    vi.useFakeTimers()
    const audio = createAudioContextMock('suspended')
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return audio.context
      })
    )
    const player = createPomodoroSoundPlayer()
    await player.prepareFromUserGesture()
    await vi.advanceTimersByTimeAsync(1000)
    expect(audio.context.state).toBe('suspended')

    expect(player.playFocusEndChime(defaultPomodoroSettings)).toBe(true)
    expect(audio.context.resume).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    expect(audio.oscillators).toHaveLength(2)

    // no double-suspend during the chime window; suspends again afterwards
    const suspendsAfterPlay = audio.context.suspend.mock.calls.length
    await vi.advanceTimersByTimeAsync(1000)
    expect(audio.context.suspend.mock.calls.length).toBe(suspendsAfterPlay + 1)
    vi.useRealTimers()
  })

  it('resolves safely when AudioContext resume rejects', async () => {
    const audio = createAudioContextMock('suspended')
    audio.context.resume = vi.fn(async () => {
      throw new Error('resume failed')
    })
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return audio.context
      })
    )
    const player = createPomodoroSoundPlayer()

    await expect(player.prepareFromUserGesture()).resolves.toEqual({
      available: true,
      state: 'suspended',
    })
    expect(audio.context.resume).toHaveBeenCalledOnce()

    // preparation failure must not break subsequent preparation or playback
    await expect(player.prepareFromUserGesture()).resolves.toEqual({
      available: true,
      state: 'suspended',
    })
    expect(() => player.playFocusEndChime(defaultPomodoroSettings)).not.toThrow()
    // resume rejected → context stays suspended → nothing scheduled
    expect(player.playFocusEndChime(defaultPomodoroSettings)).toBe(true)
    await new Promise((r) => setTimeout(r, 0))
    expect(audio.oscillators).toHaveLength(0)
  })
})
