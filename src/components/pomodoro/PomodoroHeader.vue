<script setup lang="ts">
import Text from '@/components/ui/Text.vue'

/**
 * Header navegable del pomodoro, compartido por el widget del dashboard y por
 * la ventana mini: la fila completa se activa con el click y el título es el
 * control accesible que anuncia el destino. La fila no es un control (sin
 * `role="button"`): así los botones que viven en el header, como el de pop-out,
 * no quedan anidados dentro de otro control ni desaparecen del árbol de
 * accesibilidad.
 */
const props = defineProps<{ testIdPrefix: string }>()
const emit = defineEmits<{ activate: [] }>()

function testId(suffix: string): string {
  return `${props.testIdPrefix}-${suffix}`
}

function activate(): void {
  emit('activate')
}

/**
 * Enter/Espacio activan el título. `preventDefault` suprime el click que el
 * navegador sintetizaría después: una sola activación por pulsación.
 */
function onTitleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activate()
  }
}
</script>

<template>
  <header
    :data-testid="testId('header')"
    class="group flex shrink-0 cursor-pointer items-center justify-start border-b border-hairline bg-surface-2 px-2 py-1"
    @click="activate"
  >
    <button
      :data-testid="testId('header-title')"
      type="button"
      aria-label="Ir a la página Pomodoro"
      class="cursor-pointer text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      @click.stop="activate"
      @keydown="onTitleKeydown"
    >
      <Text
        variant="card-title"
        weight="600"
        as="span"
        class="text-left text-ink-muted transition-colors group-hover:text-ink"
        >Pomodoro</Text
      >
    </button>
    <slot name="actions" />
  </header>
</template>
