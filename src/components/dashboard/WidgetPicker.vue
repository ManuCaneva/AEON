<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useDashboardStore } from '@/stores/dashboard'
import { useUiStore } from '@/stores/ui'
import { widgets } from '@/lib/dashboardWidgets'
import Text from '@/components/ui/Text.vue'
import Badge from '@/components/ui/Badge.vue'

const dashboard = useDashboardStore()
const ui = useUiStore()

const open = ref(false)

const availableWidgets = computed(() => {
  const layoutIds = new Set(dashboard.layout.map((item) => item.i))
  return widgets.filter((w) => !layoutIds.has(w.id))
})

function toggleOpen() {
  open.value = !open.value
}

function selectWidget(id: string) {
  dashboard.addWidget(id)
  open.value = false
}
</script>

<template>
  <div v-if="ui.editMode" data-testid="widget-picker" class="fixed bottom-6 right-6 z-50">
    <div class="relative">
      <div
        v-if="open"
        class="absolute bottom-12 right-0 min-w-[180px] rounded-xl border border-hairline bg-surface-1 p-2 shadow-lg"
      >
        <Text variant="caption" weight="600" class="px-2 py-1 text-ink-muted">Agregar widget</Text>
        <button
          v-for="widget in availableWidgets"
          :key="widget.id"
          :data-widget-id="widget.id"
          data-testid="widget-picker-item"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-caption text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          @click="selectWidget(widget.id)"
        >
          <span>{{ widget.title }}</span>
          <Badge v-if="widget.isNew" variant="primary">Nuevo!</Badge>
        </button>
        <div v-if="availableWidgets.length === 0" class="px-2 py-1.5 text-caption text-ink-muted">
          Todos los widgets ya están agregados
        </div>
      </div>
      <button
        data-testid="widget-picker-toggle"
        type="button"
        class="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:bg-primary-focus"
        aria-label="Agregar widget"
        @click="toggleOpen"
      >
        <Plus :size="24" />
      </button>
    </div>
  </div>
</template>
