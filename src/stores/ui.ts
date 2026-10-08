import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { migrateStorageKey } from '@/lib/storageKey'
import { isTextSize, textSizeScale, type TextSize } from '@/lib/textSize'
import * as db from '@/lib/db'
import { useDashboardStore } from '@/stores/dashboard'
import {
  WallpaperSettingsSchema,
  parseWallpaperSettingsJson,
  defaultWallpaperSettings,
  type WallpaperSettings,
} from '@/schemas/wallpaper'

export const WALLPAPER_SETTINGS_KEY = 'wallpaper-settings'

export type ViewMode = 'dashboard' | 'archived' | 'pomodoro' | 'settings'

/** Resolución del diálogo de salida del modo edición. */
export type ExitDialogAction = 'save' | 'discard' | 'cancel'

const VALID_MODES: readonly ViewMode[] = ['dashboard', 'archived', 'pomodoro', 'settings']

function isViewMode(v: unknown): v is ViewMode {
  return typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v)
}

function createEntityUi() {
  const createOpen = ref(false)
  const editingId = ref<string | null>(null)
  const menuOpenForId = ref<string | null>(null)

  const isEditing = computed(() => editingId.value !== null)

  function openCreate() {
    editingId.value = null
    createOpen.value = true
    menuOpenForId.value = null
  }

  function openEdit(id: string) {
    editingId.value = id
    createOpen.value = true
    menuOpenForId.value = null
  }

  function closeModal() {
    createOpen.value = false
    editingId.value = null
  }

  function toggleMenu(entityId: string) {
    menuOpenForId.value = menuOpenForId.value === entityId ? null : entityId
  }

  function closeMenu() {
    menuOpenForId.value = null
  }

  return {
    createOpen,
    editingId,
    menuOpenForId,
    isEditing,
    openCreate,
    openEdit,
    closeModal,
    toggleMenu,
    closeMenu,
  }
}

export const useUiStore = defineStore('ui', () => {
  migrateStorageKey('habitos.viewMode', 'aeon.viewMode')
  migrateStorageKey('habitos.sidebarCollapsed', 'aeon.sidebarCollapsed')

  const stored = useStorage<ViewMode>('aeon.viewMode', 'dashboard', undefined, {
    serializer: {
      read: (raw) => {
        try {
          const parsed: unknown = JSON.parse(raw)
          return isViewMode(parsed) ? parsed : 'dashboard'
        } catch {
          return 'dashboard'
        }
      },
      write: (v) => JSON.stringify(v),
    },
  })

  const viewMode = ref<ViewMode>(stored.value)

  watch(viewMode, (v) => {
    stored.value = v
  })

  const sidebarCollapsed = useStorage<boolean>('aeon.sidebarCollapsed', false)

  const textSize = useStorage<TextSize>('aeon.textSize', 'medium', undefined, {
    flush: 'sync',
    serializer: {
      read: (raw) => {
        try {
          const parsed: unknown = JSON.parse(raw)
          return isTextSize(parsed) ? parsed : 'medium'
        } catch {
          return 'medium'
        }
      },
      write: (v) => JSON.stringify(v),
    },
  })

  watch(
    textSize,
    (v) => {
      document.documentElement.style.setProperty('--text-scale', String(textSizeScale(v)))
    },
    { immediate: true, flush: 'sync' }
  )

  function setTextSize(size: TextSize) {
    textSize.value = size
  }

  const editMode = ref(false)
  // Diálogo de salida del modo edición: estado único con la vista destino
  // pendiente. La navegación a esa vista se aplica recién al resolverlo.
  const exitDialogOpen = ref(false)
  const pendingView = ref<ViewMode | null>(null)

  const habits = createEntityUi()
  const tasks = createEntityUi()
  const goals = createEntityUi()
  const notes = createEntityUi()

  function applyViewMode(mode: ViewMode) {
    viewMode.value = mode
    habits.closeMenu()
    tasks.closeMenu()
    goals.closeMenu()
    notes.closeMenu()
  }

  function setViewMode(mode: ViewMode) {
    if (editMode.value && mode !== 'dashboard') {
      if (useDashboardStore().hasUnsavedChanges) {
        openExitDialog(mode)
        return
      }
      // El modo edición es exclusivo del dashboard: navegar a otra vista lo apaga.
      exitEditMode()
    }
    applyViewMode(mode)
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function toggleEditMode() {
    if (!editMode.value) {
      // El atajo de edición siempre entra por el dashboard: desde otra vista
      // primero navega, para que la edición nunca quede activa fuera de él.
      if (viewMode.value !== 'dashboard') applyViewMode('dashboard')
      enterEditMode()
      return
    }
    if (useDashboardStore().hasUnsavedChanges) {
      openExitDialog(null)
      return
    }
    exitEditMode()
  }

  /**
   * Entrar al modo edición abre una sesión de borrador en el store del
   * dashboard: los cambios viven en memoria hasta apretar "Guardar".
   */
  function enterEditMode() {
    useDashboardStore().beginEdit()
    editMode.value = true
  }

  /** Salir del modo edición cierra la sesión de borrador sin persistir. */
  function exitEditMode() {
    useDashboardStore().endEdit()
    editMode.value = false
  }

  function openExitDialog(destination: ViewMode | null) {
    pendingView.value = destination
    exitDialogOpen.value = true
  }

  /**
   * Resuelve el diálogo de salida. "Seguir editando" solo lo cierra; "Guardar
   * y salir" y "Descartar cambios" apagan la edición y aplican la vista destino
   * pendiente si la hay.
   */
  function resolveExitDialog(action: ExitDialogAction) {
    if (action === 'cancel') {
      cancelExitDialog()
      return
    }
    const destination = pendingView.value
    const dashboard = useDashboardStore()
    if (action === 'save') dashboard.saveEdit()
    else dashboard.discardEdit()
    exitEditMode()
    exitDialogOpen.value = false
    pendingView.value = null
    if (destination) applyViewMode(destination)
  }

  /** Cierra el diálogo sin resolver: equivale a "Seguir editando". */
  function cancelExitDialog() {
    exitDialogOpen.value = false
    pendingView.value = null
  }

  const wallpaperUrl = ref<string | null>(null)
  const widgetGlassAlpha = ref(defaultWallpaperSettings.widgetGlassAlpha)

  function applyGlassAlphaVar(alpha: number): void {
    document.documentElement.style.setProperty('--glass-widget-alpha', String(alpha))
  }

  async function persistWallpaperSettings(settings: WallpaperSettings): Promise<void> {
    await db.saveConfig(WALLPAPER_SETTINGS_KEY, JSON.stringify(settings))
  }

  async function loadWallpaper(): Promise<void> {
    const raw = await db.loadConfig(WALLPAPER_SETTINGS_KEY)
    const settings = parseWallpaperSettingsJson(raw)
    wallpaperUrl.value = settings.dataUrl
    widgetGlassAlpha.value = settings.widgetGlassAlpha
    applyGlassAlphaVar(settings.widgetGlassAlpha)
  }

  async function setWallpaper(dataUrl: string): Promise<void> {
    const settings = WallpaperSettingsSchema.parse({
      dataUrl,
      widgetGlassAlpha: widgetGlassAlpha.value,
    })
    await persistWallpaperSettings(settings)
    wallpaperUrl.value = settings.dataUrl
  }

  async function removeWallpaper(): Promise<void> {
    const settings = WallpaperSettingsSchema.parse({
      dataUrl: null,
      widgetGlassAlpha: widgetGlassAlpha.value,
    })
    await persistWallpaperSettings(settings)
    wallpaperUrl.value = settings.dataUrl
  }

  async function setWidgetGlassAlpha(alpha: number): Promise<void> {
    const settings = WallpaperSettingsSchema.parse({
      dataUrl: wallpaperUrl.value,
      widgetGlassAlpha: alpha,
    })
    await persistWallpaperSettings(settings)
    widgetGlassAlpha.value = settings.widgetGlassAlpha
    applyGlassAlphaVar(settings.widgetGlassAlpha)
  }

  return {
    viewMode,
    sidebarCollapsed,
    textSize,
    setTextSize,
    editMode,
    isEditing: habits.isEditing,
    isEditingTask: tasks.isEditing,
    isEditingGoal: goals.isEditing,
    createHabitOpen: habits.createOpen,
    editingHabitId: habits.editingId,
    menuOpenForHabitId: habits.menuOpenForId,
    createTaskOpen: tasks.createOpen,
    editingTaskId: tasks.editingId,
    menuOpenForTaskId: tasks.menuOpenForId,
    createGoalOpen: goals.createOpen,
    editingGoalId: goals.editingId,
    menuOpenForGoalId: goals.menuOpenForId,
    isEditingNote: notes.isEditing,
    createNoteOpen: notes.createOpen,
    editingNoteId: notes.editingId,
    menuOpenForNoteId: notes.menuOpenForId,
    setViewMode,
    toggleSidebar,
    toggleEditMode,
    enterEditMode,
    exitEditMode,
    exitDialogOpen,
    pendingView,
    resolveExitDialog,
    cancelExitDialog,
    wallpaperUrl,
    widgetGlassAlpha,
    loadWallpaper,
    setWallpaper,
    removeWallpaper,
    setWidgetGlassAlpha,
    openCreate: habits.openCreate,
    openEdit: habits.openEdit,
    closeModal: habits.closeModal,
    toggleMenu: habits.toggleMenu,
    closeMenu: habits.closeMenu,
    openCreateTask: tasks.openCreate,
    openEditTask: tasks.openEdit,
    closeTaskModal: tasks.closeModal,
    toggleTaskMenu: tasks.toggleMenu,
    closeTaskMenu: tasks.closeMenu,
    openCreateGoal: goals.openCreate,
    openEditGoal: goals.openEdit,
    closeGoalModal: goals.closeModal,
    toggleGoalMenu: goals.toggleMenu,
    closeGoalMenu: goals.closeMenu,
    openCreateNote: notes.openCreate,
    openEditNote: notes.openEdit,
    closeNoteModal: notes.closeModal,
    toggleNoteMenu: notes.toggleMenu,
    closeNoteMenu: notes.closeMenu,
  }
})
