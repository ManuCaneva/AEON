<script setup lang="ts">
export interface TooltipEvent {
  id: string
  title: string
  color: string
}

withDefaults(
  defineProps<{
    dateLabel: string
    events: TooltipEvent[]
    overflowCount?: number
    position: { top: number; left: number }
  }>(),
  {
    overflowCount: 0,
  }
)
</script>

<template>
  <Teleport to="body">
    <div
      data-testid="day-tooltip"
      role="tooltip"
      class="day-tooltip glass-overlay animate-fade-in rounded-lg px-3 py-2 shadow-xl"
      :style="{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 60,
      }"
    >
      <p class="day-tooltip__date text-caption font-semibold capitalize text-ink">
        {{ dateLabel }}
      </p>
      <ul v-if="events.length > 0" class="day-tooltip__list">
        <li
          v-for="evt in events"
          :key="evt.id"
          class="day-tooltip__item"
          data-testid="day-tooltip-item"
        >
          <span
            class="day-tooltip__dot"
            data-testid="day-tooltip-dot"
            :style="{ backgroundColor: evt.color }"
          />
          <span class="day-tooltip__title">{{ evt.title }}</span>
        </li>
      </ul>
      <p v-else class="day-tooltip__empty text-caption text-ink-subtle">Sin eventos</p>
      <p v-if="overflowCount > 0" class="day-tooltip__more text-caption text-ink-tertiary">
        +{{ overflowCount }} más
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
.day-tooltip {
  max-width: 220px;
  pointer-events: none;
}

.day-tooltip__date {
  margin-bottom: 4px;
  line-height: 1.3;
}

.day-tooltip__list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.day-tooltip__item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.day-tooltip__dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.day-tooltip__title {
  font-size: 12px;
  line-height: 1.4;
  color: rgb(var(--color-ink-muted));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.day-tooltip__empty {
  line-height: 1.4;
}

.day-tooltip__more {
  margin-top: 3px;
  line-height: 1.2;
}
</style>
