import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as db from '@/lib/db'
import {
  CreateNoteDraftSchema,
  rowToNote,
  type Note,
  type CreateNoteDraft,
  type UpdateNoteDraft,
} from '@/schemas/notes'

function nowIsoUtc(): string {
  return new Date().toISOString()
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const loading = ref(false)
  const lastError = ref<string | null>(null)

  /** Vacía el contenido en memoria (notas). Para «Borrar datos». */
  function reset(): void {
    notes.value = []
    lastError.value = null
  }

  async function loadNotes(): Promise<void> {
    loading.value = true
    lastError.value = null
    try {
      const rows = await db.listNotes()
      notes.value = rows.map(rowToNote)
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function createNote(draft: CreateNoteDraft): Promise<Note> {
    const validated = CreateNoteDraftSchema.parse(draft)
    const now = nowIsoUtc()
    const id = crypto.randomUUID()
    const row = await db.createNote(validated, id, now, now)
    const note = rowToNote(row)
    // Última creada primero (Q5).
    notes.value = [note, ...notes.value]
    return note
  }

  async function updateNote(id: string, patch: UpdateNoteDraft): Promise<Note> {
    const current = notes.value.find((n) => n.id === id)
    if (!current) throw new Error(`Nota no encontrada: ${id}`)

    const merged = {
      title: patch.title !== undefined ? patch.title : current.title,
      description: patch.description !== undefined ? patch.description : current.description,
      color: patch.color !== undefined ? patch.color : current.color,
    }

    // Regla de dominio: la nota no puede quedar sin contenido (Q9-a).
    if (!merged.title && !merged.description) {
      throw new Error('La nota necesita título o descripción')
    }

    // A la db va solo el patch: los campos ausentes los preserva Rust (COALESCE).
    const row = await db.updateNote(id, patch, nowIsoUtc())
    const note = rowToNote(row)
    // Editar no reordena (Q5).
    notes.value = notes.value.map((n) => (n.id === id ? note : n))
    return note
  }

  async function deleteNote(id: string): Promise<void> {
    await db.deleteNote(id)
    notes.value = notes.value.filter((n) => n.id !== id)
  }

  return {
    notes,
    loading,
    lastError,
    reset,
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
  }
})
