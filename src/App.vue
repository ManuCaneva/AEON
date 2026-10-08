<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useHabitsStore } from '@/stores/habits'
import { useTasksStore } from '@/stores/tasks'
import { useGoalsStore } from '@/stores/goals'
import { useUiStore } from '@/stores/ui'
import Sidebar from '@/components/layout/Sidebar.vue'
import DashboardView from '@/components/dashboard/DashboardView.vue'
import ExitEditDialog from '@/components/dashboard/ExitEditDialog.vue'
import ArchivedView from '@/views/ArchivedView.vue'
import SettingsView from '@/views/SettingsView.vue'
import PomodoroView from '@/views/PomodoroView.vue'
import { useTheme } from '@/composables/useTheme'
import HabitFormModal from '@/components/habits/HabitFormModal.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import GoalFormModal from '@/components/goals/GoalFormModal.vue'
import NoteFormModal from '@/components/notes/NoteFormModal.vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import WallpaperLayer from '@/components/layout/WallpaperLayer.vue'
import UpdateModal from '@/components/layout/UpdateModal.vue'
import { useUpdater } from '@/composables/useUpdater'
import { useDesktopEntry } from '@/composables/useDesktopEntry'

const habits = useHabitsStore()
const tasks = useTasksStore()
const goals = useGoalsStore()
const ui = useUiStore()
const pomodoro = usePomodoroStore()

const {
  status: updateStatus,
  progress: updateProgress,
  checkForUpdate,
  update: applyUpdate,
  dismiss: dismissUpdate,
  dismissForever: dismissUpdateForever,
} = useUpdater()

const { ensureDesktopEntry } = useDesktopEntry()

useTheme()

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
  void registerDesktopIntegration()
  ui.loadWallpaper()
  await habits.loadInitialData()
  await tasks.loadTasks()
  await goals.loadGoals()
  const today = new Date()
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(today.getDate() - 90)
  const fromDate = ninetyDaysAgo.toISOString().split('T')[0]
  const toDate = today.toISOString().split('T')[0]
  await goals.loadLogsForRange(fromDate, toDate)
  await pomodoro.load()
  pomodoro.startTicker()
})

onBeforeUnmount(() => {
  pomodoro.stopTicker()
})
</script>

<template>
  <div class="relative isolate flex h-screen gap-3 overflow-hidden bg-canvas p-3 text-ink">
    <WallpaperLayer :url="ui.wallpaperUrl" />

    <div
      data-testid="sidebar-slot"
      class="relative h-full shrink-0"
      :class="ui.sidebarCollapsed ? 'w-14' : 'w-44'"
    >
      <Sidebar class="absolute inset-y-0 left-0 z-10" />
    </div>

    <div class="glass-strong flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
      <div class="min-h-0 flex-1 overflow-hidden p-4">
        <DashboardView v-if="ui.viewMode === 'dashboard'" />
        <ArchivedView v-else-if="ui.viewMode === 'archived'" />
        <SettingsView v-else-if="ui.viewMode === 'settings'" />
        <PomodoroView v-else-if="ui.viewMode === 'pomodoro'" />
      </div>
    </div>

    <HabitFormModal />
    <TaskFormModal />
    <GoalFormModal />
    <NoteFormModal />

    <ExitEditDialog />

    <UpdateModal
      :open="updateStatus !== 'idle'"
      :status="updateStatus"
      :progress="updateProgress"
      @update="applyUpdate"
      @dismiss="dismissUpdate"
      @dismiss-forever="dismissUpdateForever"
    />
  </div>
</template>
