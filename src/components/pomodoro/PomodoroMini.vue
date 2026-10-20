<script setup lang="ts">
import Container from '@/components/ui/Container.vue'
import PomodoroDisc from '@/components/pomodoro/PomodoroDisc.vue'
import PomodoroHeader from '@/components/pomodoro/PomodoroHeader.vue'

/**
 * Acción del header: la define la ventana que hospede la mini. Se expone como
 * evento para no atar la réplica a un comportamiento concreto.
 */
const emit = defineEmits<{ 'header-activate': [] }>()
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
    <PomodoroHeader test-id-prefix="pomodoro-mini" @activate="emit('header-activate')" />

    <div
      data-testid="pomodoro-mini-circle-area"
      class="pomodoro-circle-area flex min-h-0 flex-1 items-center justify-center p-4"
      style="container-type: size"
    >
      <PomodoroDisc test-id-prefix="pomodoro-mini" />
    </div>
  </Container>
</template>
