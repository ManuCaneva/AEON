import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import {
  saveConfig,
  loadConfig,
  loadGcalVisibleCalendars,
  saveGcalVisibleCalendars,
} from '@/lib/db'
import {
  generatePkce,
  buildAuthUrl,
  parseOAuthCallbackQuery,
  buildTokenExchangePayload,
  buildRefreshPayload,
} from '@/lib/googleOauth'
import {
  buildEventsListUrl,
  buildCalendarListUrl,
  mapGcalEventsToDomain,
  mapCalendarListToColors,
} from '@/lib/googleCalendar'
import {
  GcalEventApiResponseSchema,
  type CalendarEvent,
  CALENDAR_COLORS,
  DEFAULT_EVENT_COLOR,
} from '@/schemas/calendar'
import { yearBounds } from '@/lib/calendarDates'
import { openUrl } from '@tauri-apps/plugin-opener'
import { fetch } from '@tauri-apps/plugin-http'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

const GCAL_ACCESS_TOKEN = 'gcal_access_token'
const GCAL_REFRESH_TOKEN = 'gcal_refresh_token'
const GCAL_TOKEN_EXPIRY = 'gcal_token_expiry'
const GCAL_PENDING_OAUTH = 'gcal_pending_oauth'
const OAUTH_PENDING_TTL = 10 * 60 * 1000

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const TOKEN_REFRESH_TIMEOUT = 15_000
const SCOPES = 'https://www.googleapis.com/auth/calendar'

function debugLog(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.debug('[gcal]', ...args)
  }
}

type PendingOAuth = { verifier: string; state: string; redirectUri: string; createdAt: number }

export const useCalendarStore = defineStore('calendar', () => {
  const connected = ref(false)
  const currentYear = ref(new Date().getFullYear())
  const syncing = ref(false)
  const syncError = ref<string | null>(null)
  const connectError = ref<string | null>(null)
  const oauthStatus = ref<'idle' | 'waiting' | 'connected'>('idle')
  const pendingOAuth = ref<PendingOAuth | null>(null)
  let pendingExpiryTimer: ReturnType<typeof setTimeout> | null = null
  const events = ref<CalendarEvent[]>([])
  const localEvents = ref<CalendarEvent[]>([])
  const calendars = ref<
    { id: string; summary: string; primary?: boolean; backgroundColor?: string }[]
  >([])

  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const tokenExpiry = ref<number | null>(null)
  let refreshPromise: Promise<void> | null = null

  // Visibilidad de calendarios: opt-out (nuevos visibles por default).
  // El set vive en memoria y persiste en config bajo 'gcal-visible-calendars'.
  const hiddenCalendarIds = ref<ReadonlySet<string>>(new Set<string>())

  function isCalendarHidden(calendarId: string): boolean {
    return hiddenCalendarIds.value.has(calendarId)
  }

  async function setCalendarHidden(calendarId: string, hidden: boolean): Promise<void> {
    const next = new Set(hiddenCalendarIds.value)
    if (hidden) {
      next.add(calendarId)
    } else {
      next.delete(calendarId)
    }
    hiddenCalendarIds.value = next
    await saveGcalVisibleCalendars({ hiddenCalendarIds: [...next] })
    if (connected.value) {
      await syncYear(currentYear.value)
    }
  }

  const eventsByDate = computed(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events.value) {
      if (!map.has(event.date)) map.set(event.date, [])
      map.get(event.date)!.push(event)
    }
    return map
  })

  function getClientId(): string {
    return import.meta.env.VITE_GCAL_CLIENT_ID ?? ''
  }

  function getClientSecret(): string {
    return import.meta.env.VITE_GCAL_CLIENT_SECRET ?? ''
  }

  async function ensureAccessToken(): Promise<string> {
    if (!accessToken.value) throw new Error('Not connected')
    if (tokenExpiry.value && Date.now() >= tokenExpiry.value) {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      await refreshPromise
    }
    return accessToken.value!
  }

  async function refreshAccessToken(): Promise<void> {
    if (!refreshToken.value) {
      connected.value = false
      await clearTokens()
      throw new Error('Session expired. Please reconnect.')
    }
    const clientId = getClientId()
    const body = buildRefreshPayload({
      refreshToken: refreshToken.value,
      clientId,
      clientSecret: getClientSecret(),
    })
    let res: Response
    let data: {
      access_token?: string
      expires_in?: number
      error?: string
      error_description?: string
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TOKEN_REFRESH_TIMEOUT)
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: controller.signal,
      })
      data = await res.json()
    } catch {
      throw new Error('Temporary Google Calendar sync error. Please try again.')
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) {
      if (data.error === 'invalid_grant') {
        await clearTokens()
        connected.value = false
        connectError.value = 'Google Calendar session expired. Please reconnect.'
        throw new Error(connectError.value)
      }
      throw new Error('Temporary Google Calendar sync error. Please try again.')
    }
    if (!data.access_token)
      throw new Error('Temporary Google Calendar sync error. Please try again.')
    accessToken.value = data.access_token
    tokenExpiry.value = Date.now() + (data.expires_in ?? 3600) * 1000
    await persistTokens()
  }

  async function persistTokens(): Promise<void> {
    await Promise.all([
      saveConfig(GCAL_ACCESS_TOKEN, accessToken.value ?? ''),
      saveConfig(GCAL_REFRESH_TOKEN, refreshToken.value ?? ''),
      saveConfig(GCAL_TOKEN_EXPIRY, String(tokenExpiry.value ?? '')),
    ])
  }

  async function clearTokens(): Promise<void> {
    accessToken.value = null
    refreshToken.value = null
    tokenExpiry.value = null
    await Promise.all([
      saveConfig(GCAL_ACCESS_TOKEN, ''),
      saveConfig(GCAL_REFRESH_TOKEN, ''),
      saveConfig(GCAL_TOKEN_EXPIRY, ''),
    ])
  }

  async function clearPendingOAuth(): Promise<void> {
    if (pendingExpiryTimer) {
      clearTimeout(pendingExpiryTimer)
      pendingExpiryTimer = null
    }
    pendingOAuth.value = null
    await saveConfig(GCAL_PENDING_OAUTH, '')
  }

  async function loadPendingOAuth(): Promise<PendingOAuth | null> {
    const raw = await loadConfig(GCAL_PENDING_OAUTH)
    if (!raw) {
      pendingOAuth.value = null
      return null
    }
    try {
      const pending = JSON.parse(raw) as PendingOAuth
      if (
        typeof pending.verifier !== 'string' ||
        typeof pending.state !== 'string' ||
        typeof pending.redirectUri !== 'string' ||
        typeof pending.createdAt !== 'number'
      ) {
        await clearPendingOAuth()
        return null
      }
      pendingOAuth.value = pending
      return pending
    } catch {
      await clearPendingOAuth()
      return null
    }
  }

  async function connect(): Promise<void> {
    const clientId = getClientId()
    if (!clientId) {
      connectError.value = 'Google Calendar client ID not configured'
      throw new Error(connectError.value)
    }
    connectError.value = null
    const { verifier, challenge } = await generatePkce()
    const state = verifier.slice(0, 16)
    try {
      const redirectUri = await invoke<string>('start_oauth_server')
      pendingOAuth.value = { verifier, state, redirectUri, createdAt: Date.now() }
      await saveConfig(GCAL_PENDING_OAUTH, JSON.stringify(pendingOAuth.value))
      oauthStatus.value = 'waiting'
      pendingExpiryTimer = setTimeout(() => {
        void clearPendingOAuth().then(() => {
          if (!connected.value) oauthStatus.value = 'idle'
          connectError.value = 'OAuth authorization expired. Please reconnect.'
        })
      }, OAUTH_PENDING_TTL)

      const authUrl = buildAuthUrl({
        clientId,
        redirectUri,
        scope: SCOPES,
        state,
        codeChallenge: challenge,
      })
      debugLog('connect', { clientId, redirectUri, authUrl })
      await openUrl(authUrl)
    } catch (error) {
      await clearPendingOAuth()
      oauthStatus.value = 'idle'
      connectError.value =
        error instanceof Error ? error.message : 'Failed to open Google authorization'
      throw error
    }
  }

  async function exchangeCode(code: string, pending: PendingOAuth): Promise<void> {
    const clientId = getClientId()
    const body = buildTokenExchangePayload({
      code,
      clientId,
      clientSecret: getClientSecret(),
      redirectUri: pending.redirectUri,
      codeVerifier: pending.verifier,
    })

    debugLog('exchangeCode', { clientId, redirectUri: pending.redirectUri, body: body.toString() })

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await res.json()
    debugLog('exchangeCode response', { status: res.status, ok: res.ok, data })
    if (!res.ok) {
      if (data.error_description?.includes('client_secret') || data.error === 'invalid_client') {
        throw new Error(
          `Google API Error: ${data.error_description || data.error}. ` +
            `Verificá que VITE_GCAL_CLIENT_SECRET esté configurado con el secret del client.`
        )
      }
      throw new Error(
        `Google API Error: ${data.error_description || data.error || JSON.stringify(data)}`
      )
    }

    accessToken.value = data.access_token
    refreshToken.value = data.refresh_token ?? null
    tokenExpiry.value = Date.now() + (data.expires_in ?? 3600) * 1000
    await persistTokens()
    connected.value = true
    oauthStatus.value = 'connected'
  }

  async function cancelConnect(): Promise<void> {
    await clearPendingOAuth()
    oauthStatus.value = connected.value ? 'connected' : 'idle'
  }

  async function disconnect(): Promise<void> {
    if (accessToken.value) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken.value}`, {
          method: 'POST',
        })
      } catch {}
    }
    await clearTokens()
    await cancelConnect()
    connected.value = false
    oauthStatus.value = 'idle'
    events.value = []
  }

  async function fetchWithRetry(url: string): Promise<Response> {
    let requestToken = await ensureAccessToken()
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${requestToken}` },
    })
    if (response.status !== 401) return response

    if (accessToken.value === requestToken) {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      await refreshPromise
      requestToken = accessToken.value!
    } else {
      requestToken = accessToken.value!
    }
    return fetch(url, {
      headers: { Authorization: `Bearer ${requestToken}` },
    })
  }

  async function fetchCalendars(): Promise<Map<string, string>> {
    const calRes = await fetchWithRetry(buildCalendarListUrl())
    if (!calRes.ok) {
      throw new Error('Failed to fetch calendars')
    }
    const calData = await calRes.json()
    const items = calData.items ?? []
    calendars.value = items
    return mapCalendarListToColors(items)
  }

  async function syncYear(year?: number): Promise<void> {
    const y = year ?? currentYear.value
    syncing.value = true
    try {
      const localJson = await loadConfig('local-calendar-events')
      if (localJson) {
        try {
          localEvents.value = JSON.parse(localJson)
        } catch {
          localEvents.value = []
        }
      } else {
        localEvents.value = []
      }

      if (!connected.value) {
        events.value = [...localEvents.value].sort((a, b) => a.date.localeCompare(b.date))
        syncError.value = null
        return
      }

      const calendarColors = await fetchCalendars()
      const calendarIds: string[] = calendars.value
        .map((c) => c.id)
        .filter((id) => !hiddenCalendarIds.value.has(id))

      const { start, end } = yearBounds(y)
      const allEvents: CalendarEvent[] = []
      let failedCalendars = 0

      await Promise.all(
        calendarIds.map(async (cid: string) => {
          try {
            const evRes = await fetchWithRetry(buildEventsListUrl(cid, start, end))
            if (!evRes.ok) throw new Error(`Calendar ${cid} returned ${evRes.status}`)
            const raw = await evRes.json()
            const evData = GcalEventApiResponseSchema.parse(raw)
            const calColor = calendarColors.get(cid) ?? DEFAULT_EVENT_COLOR
            const mapped = mapGcalEventsToDomain(evData.items, cid, calColor)
            allEvents.push(...mapped)
          } catch {
            if (!connected.value)
              throw new Error('Google Calendar session expired. Please reconnect.')
            failedCalendars++
          }
        })
      )

      allEvents.push(...localEvents.value)
      allEvents.sort((a, b) => a.date.localeCompare(b.date))
      events.value = allEvents
      if (failedCalendars > 0) {
        syncError.value = `No se pudieron sincronizar ${failedCalendars} ${failedCalendars === 1 ? 'calendario' : 'calendarios'}`
      } else {
        syncError.value = null
      }
    } catch (e) {
      syncError.value = e instanceof Error ? e.message : 'Sync failed'
      throw e
    } finally {
      syncing.value = false
    }
  }

  function goNextYear(): void {
    currentYear.value++
  }

  function goPrevYear(): void {
    currentYear.value--
  }

  /**
   * Elimina los eventos locales del calendario en memoria (son datos) y los
   * quita de la lista combinada. Conserva la conexión y los eventos de
   * Google. Para «Borrar datos».
   */
  function resetLocalEvents(): void {
    localEvents.value = []
    events.value = events.value.filter((e) => e.calendarId !== 'local')
  }

  async function loadPersistedConfig(): Promise<void> {
    const [at, rt, exp, localJson, visibleCalendars] = await Promise.all([
      loadConfig(GCAL_ACCESS_TOKEN),
      loadConfig(GCAL_REFRESH_TOKEN),
      loadConfig(GCAL_TOKEN_EXPIRY),
      loadConfig('local-calendar-events'),
      loadGcalVisibleCalendars(),
    ])
    hiddenCalendarIds.value = new Set(visibleCalendars.hiddenCalendarIds)
    if (localJson) {
      try {
        localEvents.value = JSON.parse(localJson)
      } catch {}
    }
    const pending = await loadPendingOAuth()
    if (pending && Date.now() - pending.createdAt <= OAUTH_PENDING_TTL) {
      oauthStatus.value = 'waiting'
      pendingExpiryTimer = setTimeout(
        () => {
          void clearPendingOAuth().then(() => {
            if (!connected.value) oauthStatus.value = 'idle'
            connectError.value = 'OAuth authorization expired. Please reconnect.'
          })
        },
        Math.max(0, pending.createdAt + OAUTH_PENDING_TTL - Date.now())
      )
    } else if (pending) {
      await clearPendingOAuth()
      connectError.value = 'OAuth authorization expired. Please reconnect.'
    }
    if (at && rt) {
      accessToken.value = at
      refreshToken.value = rt
      tokenExpiry.value = exp ? Number(exp) : null
      connected.value = true
      oauthStatus.value = 'connected'
    }
  }

  let oauthListenerRegistered = false

  async function initTauriEvent(): Promise<void> {
    if (oauthListenerRegistered) return
    oauthListenerRegistered = true
    try {
      await listen<string>('oauth-callback', async (event) => {
        const pending = await loadPendingOAuth()
        if (!pending) {
          await clearPendingOAuth()
          connectError.value = 'OAuth callback received without a pending connection'
          oauthStatus.value = 'idle'
          return
        }
        if (Date.now() - pending.createdAt > OAUTH_PENDING_TTL) {
          await clearPendingOAuth()
          connectError.value = 'OAuth authorization expired. Please reconnect.'
          oauthStatus.value = 'idle'
          return
        }
        const { code, error, state } = parseOAuthCallbackQuery(event.payload)
        await clearPendingOAuth()
        if (error) {
          connectError.value = `OAuth error: ${error}`
          oauthStatus.value = 'idle'
          return
        }
        if (!state || state !== pending.state) {
          connectError.value = 'OAuth state mismatch'
          oauthStatus.value = 'idle'
          return
        }
        if (!code) {
          connectError.value = 'OAuth callback did not include an authorization code'
          oauthStatus.value = 'idle'
          return
        }
        try {
          await exchangeCode(code, pending)
          connectError.value = null
        } catch (error) {
          connectError.value = error instanceof Error ? error.message : String(error)
          oauthStatus.value = 'idle'
        }
      })
    } catch (error) {
      oauthListenerRegistered = false
      connectError.value =
        error instanceof Error ? error.message : 'Failed to listen for OAuth callback'
    }
  }

  initTauriEvent()
  loadPersistedConfig().catch((error) => {
    connectError.value =
      error instanceof Error ? error.message : 'Failed to load calendar configuration'
  })

  async function createEvent(
    calendarId: string,
    eventData: { title: string; description?: string; colorId?: string; start: string; end: string }
  ): Promise<void> {
    syncing.value = true
    syncError.value = null
    try {
      if (calendarId === 'local' || !connected.value) {
        const eventId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const calendarColor = eventData.colorId
          ? (CALENDAR_COLORS[eventData.colorId] ?? DEFAULT_EVENT_COLOR)
          : DEFAULT_EVENT_COLOR

        const newEvent: CalendarEvent = {
          id: eventId,
          date: eventData.start.split('T')[0],
          title: eventData.title,
          description: eventData.description,
          color: calendarColor,
          calendarId: 'local',
          start: eventData.start,
          end: eventData.end,
        }

        localEvents.value.push(newEvent)
        await saveConfig('local-calendar-events', JSON.stringify(localEvents.value))

        events.value = [...events.value, newEvent].sort((a, b) => a.date.localeCompare(b.date))
        return
      }

      const token = await ensureAccessToken()
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`

      const body = {
        summary: eventData.title,
        description: eventData.description,
        colorId: eventData.colorId,
        start: { dateTime: eventData.start },
        end: { dateTime: eventData.end },
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create event')
      }

      const calendarColor =
        calendars.value.find((c) => c.id === calendarId)?.backgroundColor ?? DEFAULT_EVENT_COLOR
      const mapped = mapGcalEventsToDomain([data], calendarId, calendarColor)[0]
      events.value = [...events.value, mapped].sort((a, b) => a.date.localeCompare(b.date))
    } catch (e: unknown) {
      syncError.value = e instanceof Error ? e.message : 'Failed to create event'
      throw e
    } finally {
      syncing.value = false
    }
  }

  async function updateEvent(
    calendarId: string,
    eventId: string,
    eventData: { title: string; description?: string; colorId?: string; start: string; end: string }
  ): Promise<void> {
    syncing.value = true
    syncError.value = null
    try {
      if (calendarId === 'local' || eventId.startsWith('local_')) {
        const calendarColor = eventData.colorId
          ? (CALENDAR_COLORS[eventData.colorId] ?? DEFAULT_EVENT_COLOR)
          : DEFAULT_EVENT_COLOR
        localEvents.value = localEvents.value.map((evt) => {
          if (evt.id === eventId) {
            return {
              ...evt,
              title: eventData.title,
              description: eventData.description,
              color: calendarColor,
              start: eventData.start,
              end: eventData.end,
              date: eventData.start.split('T')[0],
            }
          }
          return evt
        })
        await saveConfig('local-calendar-events', JSON.stringify(localEvents.value))

        events.value = events.value
          .map((evt) => {
            if (evt.id === eventId) {
              return {
                ...evt,
                title: eventData.title,
                description: eventData.description,
                color: calendarColor,
                start: eventData.start,
                end: eventData.end,
                date: eventData.start.split('T')[0],
              }
            }
            return evt
          })
          .sort((a, b) => a.date.localeCompare(b.date))
        return
      }

      const token = await ensureAccessToken()
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`

      const body = {
        summary: eventData.title,
        description: eventData.description,
        colorId: eventData.colorId,
        start: { dateTime: eventData.start },
        end: { dateTime: eventData.end },
      }

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to update event')
      }

      const calendarColor =
        calendars.value.find((c) => c.id === calendarId)?.backgroundColor ?? DEFAULT_EVENT_COLOR
      const mapped = mapGcalEventsToDomain([data], calendarId, calendarColor)[0]
      events.value = events.value
        .map((evt) => (evt.id === eventId ? mapped : evt))
        .sort((a, b) => a.date.localeCompare(b.date))
    } catch (e: unknown) {
      syncError.value = e instanceof Error ? e.message : 'Failed to update event'
      throw e
    } finally {
      syncing.value = false
    }
  }

  async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
    syncing.value = true
    syncError.value = null
    try {
      if (calendarId === 'local' || eventId.startsWith('local_')) {
        localEvents.value = localEvents.value.filter((evt) => evt.id !== eventId)
        await saveConfig('local-calendar-events', JSON.stringify(localEvents.value))
        events.value = events.value.filter((evt) => evt.id !== eventId)
        return
      }

      const token = await ensureAccessToken()
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message || 'Failed to delete event')
      }

      events.value = events.value.filter((evt) => evt.id !== eventId)
    } catch (e: unknown) {
      syncError.value = e instanceof Error ? e.message : 'Failed to delete event'
      throw e
    } finally {
      syncing.value = false
    }
  }

  return {
    connected,
    currentYear,
    syncing,
    syncError,
    connectError,
    oauthStatus,
    events,
    eventsByDate,
    connect,
    disconnect,
    cancelConnect,
    syncYear,
    fetchCalendars,
    goNextYear,
    goPrevYear,
    loadPersistedConfig,
    accessToken,
    refreshToken,
    tokenExpiry,
    calendars,
    hiddenCalendarIds: readonly(hiddenCalendarIds),
    isCalendarHidden,
    setCalendarHidden,
    resetLocalEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  }
})
