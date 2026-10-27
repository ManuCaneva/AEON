<script setup lang="ts">
import { NOTE_CATEGORIES, type NoteCategory, type ReleaseNotes as Notes } from '@/lib/update/notes'

defineProps<{ notes: Notes }>()

const GROUPS: Record<NoteCategory, { label: string; dot: string; title: string }> = {
  nuevo: {
    label: 'Nuevo',
    dot: 'bg-accent-purple',
    title: 'text-accent-purple',
  },
  arreglado: {
    label: 'Arreglado',
    dot: 'bg-accent-green',
    title: 'text-accent-green',
  },
  mejorado: {
    label: 'Mejorado',
    dot: 'bg-accent-orange',
    title: 'text-accent-orange',
  },
}

function groupsFor(notes: Notes) {
  return NOTE_CATEGORIES.map((category) => ({
    category,
    items: notes.items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="notes.summary" class="text-body-sm text-ink-muted">{{ notes.summary }}</p>

    <div
      v-for="group in groupsFor(notes)"
      :key="group.category"
      :data-note-group="group.category"
      class="flex flex-col gap-1.5"
    >
      <div class="flex items-center gap-2">
        <span class="h-1.5 w-1.5 rounded-full" :class="GROUPS[group.category].dot"></span>
        <span class="text-caption font-medium" :class="GROUPS[group.category].title">
          {{ GROUPS[group.category].label }}
        </span>
      </div>

      <ul class="flex flex-col gap-1 pl-3.5">
        <li v-for="(item, index) in group.items" :key="index" class="text-body-sm text-ink">
          {{ item.text }}
        </li>
      </ul>
    </div>
  </div>
</template>
