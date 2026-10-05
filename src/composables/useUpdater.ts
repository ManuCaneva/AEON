import { ref, shallowRef } from 'vue'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { openUrl } from '@tauri-apps/plugin-opener'
import { isNewerVersion } from '@/lib/update/semver'

/** Versión que el usuario silenció, para no volver a ofrecerla en cada arranque. */
const DISMISSED_KEY = 'aeon.updater.dismissed'

/** Página de descargas: destino del fallback cuando el update in-app no puede escribir. */
const RELEASES_URL = 'https://github.com/ManuCaneva/AEON/releases/latest'

export type UpdateStatus = 'idle' | 'available' | 'downloading' | 'error'

function readDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    // En entornos sin localStorage no hay nada silenciado.
    return null
  }
}

function writeDismissedVersion(version: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, version)
  } catch {
    // Si no se puede persistir, la versión se vuelve a ofrecer la próxima vez.
  }
}

/**
 * Chequea si hay una versión nueva y la aplica cuando el usuario lo pide.
 *
 * `enabled` permite desactivarlo: en desarrollo el updater no funciona, así que
 * por defecto solo corre en builds de producción. Nunca lanza: un chequeo roto
 * no puede afectar el arranque de la app.
 */
export function useUpdater(enabled: boolean = import.meta.env.PROD) {
  const status = ref<UpdateStatus>('idle')
  const version = ref<string | null>(null)
  const progress = ref<number | null>(null)
  const pending = shallowRef<Update | null>(null)

  /** Una versión silenciada se oculta salvo que aparezca una más nueva. */
  function isDismissed(candidate: string): boolean {
    const dismissed = readDismissedVersion()
    return dismissed != null && !isNewerVersion(candidate, dismissed)
  }

  async function closeQuietly(update: Update): Promise<void> {
    try {
      await update.close()
    } catch {
      // Cerrar el handle es best-effort.
    }
  }

  async function openReleases(): Promise<void> {
    try {
      await openUrl(RELEASES_URL)
    } catch {
      // Si tampoco se puede abrir el navegador, no queda nada más que hacer.
    }
  }

  async function checkForUpdate(): Promise<void> {
    if (!enabled) return

    try {
      const found = await check()
      if (!found) return

      if (isDismissed(found.version)) {
        await closeQuietly(found)
        return
      }

      pending.value = found
      version.value = found.version
      status.value = 'available'
    } catch {
      // Silencioso a propósito: sin red o sin latest.json la app arranca igual.
    }
  }

  async function update(): Promise<void> {
    const current = pending.value
    if (!current) return

    status.value = 'downloading'
    progress.value = null

    let total = 0
    let downloaded = 0

    try {
      await current.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
          progress.value = total > 0 ? 0 : null
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          progress.value = total > 0 ? Math.min(downloaded / total, 1) : null
        } else if (event.event === 'Finished') {
          progress.value = 1
        }
      })
      await relaunch()
    } catch {
      // Caso típico: instalación en una ruta sin permisos de escritura (AUR,
      // /usr/bin). Degradamos a la descarga manual en vez de dejar al usuario
      // con un error sin salida.
      status.value = 'error'
      await openReleases()
    }
  }

  function dismiss(): void {
    const current = pending.value
    if (current) void closeQuietly(current)
    pending.value = null
    status.value = 'idle'
  }

  function dismissForever(): void {
    if (version.value) writeDismissedVersion(version.value)
    dismiss()
  }

  return {
    status,
    version,
    progress,
    checkForUpdate,
    update,
    dismiss,
    dismissForever,
  }
}
