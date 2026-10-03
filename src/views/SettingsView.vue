<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { useCalendarStore } from '@/stores/calendar'
import { useUiStore } from '@/stores/ui'
import type { TextSize } from '@/lib/textSize'
import GcalVisibilityCard from '@/components/calendar/GcalVisibilityCard.vue'
import WallpaperCard from '@/components/settings/WallpaperCard.vue'
import Card from '@/components/ui/Card.vue'
import Text from '@/components/ui/Text.vue'
import Heading from '@/components/ui/Heading.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'

const { current, currentId, themes, setTheme } = useTheme()
const store = useCalendarStore()
const ui = useUiStore()

const textSizeOptions: { id: TextSize; label: string }[] = [
  { id: 'small', label: 'Pequeño' },
  { id: 'medium', label: 'Mediano' },
  { id: 'large', label: 'Grande' },
]

const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}

function selectTheme(id: string) {
  setTheme(id)
  dropdownOpen.value = false
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', handleClickOutside))

const primaryColor = computed(() => `rgb(${current.value.colors.primary})`)

async function handleConnect() {
  try {
    await store.connect()
  } catch {
    // The store exposes the persistent connection error below the card.
  }
}

async function handleDisconnect() {
  await store.disconnect()
}
</script>

<template>
  <main
    data-testid="settings-view"
    class="scrollbar-gutter-stable mx-auto flex h-full max-w-2xl flex-col gap-8 overflow-y-auto px-6 py-12"
  >
    <header class="flex flex-col gap-1">
      <Text variant="eyebrow" color="subtle">Configuración</Text>
      <Heading>Settings</Heading>
    </header>

    <section class="flex flex-col gap-3">
      <Text variant="eyebrow" color="subtle">Apariencia</Text>
      <Card variant="default" padding="md">
        <div class="flex items-start justify-between gap-4">
          <div>
            <Text variant="card-title" as="h2" class="mb-1">Tema</Text>
            <Text variant="body-sm" color="muted"> Elegí el tema que más te guste. </Text>
          </div>
          <div ref="dropdownRef" class="relative">
            <button
              type="button"
              data-testid="theme-dropdown-btn"
              class="flex cursor-pointer items-center gap-2.5 rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-ink transition-colors duration-150 hover:border-hairline-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              @click="dropdownOpen = !dropdownOpen"
            >
              <span
                class="h-3 w-3 shrink-0 rounded-full"
                :style="{ backgroundColor: primaryColor }"
              />
              <span class="text-body-sm">{{ current.name }}</span>
              <ChevronDown
                :size="14"
                class="text-ink-subtle transition-transform duration-150"
                :class="dropdownOpen && 'rotate-180'"
              />
            </button>
            <div
              v-if="dropdownOpen"
              class="glass-overlay absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-lg py-1 shadow-xl"
            >
              <button
                v-for="t in themes"
                :key="t.id"
                type="button"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-body-sm text-ink transition-colors duration-100 hover:bg-surface-3"
                @click="selectTheme(t.id)"
              >
                <span
                  class="h-3 w-3 shrink-0 rounded-full"
                  :style="{ backgroundColor: `rgb(${t.colors.primary})` }"
                />
                <span class="min-w-0 flex-1 truncate">{{ t.name }}</span>
                <Check v-if="t.id === currentId" :size="14" class="shrink-0 text-primary" />
              </button>
            </div>
          </div>
        </div>
      </Card>
      <Card variant="default" padding="md">
        <div class="flex items-start justify-between gap-4">
          <div>
            <Text variant="card-title" as="h2" class="mb-1">Tamaño de letra</Text>
            <Text variant="body-sm" color="muted">
              Elegí qué tan grande se ve el texto en toda la app.
            </Text>
          </div>
          <div
            data-testid="text-size-group"
            role="group"
            aria-label="Tamaño de letra"
            class="flex shrink-0 items-center gap-1 rounded-md border border-hairline bg-surface-1 p-1"
          >
            <button
              v-for="opt in textSizeOptions"
              :key="opt.id"
              type="button"
              :aria-pressed="ui.textSize === opt.id"
              class="cursor-pointer rounded px-2.5 py-1 text-body-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              :class="
                ui.textSize === opt.id
                  ? 'bg-surface-3 text-ink'
                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
              "
              @click="ui.setTextSize(opt.id)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </Card>
      <WallpaperCard />
    </section>

    <section class="flex flex-col gap-3">
      <Text variant="eyebrow" color="subtle">Integraciones</Text>
      <Card variant="default" padding="md">
        <Text variant="card-title" as="h2" class="mb-2">Google Calendar</Text>
        <Text variant="body-sm" color="muted" class="mb-4">
          Conectá tu cuenta de Google para ver tus eventos en el calendario anual.
        </Text>
        <div class="flex flex-wrap items-center gap-3">
          <template v-if="!store.connected">
            <Button
              variant="primary"
              size="sm"
              :loading="store.oauthStatus === 'waiting'"
              data-testid="gcal-connect-btn"
              @click="handleConnect"
            >
              {{
                store.oauthStatus === 'waiting'
                  ? 'Esperando autorización en el navegador…'
                  : 'Conectar'
              }}
            </Button>
            <Button
              v-if="store.oauthStatus === 'waiting'"
              variant="secondary"
              size="sm"
              data-testid="gcal-cancel-btn"
              @click="store.cancelConnect"
            >
              Cancelar
            </Button>
            <Badge
              v-if="store.oauthStatus !== 'waiting'"
              variant="default"
              dot
              data-testid="gcal-status"
            >
              Not connected
            </Badge>
          </template>
          <template v-else>
            <Badge variant="success" dot data-testid="gcal-status">Connected</Badge>
            <Button
              variant="secondary"
              size="sm"
              data-testid="gcal-disconnect-btn"
              @click="handleDisconnect"
            >
              Desconectar
            </Button>
          </template>
        </div>
        <Text
          v-if="store.connectError"
          variant="caption"
          class="mt-3 font-mono font-medium text-accent-red"
        >
          Connection error: {{ store.connectError }}
        </Text>
        <Text
          v-if="store.syncError"
          variant="caption"
          class="mt-3 font-mono font-medium text-accent-red"
        >
          Sync error: {{ store.syncError }}
        </Text>
      </Card>
      <GcalVisibilityCard />
    </section>

    <section class="flex flex-col gap-3">
      <Text variant="eyebrow" color="subtle">Datos</Text>
      <Card variant="default" padding="md">
        <Text variant="card-title" as="h2" class="mb-2">Almacenamiento local</Text>
        <Text variant="body-sm" color="muted">
          Tus datos viven localmente en tu computadora. Para resetear la app, cerrala y borrá la
          carpeta
          <Text variant="body-sm" mono>~/.local/share/com.aeon/</Text>.
        </Text>
      </Card>
    </section>
  </main>
</template>
