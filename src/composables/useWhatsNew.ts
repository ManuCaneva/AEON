import { ref, shallowRef } from 'vue'
import { validateNotes, type ReleaseNotes } from '@/lib/update/notes'

// =============================================================
// useWhatsNew — Novedades post-actualización
//
// Cuando el usuario aplica una actualización, se guardan las notas de
// la versión nueva justo antes del relaunch. En el próximo arranque se
// muestran una sola vez: "Novedades de la versión X".
//
// Sin API de GitHub: el dato viene de latest.json.notes vía Update.body
// y viaja por localStorage hasta el próximo arranque.
// =============================================================

/** Notas pendientes de mostrar tras una actualización. */
export const PENDING_KEY = 'aeon.whatsnew.pending'

/** Última versión cuyas novedades ya se mostraron. */
export const SEEN_KEY = 'aeon.whatsnew.seen'

interface PendingWhatsNew {
  version: string
  notes: ReleaseNotes
}

function readPending(): PendingWhatsNew | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (raw == null) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed == null) return null

    const { version, notes } = parsed as Record<string, unknown>
    if (typeof version !== 'string' || version === '') return null

    const validated = validateNotes(notes)
    if (!validated.ok) return null

    return { version, notes: validated.notes }
  } catch {
    return null
  }
}

function writePending(pending: PendingWhatsNew): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    // Sin localStorage no hay novedades que mostrar: el usuario vio el
    // modal previo a la actualización de todas formas.
  }
}

function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // Best-effort.
  }
}

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function writeSeen(version: string): void {
  try {
    localStorage.setItem(SEEN_KEY, version)
  } catch {
    // Si no persiste, se vuelve a mostrar una vez más: no es grave.
  }
}

/**
 * Guarda las novedades para el próximo arranque. Llamar solo cuando la
 * actualización se aplicó (justo antes del relaunch).
 */
export function savePendingWhatsNew(version: string, notes: ReleaseNotes): void {
  writePending({ version, notes })
}

/**
 * Estado reactivo de las novedades post-actualización. `checkPending()`
 * se llama al arrancar; si hay algo que mostrar, expone la versión y
 * las notas hasta que `close()` marque la versión como vista.
 */
export function useWhatsNew() {
  const visible = ref(false)
  const version = ref<string | null>(null)
  const notes = shallowRef<ReleaseNotes | null>(null)

  function checkPending(): void {
    const pending = readPending()

    if (pending == null || pending.notes.items.length === 0) {
      clearPending()
      return
    }

    if (readSeen() === pending.version) {
      clearPending()
      return
    }

    version.value = pending.version
    notes.value = pending.notes
    visible.value = true
  }

  function close(): void {
    if (version.value) writeSeen(version.value)
    clearPending()
    visible.value = false
    version.value = null
    notes.value = null
  }

  return { visible, version, notes, checkPending, close }
}
