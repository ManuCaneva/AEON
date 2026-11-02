import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultPomodoroSettings } from '@/schemas/pomodoro'
import { POMODORO_SOUND_OPTIONS } from './pomodoroSoundCatalog'
import { createPomodoroSoundPlayer } from './pomodoroSounds'

type SourceMock = {
  buffer: AudioBuffer | null
  onended: (() => void) | null
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

function createAudioContextMock(initialState: AudioContextState = 'running', duration = 0.2) {
  const gains: Array<{
    connect: ReturnType<typeof vi.fn>
    gain: { setValueAtTime: ReturnType<typeof vi.fn> }
  }> = []
  const sources: SourceMock[] = []
  const decodedBuffers: AudioBuffer[] = []
  const context = {
    currentTime: 10,
    destination: {},
    state: initialState,
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    suspend: vi.fn(async () => {
      context.state = 'suspended'
    }),
    createGain: vi.fn(() => {
      const gain = {
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn() },
      }
      gains.push(gain)
      return gain
    }),
    createBufferSource: vi.fn(() => {
      const source: SourceMock = {
        buffer: null,
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      sources.push(source)
      return source
    }),
    decodeAudioData: vi.fn(async () => {
      const buffer = { duration } as AudioBuffer
      decodedBuffers.push(buffer)
      return buffer
    }),
  }

  return { context, gains, sources, decodedBuffers }
}

function installAudio(audio: ReturnType<typeof createAudioContextMock>) {
  const AudioContextMock = vi.fn(function () {
    return audio.context
  })
  vi.stubGlobal('AudioContext', AudioContextMock)
  return AudioContextMock
}

function installFetch(response: { ok: boolean; status?: number } = { ok: true }) {
  const fetchMock = vi.fn(async () => ({
    ...response,
    arrayBuffer: async () => new ArrayBuffer(8),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function settings(overrides: Partial<typeof defaultPomodoroSettings> = {}) {
  return { ...defaultPomodoroSettings, ...overrides }
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('pomodoro sound player', () => {
  it('precarga solo la alarma elegida dentro del gesto y la reproduce con el volumen configurado', async () => {
    const audio = createAudioContextMock('suspended')
    const AudioContextMock = installAudio(audio)
    const fetchMock = installFetch()
    const player = createPomodoroSoundPlayer()
    const bell = POMODORO_SOUND_OPTIONS.find(({ id }) => id === 'bell')!

    const prepared = await player.prepareFromUserGesture('bell')

    expect(prepared).toEqual({ available: true, state: 'running' })
    expect(AudioContextMock).toHaveBeenCalledOnce()
    expect(audio.context.resume).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(bell.src)
    expect(audio.context.decodeAudioData).toHaveBeenCalledOnce()
    expect(audio.sources).toHaveLength(0)

    const played = player.playFocusEndChime(settings({ volume: 0.4 }))

    expect(played).toBe(true)
    await flushMicrotasks()
    expect(audio.sources).toHaveLength(1)
    expect(audio.sources[0].buffer).toBe(audio.decodedBuffers[0])
    expect(audio.sources[0].connect).toHaveBeenCalledWith(audio.gains[0])
    expect(audio.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.4, 10)
    expect(audio.sources[0].start).toHaveBeenCalledOnce()
  })

  it('usa la misma alarma para fin de enfoque y fin de descanso, y no la descarga dos veces', async () => {
    const audio = createAudioContextMock()
    installAudio(audio)
    const fetchMock = installFetch()
    const player = createPomodoroSoundPlayer()

    await player.prepareFromUserGesture('happy-bells')
    player.playFocusEndChime(settings({ soundId: 'happy-bells' }))
    player.playBreakEndChime(settings({ soundId: 'happy-bells' }))
    await flushMicrotasks()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(audio.context.decodeAudioData).toHaveBeenCalledOnce()
    expect(audio.sources).toHaveLength(2)
    expect(audio.sources[0].buffer).toBe(audio.sources[1].buffer)
  })

  it('al cambiar de alarma descarta la anterior y carga únicamente la nueva', async () => {
    const audio = createAudioContextMock()
    installAudio(audio)
    const fetchMock = installFetch()
    const player = createPomodoroSoundPlayer()
    const bell = POMODORO_SOUND_OPTIONS.find(({ id }) => id === 'bell')!
    const urgent = POMODORO_SOUND_OPTIONS.find(({ id }) => id === 'urgent-tone')!

    await player.prepareFromUserGesture('bell')
    await player.prepareFromUserGesture('urgent-tone')

    expect(fetchMock).toHaveBeenNthCalledWith(1, bell.src)
    expect(fetchMock).toHaveBeenNthCalledWith(2, urgent.src)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('respeta silencio y volumen cero sin descargar ni crear fuentes', async () => {
    const audio = createAudioContextMock()
    installAudio(audio)
    const fetchMock = installFetch()
    const player = createPomodoroSoundPlayer()
    await player.prepareFromUserGesture('bell')
    fetchMock.mockClear()

    expect(player.playFocusEndChime(settings({ muted: true }))).toBe(false)
    expect(player.playBreakEndChime(settings({ volume: 0 }))).toBe(false)
    await flushMicrotasks()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(audio.context.createBufferSource).not.toHaveBeenCalled()
  })

  it('la prueba de sonido ignora el silencio pero sigue respetando el volumen', async () => {
    const audio = createAudioContextMock()
    installAudio(audio)
    installFetch()
    const player = createPomodoroSoundPlayer()
    await player.prepareFromUserGesture('interface-back')

    expect(
      player.playTestChime(settings({ soundId: 'interface-back', muted: true, volume: 0.6 }))
    ).toBe(true)
    expect(player.playTestChime(settings({ soundId: 'interface-back', volume: 0 }))).toBe(false)
    await flushMicrotasks()

    expect(audio.sources).toHaveLength(1)
  })

  it('no toca audio ni red hasta preparar el contexto con un gesto', () => {
    const AudioContextMock = vi.fn()
    vi.stubGlobal('AudioContext', AudioContextMock)
    const fetchMock = installFetch()
    const player = createPomodoroSoundPlayer()

    expect(player.playFocusEndChime(settings())).toBe(false)
    expect(AudioContextMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('precalienta el contexto sin descargar ninguna alarma', () => {
    const audio = createAudioContextMock()
    const AudioContextMock = installAudio(audio)
    const fetchMock = installFetch()
    const player = createPomodoroSoundPlayer()

    player.prewarm()

    expect(AudioContextMock).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(audio.context.resume).not.toHaveBeenCalled()
  })

  it('carga la alarma de forma perezosa si el contexto ya estaba preparado', async () => {
    const audio = createAudioContextMock()
    installAudio(audio)
    const fetchMock = installFetch()
    const player = createPomodoroSoundPlayer()
    await player.prepareFromUserGesture()

    player.playFocusEndChime(settings({ soundId: 'urgent-tone' }))
    await flushMicrotasks()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(audio.sources).toHaveLength(1)
  })

  it('se suspende solo cuando termina la reproducción', async () => {
    vi.useFakeTimers()
    const audio = createAudioContextMock('running', 0.2)
    installAudio(audio)
    installFetch()
    const player = createPomodoroSoundPlayer()
    await player.prepareFromUserGesture('bell')

    player.playFocusEndChime(settings())
    // 200 ms de audio + 250 ms de colchón + 700 ms de espera antes de dormir.
    await vi.advanceTimersByTimeAsync(1149)
    expect(audio.context.suspend).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(audio.context.suspend).toHaveBeenCalledOnce()
    expect(audio.context.state).toBe('suspended')
  })

  it('si el backend no soporta audio, falla en silencio y no descarga archivos', async () => {
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => {
        throw new Error('sin backend de audio')
      })
    )
    const fetchMock = installFetch()
    const player = createPomodoroSoundPlayer()

    expect(player.prewarm).not.toThrow()
    await expect(player.prepareFromUserGesture('bell')).resolves.toEqual({
      available: false,
      state: 'unavailable',
    })
    expect(player.playFocusEndChime(settings())).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('si el fetch falla, no reproduce y conserva el contexto sano', async () => {
    const audio = createAudioContextMock()
    installAudio(audio)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('asset missing')))
    const player = createPomodoroSoundPlayer()

    await expect(player.prepareFromUserGesture('bell')).resolves.toEqual({
      available: true,
      state: 'running',
    })
    expect(player.playFocusEndChime(settings())).toBe(true)
    await flushMicrotasks()

    expect(audio.sources).toHaveLength(0)
    expect(console.warn).toHaveBeenCalled()
  })

  it('si el archivo responde con error o el decode falla, no reproduce', async () => {
    const audio = createAudioContextMock()
    installAudio(audio)
    const fetchMock = installFetch({ ok: false, status: 404 })
    const player = createPomodoroSoundPlayer()
    await player.prepareFromUserGesture('bell')
    player.playFocusEndChime(settings())
    await flushMicrotasks()
    expect(audio.sources).toHaveLength(0)

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    audio.context.decodeAudioData.mockRejectedValue(new Error('wav inválido'))
    await player.prepareFromUserGesture('interface-back')
    player.playFocusEndChime(settings({ soundId: 'interface-back' }))
    await flushMicrotasks()
    expect(audio.sources).toHaveLength(0)
  })

  it('si el contexto no puede reanudarse, no programa la alarma', async () => {
    const audio = createAudioContextMock('suspended')
    audio.context.resume.mockRejectedValue(new Error('autoplay bloqueado'))
    installAudio(audio)
    installFetch()
    const player = createPomodoroSoundPlayer()

    await expect(player.prepareFromUserGesture('bell')).resolves.toEqual({
      available: true,
      state: 'suspended',
    })
    expect(player.playFocusEndChime(settings())).toBe(true)
    await flushMicrotasks()

    expect(audio.sources).toHaveLength(0)
  })
})
