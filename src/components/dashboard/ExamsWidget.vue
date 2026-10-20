<script setup lang="ts">
import Container from '@/components/ui/Container.vue'
import ExamsListView from '@/views/ExamsListView.vue'
</script>

<template>
  <Container
    data-testid="exams-widget"
    variant="default"
    glass
    padding="none"
    class="container-widget h-full overflow-hidden"
    style="container-type: inline-size"
  >
    <ExamsListView :show-eyebrow="false" />
  </Container>
</template>
