<script setup lang="ts">
import { PictureInPicture2 } from 'lucide-vue-next'
import Container from '@/components/ui/Container.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PomodoroDisc from '@/components/pomodoro/PomodoroDisc.vue'
import PomodoroHeader from '@/components/pomodoro/PomodoroHeader.vue'
import { useUiStore } from '@/stores/ui'
import { openPomodoroMiniWindow } from '@/lib/pomodoroMiniWindow'

const ui = useUiStore()

function goToPomodoroView() {
  ui.setViewMode('pomodoro')
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
    <PomodoroHeader test-id-prefix="pomodoro-widget" @activate="goToPomodoroView">
      <template #actions>
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
      </template>
    </PomodoroHeader>

    <div
      data-testid="pomodoro-widget-circle-area"
      class="pomodoro-circle-area flex min-h-0 flex-1 items-center justify-center p-4"
      style="container-type: size"
    >
      <PomodoroDisc test-id-prefix="pomodoro-widget" />
    </div>
  </Container>
</template>
