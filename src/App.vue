<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useHabitsStore } from '@/stores/habits'
import { useTasksStore } from '@/stores/tasks'
import { useGoalsStore } from '@/stores/goals'
import { useExamsStore } from '@/stores/exams'
import { useUiStore } from '@/stores/ui'
import Sidebar from '@/components/layout/Sidebar.vue'
import DashboardView from '@/components/dashboard/DashboardView.vue'
import ExitEditDialog from '@/components/dashboard/ExitEditDialog.vue'
import SettingsView from '@/views/SettingsView.vue'
import PomodoroView from '@/views/PomodoroView.vue'
import { useTheme } from '@/composables/useTheme'
import HabitFormModal from '@/components/habits/HabitFormModal.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import GoalFormModal from '@/components/goals/GoalFormModal.vue'
import NoteFormModal from '@/components/notes/NoteFormModal.vue'
import ExamFormModal from '@/components/exams/ExamFormModal.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import WallpaperLayer from '@/components/layout/WallpaperLayer.vue'
import UpdateModal from '@/components/layout/UpdateModal.vue'
import WhatsNewModal from '@/components/layout/WhatsNewModal.vue'
import { useUpdater } from '@/composables/useUpdater'
import { useWhatsNew } from '@/composables/useWhatsNew'
import { useDesktopEntry } from '@/composables/useDesktopEntry'
import { onShowPomodoroInMain, requestsPomodoroView } from '@/lib/pomodoroMainWindow'
import { restorePomodoroMiniWindow } from '@/lib/pomodoroMiniWindow'
import { formatYyyyMmDd } from '@/lib/calendarDates'

const habits = useHabitsStore()
const tasks = useTasksStore()
const goals = useGoalsStore()
const exams = useExamsStore()
const ui = useUiStore()
const pomodoro = usePomodoroStore()

const {
  status: updateStatus,
  progress: updateProgress,
  notes: updateNotes,
  checkForUpdate,
  update: applyUpdate,
  dismiss: dismissUpdate,
  dismissForever: dismissUpdateForever,
} = useUpdater()

const {
  visible: whatsNewVisible,
  version: whatsNewVersion,
  notes: whatsNewNotes,
  checkPending: checkWhatsNew,
  close: closeWhatsNew,
} = useWhatsNew()

const { ensureDesktopEntry } = useDesktopEntry()

useTheme()

// El título de la ventana mini pide la página Pomodoro en esta ventana por
// evento entre ventanas; una ventana principal recreada llega con el pedido en
// la consulta de su URL. La navegación pasa por la store `ui`, como la sidebar.
if (requestsPomodoroView(window.location.search)) ui.setViewMode('pomodoro')
const stopPomodoroPageRequests = onShowPomodoroInMain(() => ui.setViewMode('pomodoro'))

/**
 * Registra el AppImage en el menú de Linux antes de chequear updates. Si movió
 * el binario en este arranque, se omite el chequeo: el updater todavía tiene la
 * ruta vieja en memoria y escribiría en un archivo inexistente.
 */
async function registerDesktopIntegration(): Promise<void> {
  const renamedAppImage = await ensureDesktopEntry()
  if (!renamedAppImage) void checkForUpdate()
}

onMounted(async () => {
  // La disposición de pantalla se restaura apenas arranca: si el usuario dejó la
  // ventana mini abierta, se reabre donde quedó sin esperar al temporizador.
  void restorePomodoroMiniWindow()
  void registerDesktopIntegration()
  checkWhatsNew()
  ui.loadWallpaper()
  await habits.loadInitialData()
  await tasks.loadTasks()
  await goals.loadGoals()
  await exams.loadExams()
  // Ventana local y amplia: un objetivo de intervalo puede tener períodos de
  // hasta 365 días y el progreso suma los logs desde el inicio del período.
  const today = formatYyyyMmDd(new Date())
  const yearAgo = new Date()
  yearAgo.setDate(yearAgo.getDate() - 366)
  const fromDate = formatYyyyMmDd(yearAgo)
  await goals.loadLogsForRange(fromDate, today)
  await pomodoro.load()
  pomodoro.startTicker()
})

onBeforeUnmount(() => {
  pomodoro.stopTicker()
  void stopPomodoroPageRequests.then((stopListening) => stopListening())
})
</script>

<template>
  <div class="relative isolate flex h-screen gap-3 overflow-hidden bg-canvas p-3 text-ink">
    <WallpaperLayer :url="ui.wallpaperUrl" />

    <div
      data-testid="sidebar-slot"
      class="relative h-full shrink-0"
      :class="ui.sidebarCollapsed ? 'w-16' : 'w-48'"
    >
      <Sidebar class="absolute inset-y-0 left-0 z-10" />
    </div>

    <div class="glass-strong flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
      <div class="min-h-0 flex-1 overflow-hidden p-4">
        <DashboardView v-if="ui.viewMode === 'dashboard'" />
        <SettingsView v-else-if="ui.viewMode === 'settings'" />
        <PomodoroView v-else-if="ui.viewMode === 'pomodoro'" />
      </div>
    </div>

    <HabitFormModal />
    <TaskFormModal />
    <GoalFormModal />
    <NoteFormModal />
    <ExamFormModal />

    <ExitEditDialog />

    <UpdateModal
      :open="updateStatus !== 'idle'"
      :status="updateStatus"
      :progress="updateProgress"
      :notes="updateNotes"
      @update="applyUpdate"
      @dismiss="dismissUpdate"
      @dismiss-forever="dismissUpdateForever"
    />

    <WhatsNewModal
      v-if="whatsNewNotes"
      :open="whatsNewVisible"
      :version="whatsNewVersion ?? ''"
      :notes="whatsNewNotes"
      @close="closeWhatsNew"
    />
  </div>
</template>
