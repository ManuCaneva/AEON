<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDashboardStore, wouldCollide, type LayoutItem } from '@/stores/dashboard'
import { useUiStore } from '@/stores/ui'
import { getWidgetById } from '@/lib/dashboardWidgets'
import { COLS, ROWS } from '@/lib/grid'
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

/**
 * Item que ve el contenido interno del widget. Durante el gesto de
 * mover/redimensionar ya refleja la geometría destino del preview, así el
 * contenido (ej. columnas del calendario anual) calcula el mismo layout que
 * tras soltar (WYSIWYG). El posicionamiento del GridItem conserva la
 * geometría origen: el salto visual lo muestra DropZonePreview.
 */
function previewItemFor(item: LayoutItem): LayoutItem {
  const zone = preview.value
  if (!zone || zone.id !== item.i) return item
  return { ...item, x: zone.x, y: zone.y, w: zone.w, h: zone.h }
}

/** Misma regla de colisión que aplica el store al soltar: si la zona choca, el gesto se rechaza. */
const previewOccupied = computed(() => {
  const zone = preview.value
  if (!zone) return false
  return wouldCollide(zone.x, zone.y, zone.w, zone.h, dashboard.layout, zone.id)
})

/**
 * Template compartido por el contenedor y la capa de líneas: ambas usan el
 * mismo motor de layout, así las líneas caen sobre los bordes reales de
 * celda aunque el ancho no sea divisible por COLS (un gradiente con
 * calc(100%/12) se desvía progresivamente hacia la derecha).
 */
const gridTemplateStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
}))

/**
 * Celdas de la capa de líneas: cada una dibuja su borde completo. Cada borde
 * interior lo pintan las dos celdas vecinas con mitades adyacentes, así la
 * línea de 2px queda centrada sobre el borde real de celda y la card (inset
 * de 2px) dista 1px de cada lado. El cierre exterior lo aportan las celdas
 * del borde, no el wrapper, para no apilar el alfa dos veces.
 */
const lineCellCount = COLS * ROWS

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
      :style="gridTemplateStyle"
    >
      <div
        v-if="ui.editMode"
        data-testid="dashboard-grid-lines"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 z-0"
        :style="gridTemplateStyle"
      >
        <div
          v-for="n in lineCellCount"
          :key="n"
          data-testid="dashboard-grid-cell"
          class="border border-hairline/60"
        />
      </div>
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
        <component :is="getWidgetById(item.i)?.component" :item="previewItemFor(item)" />
        <template #controls>
          <WidgetRemoveButton v-if="ui.editMode" :widget-id="item.i" @remove="onRemoveWidget" />
        </template>
      </GridItemVue>
    </div>
    <WidgetPicker />
    <EditModeActions />
  </div>
</template>
