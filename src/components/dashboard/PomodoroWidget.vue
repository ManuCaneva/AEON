<script setup lang="ts">
import { PictureInPicture2 } from 'lucide-vue-next'
import Container from '@/components/ui/Container.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Text from '@/components/ui/Text.vue'
import PomodoroDisc from '@/components/pomodoro/PomodoroDisc.vue'
import { useUiStore } from '@/stores/ui'
import { openPomodoroMiniWindow } from '@/lib/pomodoroMiniWindow'

const ui = useUiStore()

function goToPomodoroView() {
  ui.setViewMode('pomodoro')
}

function onHeaderKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    goToPomodoroView()
  }
}

function onPopOut(event: MouseEvent) {
  event.stopPropagation()
  void openPomodoroMiniWindow()
}
</script>

<template>
  <Container
    data-testid="pomodoro-widget"
    variant="default"
    glass
    padding="none"
    class="container-widget flex h-full flex-col overflow-hidden"
    style="container-type: inline-size"
  >
    <header
      data-testid="pomodoro-widget-header"
      role="button"
      tabindex="0"
      aria-label="Ir a la página Pomodoro"
      class="group flex shrink-0 cursor-pointer items-center justify-start border-b border-hairline bg-surface-2 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      @click="goToPomodoroView"
      @keydown="onHeaderKeydown"
    >
      <Text
        variant="card-title"
        weight="600"
        class="text-left text-ink-muted transition-colors group-hover:text-ink"
        >Pomodoro</Text
      >
      <IconButton
        data-testid="pomodoro-widget-popout"
        label="Abrir ventana mini"
        variant="ghost"
        size="sm"
        class="ml-1"
        @click="onPopOut"
      >
        <PictureInPicture2 :size="14" aria-hidden="true" />
      </IconButton>
    </header>

    <div
      data-testid="pomodoro-widget-circle-area"
      class="pomodoro-circle-area flex min-h-0 flex-1 items-center justify-center p-4"
      style="container-type: size"
    >
      <PomodoroDisc test-id-prefix="pomodoro-widget" />
    </div>
  </Container>
</template>
