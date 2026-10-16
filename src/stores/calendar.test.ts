import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useCalendarStore } from './calendar'
import { saveConfig } from '@/lib/db'
import { parseGcalVisibleCalendarsJson } from '@/schemas/calendar'
import { openUrl } from '@tauri-apps/plugin-opener'
import { invoke } from '@tauri-apps/api/core'

vi.stubEnv('VITE_GCAL_CLIENT_ID', 'test.apps.googleusercontent.com')
vi.stubEnv('VITE_GCAL_CLIENT_SECRET', 'test-secret')

const oauthHolder = vi.hoisted(() => ({
  cb: null as ((event: { payload: string }) => Promise<void>) | null,
  active: false,
}))
const mockFetch = vi.hoisted(() => vi.fn())
const dbStore = vi.hoisted(() => new Map<string, string | null>())

vi.mock('@/lib/db', () => ({
  saveConfig: vi.fn(async (key: string, value: string) => {
    dbStore.set(key, value)
  }),
  loadConfig: vi.fn(async (key: string) => {
    return dbStore.get(key) ?? null
  }),
  loadGcalVisibleCalendars: vi.fn(async () => {
    return parseGcalVisibleCalendarsJson(dbStore.get('gcal-visible-calendars') ?? null)
  }),
  saveGcalVisibleCalendars: vi.fn(async (prefs: { hiddenCalendarIds: string[] }) => {
    dbStore.set('gcal-visible-calendars', JSON.stringify(prefs))
  }),
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: mockFetch,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('http://127.0.0.1:45678/oauth-callback'),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_, cb) => {
    oauthHolder.active = true
    oauthHolder.cb = async (event) => {
      if (oauthHolder.active) await cb(event)
    }
    return Promise.resolve(
      vi.fn(() => {
        oauthHolder.active = false
      })
    )
  }),
}))

vi.stubGlobal('crypto', {
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) array[i] = i % 256
    return array
  },
  subtle: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
})

describe('useCalendarStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    oauthHolder.cb = null
    oauthHolder.active = false
    mockFetch.mockReset()
    dbStore.clear()
    vi.mocked(invoke).mockResolvedValue('http://127.0.0.1:45678/oauth-callback')
    vi.mocked(openUrl).mockResolvedValue(undefined)
  })

  it('initial state is disconnected', () => {
    const store = useCalendarStore()
    expect(store.connected).toBe(false)
    expect(store.events).toHaveLength(0)
    expect(store.syncing).toBe(false)
    expect(store.currentYear).toBe(new Date().getFullYear())
  })

  it('connect() opens browser consent URL', async () => {
    const store = useCalendarStore()
    await store.connect()
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('start_oauth_server')
    expect(store.oauthStatus).toBe('waiting')
    expect(oauthHolder.cb).toBeTruthy()
  })

  it('connect() throws if VITE_GCAL_CLIENT_ID is empty', async () => {
    vi.stubEnv('VITE_GCAL_CLIENT_ID', '')
    const store = useCalendarStore()
    await expect(store.connect()).rejects.toThrow('client ID not configured')
    vi.stubEnv('VITE_GCAL_CLIENT_ID', 'test.apps.googleusercontent.com')
    vi.stubEnv('VITE_GCAL_CLIENT_SECRET', 'test-secret')
  })

  it('callback exchanges encoded code and persists tokens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'at123',
        refresh_token: 'rt123',
        expires_in: 3600,
      }),
    })

    const store = useCalendarStore()
    await store.connect()

    const authUrl = vi.mocked(openUrl).mock.calls[0][0]
    const state = new URL(authUrl).searchParams.get('state')

    await oauthHolder.cb!({ payload: `/oauth-callback?code=abc%2F123&state=${state}` })

    expect(dbStore.get('gcal_access_token')).toBe('at123')
    expect(dbStore.get('gcal_refresh_token')).toBe('rt123')
    expect(store.connected).toBe(true)
    expect(store.oauthStatus).toBe('connected')
    expect(dbStore.get('gcal_pending_oauth')).toBe('')
  })

  it('continues receiving callbacks after the first store consumer unmounts', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'at123',
        refresh_token: 'rt123',
        expires_in: 3600,
      }),
    })

    let store: ReturnType<typeof useCalendarStore> | undefined
    const firstConsumer = defineComponent({
      setup() {
        store = useCalendarStore()
        return () => null
      },
    })
    const wrapper = mount(firstConsumer)

    await store!.connect()
    const authUrl = vi.mocked(openUrl).mock.calls[0][0]
    const state = new URL(authUrl).searchParams.get('state')!
    wrapper.unmount()

    await oauthHolder.cb!({ payload: `/oauth-callback?code=abc&state=${state}` })

    expect(store!.connected).toBe(true)
    expect(store!.oauthStatus).toBe('connected')
  })

  it('callback with Google error exposes a persistent connection error', async () => {
    const store = useCalendarStore()
    await store.connect()

    await oauthHolder.cb!({ payload: '/oauth-callback?error=access_denied&state=xyz' })
    expect(store.connected).toBe(false)
    expect(store.connectError).toContain('access_denied')
    expect(store.oauthStatus).toBe('idle')
  })

  it('rehydrates a pending callback after store reload', async () => {
    const first = useCalendarStore()
    await first.connect()
    const authUrl = vi.mocked(openUrl).mock.calls[0][0]
    const state = new URL(authUrl).searchParams.get('state')!
    const pending = JSON.parse(dbStore.get('gcal_pending_oauth')!)

    setActivePinia(createPinia())
    const second = useCalendarStore()
    await second.loadPersistedConfig()
    expect(second.oauthStatus).toBe('waiting')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'at-reloaded', refresh_token: 'rt-reloaded' }),
    })
    await oauthHolder.cb!({ payload: `/oauth-callback?code=abc&state=${state}` })
    expect(second.connected).toBe(true)
    expect(pending.redirectUri).toBe('http://127.0.0.1:45678/oauth-callback')
  })

  it('rejects mismatched and expired callbacks visibly', async () => {
    const store = useCalendarStore()
    await store.connect()
    await oauthHolder.cb!({ payload: '/oauth-callback?code=abc&state=wrong' })
    expect(store.connectError).toContain('state mismatch')
    expect(dbStore.get('gcal_pending_oauth')).toBe('')

    await store.connect()
    const pending = JSON.parse(dbStore.get('gcal_pending_oauth')!)
    dbStore.set(
      'gcal_pending_oauth',
      JSON.stringify({ ...pending, createdAt: Date.now() - 11 * 60 * 1000 })
    )
    await store.loadPersistedConfig()
    expect(store.connectError).toContain('expired')

    await store.connect()
    const expired = JSON.parse(dbStore.get('gcal_pending_oauth')!)
    dbStore.set(
      'gcal_pending_oauth',
      JSON.stringify({ ...expired, createdAt: Date.now() - 11 * 60 * 1000 })
    )
    await oauthHolder.cb!({ payload: `/oauth-callback?code=abc&state=${expired.state}` })
    expect(store.connectError).toContain('expired')
  })

  it('keeps connection and sync errors independent', async () => {
    const store = useCalendarStore()
    await store.connect()
    await oauthHolder.cb!({ payload: '/oauth-callback?error=access_denied' })
    expect(store.connectError).toBeTruthy()
    await store.syncYear()
    expect(store.connectError).toBeTruthy()
    expect(store.syncError).toBeNull()
  })

  it('reports callbacks without a pending authorization', async () => {
    const store = useCalendarStore()
    await oauthHolder.cb!({ payload: '/oauth-callback?code=abc&state=unknown' })
    expect(store.connectError).toContain('without a pending connection')
    expect(dbStore.get('gcal_pending_oauth')).toBe('')
  })

  it('reports token exchange failures as connection errors', async () => {
    const store = useCalendarStore()
    await store.connect()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error_description: 'invalid_grant' }),
    })
    const state = new URL(vi.mocked(openUrl).mock.calls[0][0]).searchParams.get('state')
    await oauthHolder.cb!({ payload: `/oauth-callback?code=abc&state=${state}` })
    expect(store.connectError).toContain('invalid_grant')
    expect(store.connected).toBe(false)
  })

  it('labels a client_secret rejection as a missing secret config', async () => {
    const store = useCalendarStore()
    await store.connect()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_request',
        error_description: 'client_secret is missing.',
      }),
    })
    const state = new URL(vi.mocked(openUrl).mock.calls[0][0]).searchParams.get('state')
    await oauthHolder.cb!({ payload: `/oauth-callback?code=abc&state=${state}` })
    expect(store.connectError).toContain('client_secret is missing')
    expect(store.connectError).toContain('VITE_GCAL_CLIENT_SECRET')
    expect(store.connected).toBe(false)
  })

  it('sends client_secret and code_verifier in the token exchange', async () => {
    const store = useCalendarStore()
    await store.connect()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'at123', refresh_token: 'rt123', expires_in: 3600 }),
    })
    const state = new URL(vi.mocked(openUrl).mock.calls[0][0]).searchParams.get('state')
    await oauthHolder.cb!({ payload: `/oauth-callback?code=abc&state=${state}` })

    const exchangeCall = mockFetch.mock.calls.find(
      ([url]) => url === 'https://oauth2.googleapis.com/token'
    )
    expect(exchangeCall).toBeTruthy()
    const body = new URLSearchParams(exchangeCall![1].body as string)
    expect(body.get('client_id')).toBe('test.apps.googleusercontent.com')
    expect(body.get('client_secret')).toBeTruthy()
    expect(body.get('code_verifier')).toBeTruthy()
    expect(body.get('grant_type')).toBe('authorization_code')
  })

  it('disconnect() clears tokens and state', async () => {
    dbStore.set('gcal_access_token', 'at_test')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    })

    const store = useCalendarStore()
    store.connected = true
    await store.disconnect()

    expect(store.connected).toBe(false)
    expect(store.events).toHaveLength(0)
    expect(dbStore.get('gcal_access_token')).toBe('')
  })

  it('goNextYear() and goPrevYear()', () => {
    const store = useCalendarStore()
    store.currentYear = 2026
    store.goNextYear()
    expect(store.currentYear).toBe(2027)
    store.goPrevYear()
    expect(store.currentYear).toBe(2026)
  })

  it('syncYear() fetches events for a year', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'at1',
          refresh_token: 'rt1',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 'primary', backgroundColor: '#7986cb' },
            { id: 'secondary', backgroundColor: '#33b679' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'e1',
              summary: 'Evento 1',
              start: { dateTime: '2026-01-15T10:00:00-03:00' },
              end: { dateTime: '2026-01-15T11:00:00-03:00' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'e2',
              summary: 'Evento 2',
              start: { date: '2026-02-01' },
              end: { date: '2026-02-02' },
              colorId: '1',
            },
          ],
        }),
      })

    const store = useCalendarStore()
    await store.connect()
    const authUrl = vi.mocked(openUrl).mock.calls[0][0]
    const state = new URL(authUrl).searchParams.get('state')
    await oauthHolder.cb!({ payload: `/oauth-callback?code=abc&state=${state}` })

    store.currentYear = 2026
    await store.syncYear(2026)

    expect(store.events).toHaveLength(2)
    expect(store.events[0].date).toBe('2026-01-15')
    expect(store.events[0].color).toBe('#7986cb')
    expect(store.eventsByDate.has('2026-01-15')).toBe(true)
    expect(store.eventsByDate.get('2026-02-01')?.[0].title).toBe('Evento 2')
    expect(store.syncing).toBe(false)
    expect(store.syncError).toBeNull()
  })

  it.each([429, 500])(
    'keeps the session connected when token refresh returns %s',
    async (status) => {
      const store = useCalendarStore()
      store.connected = true
      store.accessToken = 'expired-at'
      store.refreshToken = 'rt123'
      store.tokenExpiry = Date.now() - 1
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status,
        json: async () => ({ error: 'temporarily_unavailable' }),
      })

      await expect(store.syncYear(2026)).rejects.toThrow()

      expect(store.connected).toBe(true)
      expect(store.accessToken).toBe('expired-at')
      expect(store.refreshToken).toBe('rt123')
      expect(dbStore.get('gcal_refresh_token')).toBeUndefined()
      expect(store.syncError).toBeTruthy()
    }
  )

  it('keeps the session connected when the token refresh loses the network', async () => {
    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'expired-at'
    store.refreshToken = 'rt123'
    store.tokenExpiry = Date.now() - 1
    mockFetch.mockRejectedValueOnce(new TypeError('network unavailable'))

    await expect(store.syncYear(2026)).rejects.toThrow(/temporary/i)

    expect(store.connected).toBe(true)
    expect(store.refreshToken).toBe('rt123')
    expect(store.syncError).toMatch(/temporary/i)
  })

  it('clears the session and asks the user to reconnect for invalid_grant', async () => {
    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'expired-at'
    store.refreshToken = 'revoked-rt'
    store.tokenExpiry = Date.now() - 1
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'Token has been expired' }),
    })

    await expect(store.syncYear(2026)).rejects.toThrow(/reconnect/i)

    expect(store.connected).toBe(false)
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.connectError).toMatch(/reconnect/i)
    expect(store.syncError).toBeTruthy()
    expect(dbStore.get('gcal_refresh_token')).toBe('')
  })

  it('shares one token refresh between concurrent syncs and recovers after a transient failure', async () => {
    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'expired-at'
    store.refreshToken = 'rt123'
    store.tokenExpiry = Date.now() - 1

    let resolveRefresh!: (response: unknown) => void
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve
      })
    )
    const firstSync = store.syncYear(2026)
    const secondSync = store.syncYear(2027)
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    resolveRefresh({
      ok: false,
      status: 503,
      json: async () => ({ error: 'backendError' }),
    })
    await expect(firstSync).rejects.toThrow()
    await expect(secondSync).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(store.connected).toBe(true)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'fresh-at', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    })
    await store.syncYear(2026)

    expect(
      mockFetch.mock.calls.filter(([url]) => url === 'https://oauth2.googleapis.com/token')
    ).toHaveLength(2)
    expect(
      vi.mocked(saveConfig).mock.calls.filter(([key]) => key === 'gcal_access_token')
    ).toHaveLength(1)
    expect(dbStore.get('gcal_access_token')).toBe('fresh-at')
    expect(dbStore.get('gcal_token_expiry')).toBeTruthy()
    expect(store.syncError).toBeNull()
    expect(store.accessToken).toBe('fresh-at')
    expect(store.connected).toBe(true)

    store.tokenExpiry = Date.now() - 1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'fresh-at-2', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    })
    await store.syncYear(2026)
    expect(
      mockFetch.mock.calls.filter(([url]) => url === 'https://oauth2.googleapis.com/token')
    ).toHaveLength(3)
  })

  it('loadPersistedConfig restores tokens from DB', async () => {
    dbStore.set('gcal_access_token', 'restored_at')
    dbStore.set('gcal_refresh_token', 'restored_rt')
    dbStore.set('gcal_token_expiry', '9999999999999')

    const store = useCalendarStore()
    await store.loadPersistedConfig()

    expect(store.connected).toBe(true)
  })

  it('loadPersistedConfig without tokens leaves disconnected', async () => {
    const store = useCalendarStore()
    await store.loadPersistedConfig()
    expect(store.connected).toBe(false)
  })

  it('configReady resolves after restoring the persisted connection (cold start)', async () => {
    dbStore.set('gcal_access_token', 'restored_at')
    dbStore.set('gcal_refresh_token', 'restored_rt')
    dbStore.set('gcal_token_expiry', '9999999999999')

    const store = useCalendarStore()
    await store.configReady

    expect(store.connected).toBe(true)
  })

  it('syncYear() populates calendars ref', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'primary',
              summary: 'Calendario Principal',
              primary: true,
              backgroundColor: '#7986cb',
            },
            { id: 'work', summary: 'Trabajo', backgroundColor: '#33b679' },
          ],
        }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'

    await store.syncYear(2026)

    expect(store.calendars).toHaveLength(2)
    expect(store.calendars[0].summary).toBe('Calendario Principal')
    expect(store.calendars[1].id).toBe('work')
  })

  it('fetchCalendars() fetches the calendar list without fetching events', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'primary',
            summary: 'Calendario Principal',
            primary: true,
            backgroundColor: '#7986cb',
          },
          { id: 'work', summary: 'Trabajo', backgroundColor: '#33b679' },
        ],
      }),
    })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'

    const calendarColors = await store.fetchCalendars()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('calendarList'),
      expect.objectContaining({ headers: { Authorization: 'Bearer at123' } })
    )
    expect(store.calendars).toHaveLength(2)
    expect(store.calendars[0]).toMatchObject({
      id: 'primary',
      summary: 'Calendario Principal',
      primary: true,
    })
    expect(store.calendars[1].id).toBe('work')
    expect(calendarColors.get('primary')).toBe('#7986cb')
    expect(calendarColors.get('work')).toBe('#33b679')
  })

  it('fetchCalendars() throws when the calendar list request fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'

    await expect(store.fetchCalendars()).rejects.toThrow('Failed to fetch calendars')
    expect(store.calendars).toHaveLength(0)
  })

  it('fetchCalendars() refreshes once and retries the calendar list after a 401', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'fresh-at', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'primary', backgroundColor: '#7986cb' }] }),
      })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'expired-at'
    store.refreshToken = 'rt123'

    const calendarColors = await store.fetchCalendars()

    expect(store.accessToken).toBe('fresh-at')
    expect(store.calendars).toHaveLength(1)
    expect(calendarColors.get('primary')).toBe('#7986cb')
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('calendarList'),
      expect.objectContaining({ headers: { Authorization: 'Bearer fresh-at' } })
    )
  })

  it('keeps successful calendar events and reports calendars that fail', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 'primary' }, { id: 'work' }, { id: 'broken' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'event-primary',
              summary: 'Principal',
              start: { date: '2026-01-02' },
              end: { date: '2026-01-03' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'event-work',
              summary: 'Trabajo',
              start: { date: '2026-02-02' },
              end: { date: '2026-02-03' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'

    await store.syncYear(2026)

    expect(store.events).toHaveLength(2)
    expect(store.events[0].title).toBe('Principal')
    expect(store.events[1].title).toBe('Trabajo')
    expect(store.syncError).toBe('No se pudieron sincronizar 1 calendario')
  })

  it('refreshes once and retries the calendar list after a 401', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'fresh-at', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'expired-at'
    store.refreshToken = 'rt123'

    await store.syncYear(2026)

    expect(store.syncError).toBeNull()
    expect(store.accessToken).toBe('fresh-at')
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: 'Bearer fresh-at' } })
    )
  })

  it('reports a calendar network failure without dropping other events', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'primary' }, { id: 'offline' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'event-primary',
              summary: 'Principal',
              start: { date: '2026-01-02' },
              end: { date: '2026-01-03' },
            },
          ],
        }),
      })
      .mockRejectedValueOnce(new TypeError('network unavailable'))

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'

    await store.syncYear(2026)

    expect(store.events).toHaveLength(1)
    expect(store.syncError).toBe('No se pudieron sincronizar 1 calendario')
  })

  it('refreshes once and retries an event fetch after a 401', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'primary' }] }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'fresh-at', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'expired-at'
    store.refreshToken = 'rt123'

    await store.syncYear(2026)

    expect(store.syncError).toBeNull()
    expect(store.accessToken).toBe('fresh-at')
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('keeps a revoked session error visible when an event fetch gets a 401', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'primary' }] }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant' }),
      })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'expired-at'
    store.refreshToken = 'revoked-rt'

    await expect(store.syncYear(2026)).rejects.toThrow(/reconnect/i)
    expect(store.connected).toBe(false)
    expect(store.connectError).toMatch(/reconnect/i)
  })

  it('clears a partial sync error after a later successful sync', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'primary' }] }) })
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'
    await store.syncYear(2026)
    expect(store.syncError).toBeTruthy()

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'primary' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    await store.syncYear(2026)

    expect(store.syncError).toBeNull()
  })

  it('createEvent() performs POST request and updates store locally', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'new_evt_abc',
        summary: 'Nuevo Evento',
        description: 'Una descripción',
        start: { dateTime: '2026-07-22T10:00:00Z' },
        end: { dateTime: '2026-07-22T11:00:00Z' },
        colorId: '2',
      }),
    })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'
    store.events = []

    await store.createEvent('primary', {
      title: 'Nuevo Evento',
      description: 'Una descripción',
      start: '2026-07-22T10:00:00Z',
      end: '2026-07-22T11:00:00Z',
      colorId: '2',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer at123',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          summary: 'Nuevo Evento',
          description: 'Una descripción',
          colorId: '2',
          start: { dateTime: '2026-07-22T10:00:00Z' },
          end: { dateTime: '2026-07-22T11:00:00Z' },
        }),
      })
    )

    expect(store.events).toHaveLength(1)
    expect(store.events[0].id).toBe('new_evt_abc')
    expect(store.events[0].title).toBe('Nuevo Evento')
    expect(store.events[0].description).toBe('Una descripción')
    expect(store.events[0].color).toBe('#33b679') // colorId "2" resolves to #33b679
  })

  it('createEvent() de todo el día en Google envía fecha sin hora y fin exclusivo del día siguiente', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'new_allday',
        summary: 'Feriado',
        start: { date: '2026-07-22' },
        end: { date: '2026-07-23' },
        colorId: '2',
      }),
    })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'
    store.events = []

    // `end` llega con el mismo día: el store debe ignorarlo y derivar el
    // fin exclusivo por su cuenta.
    await store.createEvent('primary', {
      title: 'Feriado',
      start: '2026-07-22',
      end: '2026-07-22',
      allDay: true,
      colorId: '2',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer at123',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          summary: 'Feriado',
          colorId: '2',
          start: { date: '2026-07-22' },
          end: { date: '2026-07-23' },
        }),
      })
    )

    expect(store.events).toHaveLength(1)
    expect(store.events[0].date).toBe('2026-07-22')
    expect(store.events[0].start).toBe('2026-07-22')
    expect(store.events[0].end).toBe('2026-07-23')
  })

  it('createEvent() de todo el día en local guarda fechas sin hora y aparece solo en su día', async () => {
    const store = useCalendarStore()
    store.connected = false

    await store.createEvent('local', {
      title: 'Feriado local',
      start: '2026-07-22',
      end: '2026-07-22',
      allDay: true,
      colorId: '2',
    })

    expect(mockFetch).not.toHaveBeenCalled()

    const saved = JSON.parse(dbStore.get('local-calendar-events')!)
    expect(saved).toHaveLength(1)
    expect(saved[0].date).toBe('2026-07-22')
    expect(saved[0].start).toBe('2026-07-22')
    expect(saved[0].end).toBe('2026-07-23')

    expect(store.eventsByDate.get('2026-07-22')).toHaveLength(1)
    expect(store.eventsByDate.has('2026-07-23')).toBe(false)
  })

  it('updateEvent() performs PUT request and updates local store', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'evt_edit',
        summary: 'Evento Editado',
        description: 'Nueva desc',
        start: { dateTime: '2026-07-22T12:00:00Z' },
        end: { dateTime: '2026-07-22T13:00:00Z' },
        colorId: '3',
      }),
    })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'
    store.events = [
      {
        id: 'evt_edit',
        title: 'Evento Viejo',
        description: 'Desc vieja',
        start: '2026-07-22T12:00:00Z',
        end: '2026-07-22T13:00:00Z',
        color: '#7986cb',
        date: '2026-07-22',
        calendarId: 'primary',
      },
    ]

    await store.updateEvent('primary', 'evt_edit', {
      title: 'Evento Editado',
      description: 'Nueva desc',
      start: '2026-07-22T12:00:00Z',
      end: '2026-07-22T13:00:00Z',
      colorId: '3',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/evt_edit',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          summary: 'Evento Editado',
          description: 'Nueva desc',
          colorId: '3',
          start: { dateTime: '2026-07-22T12:00:00Z' },
          end: { dateTime: '2026-07-22T13:00:00Z' },
        }),
      })
    )

    expect(store.events).toHaveLength(1)
    expect(store.events[0].title).toBe('Evento Editado')
    expect(store.events[0].description).toBe('Nueva desc')
    expect(store.events[0].color).toBe('#8e24aa') // colorId "3" resolves to #8e24aa
  })

  it('updateEvent() de todo el día en Google mantiene la fecha sin hora y deriva el fin exclusivo', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'evt_allday',
        summary: 'Feriado movido',
        start: { date: '2026-08-01' },
        end: { date: '2026-08-02' },
      }),
    })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'
    store.events = [
      {
        id: 'evt_allday',
        title: 'Feriado',
        start: '2026-07-22',
        end: '2026-07-23',
        color: '#33b679',
        date: '2026-07-22',
        calendarId: 'primary',
      },
    ]

    // `end` llega con la misma fecha de inicio: el store debe ignorarlo.
    await store.updateEvent('primary', 'evt_allday', {
      title: 'Feriado movido',
      start: '2026-08-01',
      end: '2026-08-01',
      allDay: true,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/evt_allday',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          summary: 'Feriado movido',
          start: { date: '2026-08-01' },
          end: { date: '2026-08-02' },
        }),
      })
    )

    expect(store.events).toHaveLength(1)
    expect(store.events[0].start).toBe('2026-08-01')
    expect(store.events[0].end).toBe('2026-08-02')
    expect(store.events[0].date).toBe('2026-08-01')
  })

  it('updateEvent() de todo el día en local mantiene fechas sin hora al cambiar solo el título', async () => {
    const store = useCalendarStore()
    store.connected = false

    const initialEvent = {
      id: 'local_allday',
      title: 'Feriado local',
      start: '2026-07-22',
      end: '2026-07-23',
      color: '#33b679',
      date: '2026-07-22',
      calendarId: 'local',
    }
    dbStore.set('local-calendar-events', JSON.stringify([initialEvent]))
    await store.syncYear(2026)

    await store.updateEvent('local', 'local_allday', {
      title: 'Feriado local renombrado',
      start: '2026-07-22',
      end: '2026-07-22',
      allDay: true,
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(store.events).toHaveLength(1)
    expect(store.events[0].title).toBe('Feriado local renombrado')
    expect(store.events[0].date).toBe('2026-07-22')
    expect(store.events[0].start).toBe('2026-07-22')
    expect(store.events[0].end).toBe('2026-07-23')

    const saved = JSON.parse(dbStore.get('local-calendar-events')!)
    expect(saved[0].title).toBe('Feriado local renombrado')
    expect(saved[0].end).toBe('2026-07-23')
  })

  it('deleteEvent() performs DELETE request and removes event from store', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    })

    const store = useCalendarStore()
    store.connected = true
    store.accessToken = 'at123'
    store.events = [
      {
        id: 'evt_del',
        title: 'A borrar',
        start: '2026-07-22T12:00:00Z',
        end: '2026-07-22T13:00:00Z',
        color: '#7986cb',
        date: '2026-07-22',
        calendarId: 'primary',
      },
    ]

    await store.deleteEvent('primary', 'evt_del')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/evt_del',
      expect.objectContaining({
        method: 'DELETE',
      })
    )

    expect(store.events).toHaveLength(0)
  })

  it("supports local event creation when disconnected or using calendarId 'local'", async () => {
    const store = useCalendarStore()
    store.connected = false // Disconnected

    await store.createEvent('local', {
      title: 'Local Event 1',
      description: 'Local Desc',
      start: '2026-07-22T10:00:00Z',
      end: '2026-07-22T11:00:00Z',
      colorId: '2',
    })

    // Should not call Google Calendar API
    expect(mockFetch).not.toHaveBeenCalled()

    // Event should be added to store
    expect(store.events).toHaveLength(1)
    expect(store.events[0].title).toBe('Local Event 1')
    expect(store.events[0].calendarId).toBe('local')
    expect(store.events[0].color).toBe('#33b679') // colorId "2"

    // Check configuration was saved
    const saved = dbStore.get('local-calendar-events')
    expect(saved).toBeTruthy()
    expect(JSON.parse(saved!)).toHaveLength(1)
    expect(JSON.parse(saved!)[0].title).toBe('Local Event 1')
  })

  it('supports local event update', async () => {
    const store = useCalendarStore()
    store.connected = false

    // Seed a local event
    const initialEvent = {
      id: 'local_123',
      title: 'Local Event 1',
      description: 'Local Desc',
      start: '2026-07-22T10:00:00Z',
      end: '2026-07-22T11:00:00Z',
      color: '#33b679',
      date: '2026-07-22',
      calendarId: 'local',
    }
    dbStore.set('local-calendar-events', JSON.stringify([initialEvent]))
    await store.syncYear(2026)

    await store.updateEvent('local', 'local_123', {
      title: 'Local Event Updated',
      description: 'New Local Desc',
      start: '2026-07-22T12:00:00Z',
      end: '2026-07-22T13:00:00Z',
      colorId: '3',
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(store.events).toHaveLength(1)
    expect(store.events[0].title).toBe('Local Event Updated')
    expect(store.events[0].color).toBe('#8e24aa') // colorId "3"

    const saved = dbStore.get('local-calendar-events')
    expect(JSON.parse(saved!)[0].title).toBe('Local Event Updated')
  })

  it('supports local event deletion', async () => {
    const store = useCalendarStore()
    store.connected = false

    const initialEvent = {
      id: 'local_123',
      title: 'Local Event 1',
      color: '#33b679',
      date: '2026-07-22',
      calendarId: 'local',
      start: '2026-07-22T10:00:00Z',
      end: '2026-07-22T11:00:00Z',
    }
    dbStore.set('local-calendar-events', JSON.stringify([initialEvent]))
    await store.syncYear(2026)

    await store.deleteEvent('local', 'local_123')

    expect(mockFetch).not.toHaveBeenCalled()
    expect(store.events).toHaveLength(0)

    const saved = dbStore.get('local-calendar-events')
    expect(JSON.parse(saved!)).toHaveLength(0)
  })

  it('syncYear() loads local events when disconnected', async () => {
    const store = useCalendarStore()
    store.connected = false

    const initialEvent = {
      id: 'local_123',
      title: 'Local Event 1',
      color: '#33b679',
      date: '2026-07-22',
      calendarId: 'local',
      start: '2026-07-22T10:00:00Z',
      end: '2026-07-22T11:00:00Z',
    }
    dbStore.set('local-calendar-events', JSON.stringify([initialEvent]))

    await store.syncYear(2026)

    expect(mockFetch).not.toHaveBeenCalled()
    expect(store.events).toHaveLength(1)
    expect(store.events[0].title).toBe('Local Event 1')
  })

  describe('gcal calendar visibility', () => {
    function mockCalendarListAndEvents(options?: { primaryFails?: boolean }) {
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/users/me/calendarList')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 'primary',
                  summary: 'Principal',
                  primary: true,
                  backgroundColor: '#7986cb',
                },
                { id: 'work', summary: 'Trabajo', backgroundColor: '#33b679' },
              ],
            }),
          }
        }
        if (typeof url === 'string' && url.includes('/calendars/primary/events')) {
          if (options?.primaryFails) {
            return { ok: false, status: 500, json: async () => ({}) }
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 'e1',
                  summary: 'Evento 1',
                  start: { dateTime: '2026-01-15T10:00:00-03:00' },
                  end: { dateTime: '2026-01-15T11:00:00-03:00' },
                },
              ],
            }),
          }
        }
        if (typeof url === 'string' && url.includes('/calendars/work/events')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                {
                  id: 'e2',
                  summary: 'Evento work',
                  start: { date: '2026-02-01' },
                  end: { date: '2026-02-02' },
                },
              ],
            }),
          }
        }
        throw new Error(`unexpected fetch: ${url}`)
      })
    }

    function fetchedEventCalendarIds(): string[] {
      return mockFetch.mock.calls
        .map(([url]) => url as string)
        .filter((url) => url.includes('/events'))
        .map((url) => {
          const match = /\/calendars\/([^/]+)\/events/.exec(url)
          return match ? decodeURIComponent(match[1]) : ''
        })
    }

    function connectStore() {
      const store = useCalendarStore()
      store.connected = true
      store.accessToken = 'at123'
      return store
    }

    it('expone hiddenCalendarIds vacío por default (opt-out: nuevos visibles)', async () => {
      const store = useCalendarStore()
      await store.loadPersistedConfig()
      expect(store.hiddenCalendarIds.size).toBe(0)
      expect(store.isCalendarHidden('work')).toBe(false)
    })

    it('loadPersistedConfig restaura los ids ocultos persistidos', async () => {
      dbStore.set('gcal-visible-calendars', JSON.stringify({ hiddenCalendarIds: ['work'] }))
      const store = useCalendarStore()
      await store.loadPersistedConfig()
      expect(store.hiddenCalendarIds.has('work')).toBe(true)
      expect(store.isCalendarHidden('work')).toBe(true)
      expect(store.isCalendarHidden('primary')).toBe(false)
    })

    it('loadPersistedConfig con JSON corrupto deja todo visible', async () => {
      dbStore.set('gcal-visible-calendars', '{no-json')
      const store = useCalendarStore()
      await store.loadPersistedConfig()
      expect(store.hiddenCalendarIds.size).toBe(0)
    })

    it('syncYear() no fetchea eventos de calendarios ocultos pero conserva la metadata completa', async () => {
      dbStore.set('gcal-visible-calendars', JSON.stringify({ hiddenCalendarIds: ['work'] }))
      mockCalendarListAndEvents()
      const store = connectStore()
      await store.loadPersistedConfig()

      await store.syncYear(2026)

      expect(fetchedEventCalendarIds()).toEqual(['primary'])
      expect(store.calendars).toHaveLength(2)
      expect(store.calendars.map((c) => c.id).sort()).toEqual(['primary', 'work'])
      expect(store.events).toHaveLength(1)
      expect(store.events[0].calendarId).toBe('primary')
      expect(store.syncError).toBeNull()
    })

    it('los fallos de calendarios visibles cuentan en syncError sin fetchear los ocultos', async () => {
      dbStore.set('gcal-visible-calendars', JSON.stringify({ hiddenCalendarIds: ['work'] }))
      mockCalendarListAndEvents({ primaryFails: true })
      const store = connectStore()
      await store.loadPersistedConfig()

      await store.syncYear(2026)

      expect(fetchedEventCalendarIds()).toEqual(['primary'])
      expect(store.syncError).toContain('1 calendario')
    })

    it('un calendario oculto que fallaría no genera syncError porque ni se fetchea', async () => {
      dbStore.set('gcal-visible-calendars', JSON.stringify({ hiddenCalendarIds: ['work'] }))
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/users/me/calendarList')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                { id: 'primary', summary: 'Principal', backgroundColor: '#7986cb' },
                { id: 'work', summary: 'Trabajo', backgroundColor: '#33b679' },
              ],
            }),
          }
        }
        if (typeof url === 'string' && url.includes('/calendars/primary/events')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [] }),
          }
        }
        throw new Error(`unexpected fetch (oculto no debe fetchearse): ${url}`)
      })
      const store = connectStore()
      await store.loadPersistedConfig()

      await store.syncYear(2026)

      expect(fetchedEventCalendarIds()).toEqual(['primary'])
      expect(store.syncError).toBeNull()
    })

    it('con todos los calendarios ocultos no hay fetches de eventos ni error', async () => {
      dbStore.set(
        'gcal-visible-calendars',
        JSON.stringify({ hiddenCalendarIds: ['primary', 'work'] })
      )
      mockCalendarListAndEvents()
      const store = connectStore()
      await store.loadPersistedConfig()

      await store.syncYear(2026)

      expect(fetchedEventCalendarIds()).toEqual([])
      expect(store.syncError).toBeNull()
      expect(store.calendars).toHaveLength(2)
    })

    it('setCalendarHidden(true) persiste y re-sincroniza el año actual estando conectado', async () => {
      mockCalendarListAndEvents()
      const store = connectStore()
      await store.loadPersistedConfig()
      store.currentYear = 2026
      await store.syncYear(2026)
      expect(store.events).toHaveLength(2)
      mockFetch.mockClear()

      await store.setCalendarHidden('work', true)

      expect(store.isCalendarHidden('work')).toBe(true)
      expect(JSON.parse(dbStore.get('gcal-visible-calendars')!)).toEqual({
        hiddenCalendarIds: ['work'],
      })
      expect(fetchedEventCalendarIds()).toEqual(['primary'])
      expect(store.events).toHaveLength(1)
      expect(store.events[0].calendarId).toBe('primary')
    })

    it('setCalendarHidden(false) vuelve a mostrar sin re-sync cuando está desconectado', async () => {
      dbStore.set('gcal-visible-calendars', JSON.stringify({ hiddenCalendarIds: ['work'] }))
      const store = useCalendarStore()
      await store.loadPersistedConfig()
      expect(store.isCalendarHidden('work')).toBe(true)

      await store.setCalendarHidden('work', false)

      expect(store.isCalendarHidden('work')).toBe(false)
      expect(JSON.parse(dbStore.get('gcal-visible-calendars')!)).toEqual({
        hiddenCalendarIds: [],
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('la preferencia sobrevive a desconectar y reconectar', async () => {
      mockCalendarListAndEvents()
      const store = connectStore()
      await store.loadPersistedConfig()
      await store.setCalendarHidden('work', true)
      expect(store.isCalendarHidden('work')).toBe(true)

      await store.disconnect()

      expect(store.connected).toBe(false)
      expect(store.isCalendarHidden('work')).toBe(true)

      setActivePinia(createPinia())
      const second = useCalendarStore()
      await second.loadPersistedConfig()
      expect(second.hiddenCalendarIds.has('work')).toBe(true)
    })

    it('los eventos locales no se filtran aunque haya ocultos', async () => {
      dbStore.set('gcal-visible-calendars', JSON.stringify({ hiddenCalendarIds: ['work'] }))
      dbStore.set(
        'local-calendar-events',
        JSON.stringify([
          {
            id: 'local_1',
            title: 'Local',
            color: '#33b679',
            date: '2026-03-01',
            calendarId: 'local',
            start: '2026-03-01T10:00:00Z',
            end: '2026-03-01T11:00:00Z',
          },
        ])
      )
      mockCalendarListAndEvents()
      const store = connectStore()
      await store.loadPersistedConfig()

      await store.syncYear(2026)

      const local = store.events.filter((e) => e.calendarId === 'local')
      expect(local).toHaveLength(1)
      expect(store.events.map((e) => e.calendarId).sort()).toEqual(['local', 'primary'])
    })
  })
})
