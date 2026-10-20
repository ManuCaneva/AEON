<script setup lang="ts">
import Container from '@/components/ui/Container.vue'
import Text from '@/components/ui/Text.vue'
import PomodoroDisc from '@/components/pomodoro/PomodoroDisc.vue'

/**
 * Acción del header: la define la ventana que hospede la mini. Se expone como
 * evento para no atar la réplica a un comportamiento concreto.
 */
const emit = defineEmits<{ 'header-activate': [] }>()

function onHeaderKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('header-activate')
  }
}
</script>

<template>
  <Container
    data-testid="pomodoro-mini"
    variant="default"
    glass
    padding="none"
    class="container-widget flex h-screen flex-col overflow-hidden"
    style="container-type: inline-size"
  >
    <header
      data-testid="pomodoro-mini-header"
      role="button"
      tabindex="0"
      class="group flex shrink-0 cursor-pointer items-center justify-start border-b border-hairline bg-surface-2 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      @click="emit('header-activate')"
      @keydown="onHeaderKeydown"
    >
      <Text
        variant="card-title"
        weight="600"
        class="text-left text-ink-muted transition-colors group-hover:text-ink"
        >Pomodoro</Text
      >
    </header>

    <div
      data-testid="pomodoro-mini-circle-area"
      class="pomodoro-circle-area flex min-h-0 flex-1 items-center justify-center p-4"
      style="container-type: size"
    >
      <PomodoroDisc test-id-prefix="pomodoro-mini" />
    </div>
  </Container>
</template>
