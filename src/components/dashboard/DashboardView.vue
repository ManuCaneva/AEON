<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDashboardStore, wouldCollide } from '@/stores/dashboard'
import { useUiStore } from '@/stores/ui'
import { getWidgetById } from '@/lib/dashboardWidgets'
import GridItemVue from './GridItemVue.vue'
import WidgetPicker from './WidgetPicker.vue'
import WidgetRemoveButton from './WidgetRemoveButton.vue'
import EditModeActions from './EditModeActions.vue'
import DropZonePreview from './DropZonePreview.vue'

const dashboard = useDashboardStore()
const ui = useUiStore()

interface PreviewZone {
  id: string
  x: number
  y: number
  w: number
  h: number
}

const preview = ref<PreviewZone | null>(null)

function onPreview(id: string, x: number, y: number, w: number, h: number) {
  preview.value = { id, x, y, w, h }
}

function onPreviewEnd() {
  preview.value = null
}

/** Misma regla de colisión que aplica el store al soltar: si la zona choca, el gesto se rechaza. */
const previewOccupied = computed(() => {
  const zone = preview.value
  if (!zone) return false
  return wouldCollide(zone.x, zone.y, zone.w, zone.h, dashboard.layout, zone.id)
})

function onMoved(id: string, x: number, y: number) {
  dashboard.moveTo(id, x, y)
}

function onResized(id: string, x: number, y: number, w: number, h: number) {
  dashboard.resizeTo(id, w, h, x, y)
}

function onRemoveWidget(id: string) {
  dashboard.removeWidget(id)
}
</script>

<template>
  <div data-testid="dashboard-view" class="h-full" :class="!ui.editMode && 'overflow-hidden'">
    <div
      class="dashboard-grid relative h-full"
      :class="ui.editMode && 'isolate'"
      style="
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        grid-template-rows: repeat(10, minmax(0, 1fr));
        gap: 4px;
      "
    >
      <div
        v-if="ui.editMode"
        data-testid="dashboard-grid-lines"
        aria-hidden="true"
        class="dashboard-grid-lines pointer-events-none absolute inset-0 z-0 border-b border-r border-hairline/60"
      />
      <DropZonePreview
        v-if="ui.editMode && preview"
        :x="preview.x"
        :y="preview.y"
        :w="preview.w"
        :h="preview.h"
        :occupied="previewOccupied"
      />
      <GridItemVue
        v-for="item in dashboard.layout"
        :key="item.i"
        :item="item"
        :edit-mode="ui.editMode"
        @moved="onMoved"
        @resized="onResized"
        @preview="onPreview"
        @preview-end="onPreviewEnd"
      >
        <component :is="getWidgetById(item.i)?.component" :item="item" />
        <template #controls>
          <WidgetRemoveButton v-if="ui.editMode" :widget-id="item.i" @remove="onRemoveWidget" />
        </template>
      </GridItemVue>
    </div>
    <WidgetPicker />
    <EditModeActions />
  </div>
</template>

<style scoped>
.dashboard-grid-lines {
  background-image:
    repeating-linear-gradient(
      to right,
      rgb(var(--color-hairline) / 0.6) 0,
      rgb(var(--color-hairline) / 0.6) 1px,
      transparent 1px,
      transparent calc((100% + 4px) / 12)
    ),
    repeating-linear-gradient(
      to bottom,
      rgb(var(--color-hairline) / 0.6) 0,
      rgb(var(--color-hairline) / 0.6) 1px,
      transparent 1px,
      transparent calc((100% + 4px) / 10)
    );
}
</style>
