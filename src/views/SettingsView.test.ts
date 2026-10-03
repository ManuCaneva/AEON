import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import SettingsView from './SettingsView.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'
import { useUiStore } from '@/stores/ui'

const mockTheme = {
  id: 'dark',
  name: 'Oscuro',
  colors: {
    canvas: '1 1 2',
    surface1: '14 15 18',
    surface2: '24 25 30',
    surface3: '34 35 42',
    surface4: '44 45 53',
    hairline: '35 37 42',
    hairlineStrong: '57 59 66',
    hairlineTertiary: '74 77 86',
    ink: '247 248 248',
    inkMuted: '208 214 224',
    inkSubtle: '138 143 152',
    inkTertiary: '98 102 109',
    primary: '94 106 210',
    primaryHover: '130 143 255',
    primaryFocus: '94 105 209',
    brandSecure: '122 127 173',
    success: '39 166 68',
    overlay: '0 0 0',
  },
  fonts: {
    sans: ['Inter', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],
  },
}

const mockSetTheme = vi.fn()
const currentIdRef = ref('dark')
const currentComputed = computed(() => mockTheme)

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    current: currentComputed,
    currentId: currentIdRef,
    themes: [
      {
        id: 'dark',
        name: 'Oscuro',
        colors: { primary: '94 106 210' },
      },
      {
        id: 'light',
        name: 'Claro',
        colors: { primary: '94 106 210' },
      },
    ],
    setTheme: mockSetTheme,
  }),
}))

const mockCalendarStore: {
  connected: boolean
  oauthStatus: 'idle' | 'waiting' | 'connected'
  connectError: string | null
  syncError: string | null
  calendars: { id: string; summary: string; primary?: boolean; backgroundColor?: string }[]
  fetchCalendars: ReturnType<typeof vi.fn>
  setCalendarHidden: ReturnType<typeof vi.fn>
  isCalendarHidden: (calendarId: string) => boolean
  connect: ReturnType<typeof vi.fn>
  cancelConnect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
} = {
  connected: false,
  oauthStatus: 'idle',
  connectError: null,
  syncError: null,
  calendars: [],
  fetchCalendars: vi.fn().mockResolvedValue(new Map()),
  setCalendarHidden: vi.fn().mockResolvedValue(undefined),
  isCalendarHidden: () => false,
  connect: vi.fn().mockResolvedValue(undefined),
  cancelConnect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => mockCalendarStore,
}))

vi.mock('@/components/settings/WallpaperCard.vue', () => ({
  default: { template: '<div data-testid="mock-wallpaper-card" />' },
}))

describe('SettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCalendarStore.connected = false
    mockCalendarStore.oauthStatus = 'idle'
    mockCalendarStore.connectError = null
    mockCalendarStore.syncError = null
    mockCalendarStore.calendars = []
    mockCalendarStore.isCalendarHidden = () => false
    mockCalendarStore.fetchCalendars.mockResolvedValue(new Map())
  })

  it('el main tiene h-full y overflow-y-auto', () => {
    const wrapper = mount(SettingsView)
    const main = wrapper.find('main')
    expect(main.exists()).toBe(true)
    expect(main.classes()).toContain('h-full')
    expect(main.classes()).toContain('overflow-y-auto')
  })

  it('muestra la card de Google Calendar', () => {
    const wrapper = mount(SettingsView)
    expect(wrapper.text()).toContain('Google Calendar')
  })

  it('muestra el nombre del tema actual en el dropdown', () => {
    const wrapper = mount(SettingsView)
    const dropdown = wrapper.find("[data-testid='theme-dropdown-btn']")
    expect(dropdown.text()).toContain('Oscuro')
  })

  it('muestra el boton Conectar cuando no esta conectado', () => {
    const wrapper = mount(SettingsView)
    expect(wrapper.find("[data-testid='gcal-connect-btn']").exists()).toBe(true)
  })

  it('llama store.connect al hacer click en Conectar', async () => {
    const wrapper = mount(SettingsView)
    await wrapper.find("[data-testid='gcal-connect-btn']").trigger('click')
    expect(mockCalendarStore.connect).toHaveBeenCalled()
  })

  it('muestra Conectado y Desconectar cuando esta conectado', () => {
    mockCalendarStore.connected = true
    const wrapper = mount(SettingsView)
    expect(wrapper.text()).toContain('Connected')
    expect(wrapper.text()).toContain('Desconectar')
    expect(wrapper.find("[data-testid='gcal-connect-btn']").exists()).toBe(false)
  })

  it('llama store.disconnect al hacer click en Desconectar', async () => {
    mockCalendarStore.connected = true
    const wrapper = mount(SettingsView)
    await wrapper.find("[data-testid='gcal-disconnect-btn']").trigger('click')
    expect(mockCalendarStore.disconnect).toHaveBeenCalled()
  })

  it('muestra error de sync si existe', () => {
    mockCalendarStore.syncError = 'Token expired'
    const wrapper = mount(SettingsView)
    expect(wrapper.text()).toContain('Token expired')
  })

  it('muestra que espera autorización y permite cancelar', async () => {
    mockCalendarStore.oauthStatus = 'waiting'
    const wrapper = mount(SettingsView)
    expect(wrapper.text()).toContain('Esperando autorización en el navegador')
    expect(wrapper.text()).toContain('Cancelar')
    expect(wrapper.text()).not.toContain('Not connected')
    await wrapper.find("[data-testid='gcal-cancel-btn']").trigger('click')
    expect(mockCalendarStore.cancelConnect).toHaveBeenCalled()
  })

  it('muestra error de conexión separado del sync', () => {
    mockCalendarStore.connectError = 'OAuth state mismatch'
    const wrapper = mount(SettingsView)
    expect(wrapper.text()).toContain('OAuth state mismatch')
  })

  it('muestra la card de visibilidad debajo de la card de conexión', () => {
    mockCalendarStore.connected = true
    const wrapper = mount(SettingsView)
    const card = wrapper.find("[data-testid='gcal-visibility-card']")
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('Calendarios visibles')
  })

  it('la card de visibilidad muestra estado vacío cuando no hay conexión', () => {
    mockCalendarStore.connected = false
    const wrapper = mount(SettingsView)
    expect(wrapper.find("[data-testid='gcal-visibility-empty']").exists()).toBe(true)
  })

  it('la card de visibilidad lista los calendarios del store', () => {
    mockCalendarStore.connected = true
    mockCalendarStore.calendars = [
      { id: 'primary', summary: 'Personal', primary: true, backgroundColor: '#7986cb' },
      { id: 'work', summary: 'Trabajo', backgroundColor: '#33b679' },
    ]
    const wrapper = mount(SettingsView)
    expect(wrapper.findAll("[data-testid='gcal-visibility-row']")).toHaveLength(2)
    expect(wrapper.text()).toContain('Personal')
    expect(wrapper.text()).toContain('Trabajo')
  })

  it('togglear un checkbox desde Settings llama a setCalendarHidden', async () => {
    mockCalendarStore.connected = true
    mockCalendarStore.calendars = [
      { id: 'primary', summary: 'Personal', primary: true, backgroundColor: '#7986cb' },
    ]
    const wrapper = mount(SettingsView)
    await wrapper.find('input[type="checkbox"]').setValue(false)
    expect(mockCalendarStore.setCalendarHidden).toHaveBeenCalledWith('primary', true)
  })

  it('organiza las secciones con eyebrows', () => {
    const wrapper = mount(SettingsView)
    const eyebrows = wrapper.findAll('.text-eyebrow')
    expect(eyebrows.map((e) => e.text())).toEqual([
      'Configuración',
      'Apariencia',
      'Integraciones',
      'Datos',
    ])
  })

  it('la sección Apariencia incluye la card de Fondo', () => {
    const wrapper = mount(SettingsView)
    expect(wrapper.find("[data-testid='mock-wallpaper-card']").exists()).toBe(true)
  })

  it('no usa colores de paleta crudos de Tailwind', () => {
    mockCalendarStore.connected = true
    mockCalendarStore.syncError = 'boom'
    const wrapper = mount(SettingsView)
    expect(hasRawPaletteColor(wrapper.html())).toBe(false)
  })

  it('usa acentos semánticos para el estado de conexión', () => {
    mockCalendarStore.connected = true
    const connected = mount(SettingsView)
    expect(connected.get("[data-testid='gcal-status']").classes()).toContain('text-accent-green')

    mockCalendarStore.connected = false
    mockCalendarStore.oauthStatus = 'idle'
    const disconnected = mount(SettingsView)
    expect(disconnected.get("[data-testid='gcal-status']").classes()).toContain('text-ink-muted')
  })

  it('ofrece tres opciones de tamaño de letra y aplica la elegida', async () => {
    const wrapper = mount(SettingsView)
    const group = wrapper.find("[data-testid='text-size-group']")
    expect(group.exists()).toBe(true)
    const buttons = group.findAll('button')
    expect(buttons).toHaveLength(3)
    expect(group.text()).toContain('Pequeño')
    expect(group.text()).toContain('Mediano')
    expect(group.text()).toContain('Grande')

    await buttons[2].trigger('click')
    const ui = useUiStore()
    expect(ui.textSize).toBe('large')
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.15')
  })

  it('marca la opción activa de tamaño de letra', async () => {
    const ui = useUiStore()
    ui.setTextSize('small')
    const wrapper = mount(SettingsView)
    const buttons = wrapper.find("[data-testid='text-size-group']").findAll('button')
    expect(buttons[0].attributes('aria-pressed')).toBe('true')
    expect(buttons[1].attributes('aria-pressed')).toBe('false')
    expect(buttons[2].attributes('aria-pressed')).toBe('false')
  })
})
