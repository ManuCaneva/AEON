import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  defaultPomodoroSettings,
  PomodoroSyncPayloadSchema,
  type ActivePomodoroSession,
} from '@/schemas/pomodoro'
import * as db from '@/lib/db'
import { POMODORO_SESSION_KEY, usePomodoroStore } from './pomodoro'

vi.mock('@/lib/db', () => ({
  loadConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
}))

/**
 * Bus de eventos entre webviews: `emit` entrega el payload a todas las
 * suscripciones registradas, incluida la de la ventana emisora (como hace
 * Tauri), así las pruebas ejercitan el descarte del eco propio.
 */
const busEventos = vi.hoisted(() => {
  type Handler = (event: { payload: unknown }) => void
  const handlers: Handler[] = []
  function entregar(payload: unknown): void {
    queueMicrotask(() => {
      for (const handler of [...handlers]) handler({ payload })
    })
  }
  return {
    handlers,
    entregar,
    emit: vi.fn((_evento: string, payload?: unknown) => {
      entregar(payload)
      return Promise.resolve()
    }),
    listen: vi.fn((_evento: string, handler: Handler) => {
      handlers.push(handler)
      return Promise.resolve(() => {
        const index = handlers.indexOf(handler)
        if (index >= 0) handlers.splice(index, 1)
      })
    }),
    reiniciar() {
      handlers.length = 0
    },
  }
})

vi.mock('@tauri-apps/api/event', () => ({ emit: busEventos.emit, listen: busEventos.listen }))

const { prepareFromUserGesture, playFocusEndChime, playBreakEndChime, playTestChime } = vi.hoisted(
  () => ({
    prepareFromUserGesture: vi.fn().mockResolvedValue({ available: true, state: 'running' }),
    playFocusEndChime: vi.fn(() => true),
    playBreakEndChime: vi.fn(() => true),
    playTestChime: vi.fn(() => true),
  })
)

vi.mock('@/lib/pomodoroSounds', () => ({
  createPomodoroSoundPlayer: () => ({
    prepareFromUserGesture,
    playFocusEndChime,
    playBreakEndChime,
    playTestChime,
  }),
}))

/**
 * Ventanas de la app simuladas: `getCurrentWebviewWindow` dice desde qué
 * ventana se consulta y `getByLabel` qué ventanas hay (existentes y visibles),
 * que es todo lo que el dueño del pomodoro necesita saber.
 */
const ventanas = vi.hoisted(() => {
  type Presencia = 'abierta' | 'oculta'
  type Handler = (event: unknown) => unknown
  const estado = {
    etiquetaActual: 'main',
    presencia: { main: 'abierta' } as Record<string, Presencia>,
    consultaEnEspera: false,
  }
  const pendientes: Array<() => void> = []
  /** Handlers de cierre registrados por ventana: la X del usuario los dispara. */
  const cierres = new Map<string, Handler[]>()
  return {
    estado,
    pendientes,
    abrir(label: string): void {
      estado.presencia[label] = 'abierta'
    },
    cerrar(label: string): void {
      delete estado.presencia[label]
    },
    /** La X del usuario: la ventana se está cerrando pero todavía existe. */
    recibirLaX(label: string): void {
      for (const handler of cierres.get(label) ?? []) handler({ preventDefault: () => {} })
    },
    registrarCierre(handler: Handler): void {
      const etiqueta = estado.etiquetaActual
      cierres.set(etiqueta, [...(cierres.get(etiqueta) ?? []), handler])
    },
    reiniciar(): void {
      estado.etiquetaActual = 'main'
      estado.presencia = { main: 'abierta' }
      estado.consultaEnEspera = false
      pendientes.length = 0
      cierres.clear()
    },
    continuarConsultas(): void {
      estado.consultaEnEspera = false
      while (pendientes.length > 0) pendientes.shift()!()
    },
  }
})

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    label: ventanas.estado.etiquetaActual,
    onCloseRequested: (handler: (event: unknown) => unknown) => {
      ventanas.registrarCierre(handler)
      return Promise.resolve(() => {})
    },
  }),
  WebviewWindow: {
    getByLabel: (label: string) =>
      new Promise((resolve) => {
        const contestar = (): void => {
          const presencia = ventanas.estado.presencia[label]
          resolve(
            presencia === undefined
              ? null
              : { isVisible: () => Promise.resolve(presencia === 'abierta') }
          )
        }
        if (ventanas.estado.consultaEnEspera) ventanas.pendientes.push(contestar)
        else contestar()
      }),
  },
}))

const start = '2026-09-01T12:00:00.000Z'

function session(overrides: Partial<ActivePomodoroSession> = {}): ActivePomodoroSession {
  return {
    phase: 'focus',
    isRunning: false,
    endsAt: null,
    remainingMs: defaultPomodoroSettings.focusMinutes * 60_000,
    completedFocusSessions: 0,
    ...overrides,
  }
}

describe('pomodoro store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    prepareFromUserGesture.mockResolvedValue(undefined)
    vi.mocked(db.loadConfig).mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(start))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('arranca en reposo: sin sesión guardada el cronómetro no corre', async () => {
    const store = usePomodoroStore()
    await store.load()
    expect(store.session.isRunning).toBe(false)
    expect(store.session.endsAt).toBeNull()
    expect(store.session.phase).toBe('focus')
    expect(store.remainingMs).toBe(defaultPomodoroSettings.focusMinutes * 60_000)
  })

  it('starts, pauses, and resumes using timestamp-based remaining time', async () => {
    const store = usePomodoroStore()
    await store.load()

    await store.start()
    expect(store.session.isRunning).toBe(true)
    expect(store.session.endsAt).toBe('2026-09-01T12:25:00.000Z')

    vi.setSystemTime(new Date('2026-09-01T12:03:12.000Z'))
    await store.pause()
    expect(store.session).toMatchObject({
      isRunning: false,
      endsAt: null,
      remainingMs: 21 * 60_000 + 48_000,
    })

    vi.setSystemTime(new Date('2026-09-01T13:00:00.000Z'))
    await store.resume()
    expect(store.session.endsAt).toBe('2026-09-01T13:21:48.000Z')
  })

  it('skips without counting focus, reset returns to initial focus, and natural completion counts', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ autoStartBreak: false })
    await store.start()
    await store.skip()
    expect(store.session).toMatchObject({
      phase: 'shortBreak',
      completedFocusSessions: 0,
      isRunning: false,
    })

    await store.reset()
    expect(store.session).toEqual(session())

    await store.start()
    vi.setSystemTime(new Date('2026-09-01T12:25:00.000Z'))
    await store.advanceIfExpired()
    expect(store.session).toMatchObject({ phase: 'shortBreak', completedFocusSessions: 1 })
  })

  it('uses a long break at the configured interval and honors auto-start toggles', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ longBreakInterval: 1, autoStartBreak: true, autoStartFocus: true })
    await store.start()
    vi.setSystemTime(new Date('2026-09-01T12:25:00.000Z'))
    await store.advanceIfExpired()
    expect(store.session).toMatchObject({
      phase: 'longBreak',
      isRunning: true,
      completedFocusSessions: 1,
    })
    expect(store.session.endsAt).toBe('2026-09-01T12:40:00.000Z')

    vi.setSystemTime(new Date('2026-09-01T12:40:00.000Z'))
    await store.advanceIfExpired()
    expect(store.session).toMatchObject({ phase: 'focus', isRunning: true })
  })

  it('round-trips settings and an active session, resolving expired sessions on load', async () => {
    const saved = new Map<string, string>()
    vi.mocked(db.saveConfig).mockImplementation(async (key, value) => void saved.set(key, value))
    vi.mocked(db.loadConfig).mockImplementation(async (key) => saved.get(key) ?? null)
    const first = usePomodoroStore()
    await first.load()
    await first.saveSettings({ focusMinutes: 30, muted: true })
    await first.start()
    expect(saved.has('pomodoro-settings')).toBe(true)
    expect(saved.has('pomodoro-session')).toBe(true)

    vi.setSystemTime(new Date('2026-09-01T12:31:00.000Z'))
    setActivePinia(createPinia())
    const second = usePomodoroStore()
    await second.load()
    expect(second.settings.focusMinutes).toBe(30)
    expect(second.settings.muted).toBe(true)
    expect(second.session.phase).toBe('shortBreak')
    expect(second.session.completedFocusSessions).toBe(1)
  })

  it('plays chimes on natural completion, stays silent on skip, and playTestSound previews focus chime', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ autoStartBreak: false, autoStartFocus: false })

    expect(store.playTestSound()).toBe(true)
    expect(playTestChime).toHaveBeenCalledTimes(1)
    expect(playTestChime).toHaveBeenCalledWith(store.settings)
    expect(playFocusEndChime).not.toHaveBeenCalled()

    playTestChime.mockReturnValueOnce(false)
    expect(store.playTestSound()).toBe(false)

    await store.start()
    vi.setSystemTime(new Date('2026-09-01T12:25:00.000Z'))
    await store.advanceIfExpired()
    expect(playFocusEndChime).toHaveBeenCalledTimes(1)
    expect(playBreakEndChime).not.toHaveBeenCalled()

    await store.start()
    vi.setSystemTime(new Date('2026-09-01T12:30:00.000Z'))
    await store.advanceIfExpired()
    expect(playBreakEndChime).toHaveBeenCalledTimes(1)

    await store.reset()
    await store.start()
    await store.skip()
    expect(playFocusEndChime).toHaveBeenCalledTimes(1)
    expect(playBreakEndChime).toHaveBeenCalledTimes(1)
  })

  it('previews the focus chime through playTestSound even when muted', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ muted: true })

    expect(store.settings.muted).toBe(true)
    expect(store.playTestSound()).toBe(true)
    expect(playTestChime).toHaveBeenCalledTimes(1)
    expect(playTestChime).toHaveBeenCalledWith(store.settings)
    expect(playFocusEndChime).not.toHaveBeenCalled()
  })

  it('inicializa la sesión con la configuración vigente en el momento de crear el store', () => {
    const factoryFocusMinutes = defaultPomodoroSettings.focusMinutes
    defaultPomodoroSettings.focusMinutes = 35
    try {
      const store = usePomodoroStore()
      expect(store.session).toEqual({
        phase: 'focus',
        isRunning: false,
        endsAt: null,
        remainingMs: 35 * 60_000,
        completedFocusSessions: 0,
      })
      expect(store.remainingMs).toBe(35 * 60_000)
    } finally {
      defaultPomodoroSettings.focusMinutes = factoryFocusMinutes
    }
  })

  it('sin sesión persistida, la carga arma el cronómetro con la configuración guardada', async () => {
    vi.mocked(db.loadConfig).mockImplementation(async (key) =>
      key === 'pomodoro-settings' ? JSON.stringify({ focusMinutes: 35 }) : null
    )
    const store = usePomodoroStore()
    await store.load()

    expect(store.settings.focusMinutes).toBe(35)
    expect(store.session).toEqual({
      phase: 'focus',
      isRunning: false,
      endsAt: null,
      remainingMs: 35 * 60_000,
      completedFocusSessions: 0,
    })
    expect(store.remainingMs).toBe(35 * 60_000)
  })

  it('«Reiniciar» deja la duración de enfoque configurada, en reposo y en foco', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ focusMinutes: 35 })
    await store.start()
    expect(store.session.isRunning).toBe(true)

    await store.reset()

    expect(store.session).toEqual({
      phase: 'focus',
      isRunning: false,
      endsAt: null,
      remainingMs: 35 * 60_000,
      completedFocusSessions: 0,
    })
    expect(store.remainingMs).toBe(35 * 60_000)
  })

  it('«Reiniciar» desde una fase de descanso vuelve al enfoque con la duración configurada', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ focusMinutes: 35, autoStartBreak: false })
    await store.start()
    await store.skip()
    expect(store.session.phase).toBe('shortBreak')

    await store.reset()

    expect(store.session.phase).toBe('focus')
    expect(store.session.isRunning).toBe(false)
    expect(store.session.completedFocusSessions).toBe(0)
    expect(store.remainingMs).toBe(35 * 60_000)
  })

  it('el reloj reactivo baja segundo a segundo con el ticker y se congela al pausar', async () => {
    const store = usePomodoroStore()
    await store.load()
    store.startTicker()
    await store.start()

    const inicial = store.remainingMs
    expect(inicial).toBe(defaultPomodoroSettings.focusMinutes * 60_000)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(store.remainingMs).toBe(inicial - 1_000)

    await vi.advanceTimersByTimeAsync(3_000)
    expect(store.remainingMs).toBe(inicial - 4_000)

    await store.pause()
    const congelado = store.remainingMs
    expect(congelado).toBe(inicial - 4_000)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(store.remainingMs).toBe(congelado)

    await store.resume()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(store.remainingMs).toBe(congelado - 2_000)

    store.stopTicker()
  })

  it('el ticker cambia de fase en el instante en que expira, sin atrasar el aviso', async () => {
    const store = usePomodoroStore()
    await store.load()
    await store.saveSettings({ focusMinutes: 1, autoStartBreak: false })
    store.startTicker()
    await store.start()

    await vi.advanceTimersByTimeAsync(59_750)
    expect(store.session.phase).toBe('focus')
    expect(playFocusEndChime).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(250)
    expect(store.session.phase).toBe('shortBreak')
    expect(store.session.isRunning).toBe(false)
    expect(playFocusEndChime).toHaveBeenCalledOnce()

    store.stopTicker()
  })

  it('loads a still-running session and computes its current remaining time', async () => {
    vi.mocked(db.loadConfig).mockImplementation(async (key) =>
      key === 'pomodoro-session'
        ? JSON.stringify({
            ...session(),
            isRunning: true,
            endsAt: '2026-09-01T12:25:00.000Z',
            remainingMs: null,
          })
        : null
    )
    vi.setSystemTime(new Date('2026-09-01T12:03:12.000Z'))

    const store = usePomodoroStore()
    await store.load()

    expect(store.session.isRunning).toBe(true)
    expect(store.session.endsAt).toBe('2026-09-01T12:25:00.000Z')
    expect(store.remainingMs).toBe(21 * 60_000 + 48_000)
  })
})

type StorePomodoro = ReturnType<typeof usePomodoroStore>

/** Contrato del canal: nombre del evento con el que las ventanas se sincronizan. */
const EVENTO_SYNC = 'pomodoro-state-changed'

/** Espera a que el bus entregue los eventos ya emitidos a las suscripciones. */
async function entregarEventos(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
  await Promise.resolve()
}

describe('pomodoro: las mutaciones se publican a las demás ventanas', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    busEventos.reiniciar()
    vi.mocked(db.loadConfig).mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(start))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mutaciones: Array<{
    nombre: string
    preparar?: (store: StorePomodoro) => Promise<void>
    mutar: (store: StorePomodoro) => Promise<unknown> | unknown
  }> = [
    { nombre: 'iniciar', mutar: (store) => store.start() },
    { nombre: 'pausar', preparar: (store) => store.start(), mutar: (store) => store.pause() },
    {
      nombre: 'reanudar',
      preparar: async (store) => {
        await store.start()
        await store.pause()
      },
      mutar: (store) => store.resume(),
    },
    { nombre: 'saltear de fase', mutar: (store) => store.skip() },
    { nombre: 'reiniciar', preparar: (store) => store.start(), mutar: (store) => store.reset() },
    {
      nombre: 'cambiar la configuración',
      mutar: (store) => store.saveSettings({ focusMinutes: 30 }),
    },
    { nombre: 'reiniciar sin persistir', mutar: (store) => store.resetSession() },
    {
      nombre: 'expirar la fase',
      preparar: (store) => store.start(),
      mutar: async (store) => {
        vi.setSystemTime(new Date(store.session.endsAt ?? Date.now()))
        await store.advanceIfExpired()
      },
    },
  ]

  it.each(mutaciones.map((m) => [m.nombre, m] as const))(
    'la mutación «%s» emite el estado completo con su origen',
    async (_nombre, { preparar, mutar }) => {
      const store = usePomodoroStore()
      await store.load()
      if (preparar) await preparar(store)
      vi.mocked(busEventos.emit).mockClear()

      await mutar(store)
      await entregarEventos()

      expect(busEventos.emit).toHaveBeenCalledTimes(1)
      const [evento, payload] = vi.mocked(busEventos.emit).mock.calls[0]
      expect(evento).toBe(EVENTO_SYNC)
      const snapshot = PomodoroSyncPayloadSchema.parse(payload)
      expect(snapshot.session).toEqual(store.session)
      expect(snapshot.settings).toEqual(store.settings)
      expect(snapshot.origin).not.toBe('')
    }
  )
})

describe('pomodoro: las demás ventanas aplican los eventos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    busEventos.reiniciar()
    vi.mocked(db.loadConfig).mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(start))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Abre una ventana nueva: pinia propio, igual que una webview aparte. */
  async function abrirVentana(): Promise<StorePomodoro> {
    setActivePinia(createPinia())
    const store = usePomodoroStore()
    await store.load()
    return store
  }

  it('una mutación a distancia deja el mismo estado en la ventana remota', async () => {
    const escritorio = await abrirVentana()
    const mini = await abrirVentana()

    await escritorio.start()
    await entregarEventos()

    expect(mini.session).toEqual(escritorio.session)
    expect(mini.session.isRunning).toBe(true)
    expect(mini.remainingMs).toBe(escritorio.remainingMs)
  })

  it('solo la ventana que originó el cambio escribe la sesión en SQLite', async () => {
    const escritorio = await abrirVentana()
    const mini = await abrirVentana()

    await escritorio.start()
    await entregarEventos()

    expect(mini.session).toEqual(escritorio.session)
    expect(db.saveConfig).toHaveBeenCalledTimes(1)
    expect(db.saveConfig).toHaveBeenCalledWith(
      POMODORO_SESSION_KEY,
      JSON.stringify(escritorio.session)
    )
  })

  it('aplicar un evento remoto no re-emite ni re-persiste: sin eco', async () => {
    const escritorio = await abrirVentana()
    const mini = await abrirVentana()

    await escritorio.start()
    await entregarEventos()

    expect(mini.session).toEqual(escritorio.session)
    expect(busEventos.emit).toHaveBeenCalledTimes(1)
    expect(db.saveConfig).toHaveBeenCalledTimes(1)
  })

  it('la ventana emisora descarta su propio eco y aplica lo que llega de otras', async () => {
    const escritorio = await abrirVentana()
    await escritorio.start()
    await entregarEventos()
    const [, propio] = vi.mocked(busEventos.emit).mock.calls[0]
    const enCurso = { ...escritorio.session }
    const remoto = {
      origin: 'otra-ventana',
      settings: { ...defaultPomodoroSettings },
      session: session(),
    }

    busEventos.entregar({ ...remoto, origin: (propio as { origin: string }).origin })
    await entregarEventos()
    expect(escritorio.session).toEqual(enCurso)

    busEventos.entregar(remoto)
    await entregarEventos()
    expect(escritorio.session).toEqual(session())
  })

  it('una ventana que se abre en mitad de la fase muestra el tiempo derivado del fin absoluto', async () => {
    const faseMs = defaultPomodoroSettings.focusMinutes * 60_000
    const almacen = new Map<string, string>()
    vi.mocked(db.loadConfig).mockImplementation(async (key) => almacen.get(key) ?? null)
    vi.mocked(db.saveConfig).mockImplementation(async (key, value) => {
      almacen.set(key, value)
    })

    const escritorio = await abrirVentana()
    escritorio.startTicker()
    await escritorio.start()

    await vi.advanceTimersByTimeAsync(5_000)
    const mini = await abrirVentana()
    mini.startTicker()

    expect(mini.remainingMs).toBe(faseMs - 5_000)
    expect(mini.remainingMs).toBe(escritorio.remainingMs)

    await vi.advanceTimersByTimeAsync(10_000)
    await escritorio.pause()
    await entregarEventos()
    expect(mini.remainingMs).toBe(faseMs - 15_000)
    expect(mini.remainingMs).toBe(escritorio.remainingMs)

    await escritorio.resume()
    await entregarEventos()
    for (const lapso of [3_000, 7_000, 20_000]) {
      await vi.advanceTimersByTimeAsync(lapso)
      expect(mini.remainingMs).toBe(escritorio.remainingMs)
    }
    expect(mini.remainingMs).toBe(faseMs - 45_000)

    escritorio.stopTicker()
    mini.stopTicker()
  })

  it('la configuración se sincroniza por el mismo mecanismo', async () => {
    const escritorio = await abrirVentana()
    const mini = await abrirVentana()

    await escritorio.saveSettings({ focusMinutes: 30, muted: true, volume: 0.4 })
    await entregarEventos()

    expect(mini.settings).toEqual(escritorio.settings)
    expect(mini.settings.focusMinutes).toBe(30)
    expect(mini.settings.muted).toBe(true)
    expect(mini.settings.volume).toBe(0.4)
    expect(mini.session.remainingMs).toBe(30 * 60_000)
    expect(mini.remainingMs).toBe(escritorio.remainingMs)
    expect(db.saveConfig).toHaveBeenCalledTimes(2)
  })
})

describe('pomodoro: el aviso de fin de fase suena una sola vez', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    busEventos.reiniciar()
    ventanas.reiniciar()
    vi.mocked(db.loadConfig).mockResolvedValue(null)
    vi.mocked(db.saveConfig).mockResolvedValue(undefined)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(start))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Abre una ventana nueva: pinia propio, igual que una webview aparte. */
  async function abrirVentana(): Promise<StorePomodoro> {
    setActivePinia(createPinia())
    const store = usePomodoroStore()
    await store.load()
    return store
  }

  /** Pone la fase a punto de expirar y deja la cuenta de escrituras en cero. */
  async function expirarFase(store: StorePomodoro): Promise<void> {
    await store.start()
    await entregarEventos()
    vi.mocked(db.saveConfig).mockClear()
    vi.mocked(busEventos.emit).mockClear()
    vi.setSystemTime(new Date(store.session.endsAt ?? Date.now()))
  }

  it('con la mini abierta y la principal cerrada, el fin de fase suena en la mini', async () => {
    ventanas.cerrar('main')
    ventanas.abrir('pomodoro-mini')
    ventanas.estado.etiquetaActual = 'pomodoro-mini'
    const mini = await abrirVentana()
    await expirarFase(mini)

    await mini.advanceIfExpired()

    expect(playFocusEndChime).toHaveBeenCalledTimes(1)
    expect(playBreakEndChime).not.toHaveBeenCalled()
    expect(db.saveConfig).toHaveBeenCalledTimes(1)
    expect(mini.session).toMatchObject({ phase: 'shortBreak', completedFocusSessions: 1 })
  })

  it('con la principal y la mini abiertas, el fin de fase suena una sola vez y en la principal', async () => {
    ventanas.abrir('pomodoro-mini')
    ventanas.estado.etiquetaActual = 'main'
    const escritorio = await abrirVentana()
    ventanas.estado.etiquetaActual = 'pomodoro-mini'
    const mini = await abrirVentana()
    await expirarFase(escritorio)

    // La mini detecta la expiración primero: no suena, no escribe y no avanza.
    ventanas.estado.etiquetaActual = 'pomodoro-mini'
    await mini.advanceIfExpired()
    expect(playFocusEndChime).not.toHaveBeenCalled()
    expect(prepareFromUserGesture).not.toHaveBeenCalled()
    expect(db.saveConfig).not.toHaveBeenCalled()
    expect(mini.session).toMatchObject({ phase: 'focus', isRunning: true })

    // La principal es la dueña: suena y escribe una sola vez.
    ventanas.estado.etiquetaActual = 'main'
    await escritorio.advanceIfExpired()
    expect(playFocusEndChime).toHaveBeenCalledTimes(1)
    expect(db.saveConfig).toHaveBeenCalledTimes(1)

    await entregarEventos()
    expect(mini.session).toEqual(escritorio.session)
    expect(playFocusEndChime).toHaveBeenCalledTimes(1)
    expect(db.saveConfig).toHaveBeenCalledTimes(1)
  })

  it('el aviso se emite con la configuración de silencio y volumen vigente', async () => {
    ventanas.estado.etiquetaActual = 'main'
    const escritorio = await abrirVentana()
    await escritorio.saveSettings({ muted: true, volume: 0.3 })
    await expirarFase(escritorio)

    await escritorio.advanceIfExpired()

    expect(playFocusEndChime).toHaveBeenCalledTimes(1)
    expect(playFocusEndChime).toHaveBeenCalledWith(escritorio.settings)
    expect(escritorio.settings).toMatchObject({ muted: true, volume: 0.3 })
  })

  it('si el snapshot ajeno resolvió la expiración mientras se decidía la dueña, no se avanza de más', async () => {
    ventanas.cerrar('main')
    ventanas.abrir('pomodoro-mini')
    ventanas.estado.etiquetaActual = 'pomodoro-mini'
    const mini = await abrirVentana()
    await expirarFase(mini)

    // La consulta de si la principal existe queda en el aire...
    ventanas.estado.consultaEnEspera = true
    const resolucion = mini.advanceIfExpired()

    // ...y mientras tanto otra ventana ya resolvió el fin de fase.
    const yaResuelta: ActivePomodoroSession = {
      phase: 'shortBreak',
      isRunning: true,
      endsAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      remainingMs: null,
      completedFocusSessions: 1,
    }
    busEventos.entregar({
      origin: 'otra-ventana',
      settings: { ...defaultPomodoroSettings },
      session: yaResuelta,
    })
    await entregarEventos()
    ventanas.continuarConsultas()
    await resolucion

    expect(playFocusEndChime).not.toHaveBeenCalled()
    expect(db.saveConfig).not.toHaveBeenCalled()
    expect(mini.session).toEqual(yaResuelta)
  })

  it('la principal que se cierra en la expiración no suena: el fin de fase lo retoma la mini', async () => {
    ventanas.abrir('pomodoro-mini')
    ventanas.estado.etiquetaActual = 'main'
    const escritorio = await abrirVentana()
    ventanas.estado.etiquetaActual = 'pomodoro-mini'
    const mini = await abrirVentana()
    await expirarFase(escritorio)

    // La X de la principal llega justo en la expiración: se está cerrando.
    ventanas.recibirLaX('main')

    ventanas.estado.etiquetaActual = 'main'
    await escritorio.advanceIfExpired()
    expect(playFocusEndChime).not.toHaveBeenCalled()
    expect(db.saveConfig).not.toHaveBeenCalled()

    // La principal se destruye y la mini retoma el fin de fase: un solo aviso.
    ventanas.cerrar('main')
    ventanas.estado.etiquetaActual = 'pomodoro-mini'
    await mini.advanceIfExpired()
    expect(playFocusEndChime).toHaveBeenCalledTimes(1)
    expect(db.saveConfig).toHaveBeenCalledTimes(1)
    expect(mini.session).toMatchObject({ phase: 'shortBreak', completedFocusSessions: 1 })
  })

  it('el fin de fase se publica antes de sonar, para que la otra ventana ceda sin doble aviso', async () => {
    ventanas.estado.etiquetaActual = 'main'
    const escritorio = await abrirVentana()
    await expirarFase(escritorio)

    await escritorio.advanceIfExpired()

    const ordenPublicacion = vi.mocked(busEventos.emit).mock.invocationCallOrder[0]
    const ordenAviso = playFocusEndChime.mock.invocationCallOrder[0]
    expect(ordenPublicacion).toBeLessThan(ordenAviso)
  })
})
