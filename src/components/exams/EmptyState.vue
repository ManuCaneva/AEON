<script setup lang="ts">
import { GraduationCap } from 'lucide-vue-next'
import Text from '@/components/ui/Text.vue'
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
    <span
      class="flex h-12 w-12 items-center justify-center rounded-full bg-accent-purple-tint text-accent-purple"
      aria-hidden="true"
    >
      <GraduationCap :size="22" :stroke-width="1.75" />
    </span>
    <div class="flex flex-col gap-1">
      <Text variant="body" weight="500">No hay exámenes</Text>
      <Text variant="body-sm" color="muted">
        Agregá un examen para no perderte ninguna fecha.
      </Text>
    </div>
  </div>
</template>
