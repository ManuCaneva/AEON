// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

const version = '1.2.3'
const manualEntry = `## ${version}\n\n- **Arreglado** — Texto revisado a mano\n`
let changelog: string | null
const argv = process.argv

async function generate() {
  // Import dinámico para ejecutar el mismo entrypoint que usa el workflow.
  const script = '../../../scripts/release-notes.mjs'
  await import(script)
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  changelog = manualEntry
  process.argv = ['node', 'release-notes.mjs', 'generate', '--commits', '/commits.txt']
  vi.stubEnv('RELEASE_NOTES_API_KEY', 'fake-key')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(existsSync).mockImplementation(() => changelog !== null)
  vi.mocked(readFileSync).mockImplementation((path) => {
    const name = String(path)
    if (name.endsWith('tauri.conf.json')) return JSON.stringify({ version })
    if (name.endsWith('CHANGELOG.md')) return changelog ?? ''
    if (name.endsWith('commits.txt')) return 'fix: recuperar el instalador de Windows'
    if (name.endsWith('release-notes-prompt.md')) return 'Redactá las novedades.'
    throw new Error(`Lectura inesperada: ${name}`)
  })
  vi.mocked(writeFileSync).mockImplementation((_path, content) => {
    changelog = String(content)
  })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: null,
                items: [{ category: 'arreglado', text: 'Volvé a instalar la app en Windows' }],
              }),
            },
          },
        ],
      }),
    })
  )
})

afterEach(() => {
  process.argv = argv
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('release-notes generate one-shot', () => {
  it.each([manualEntry, manualEntry.replace(/\n/g, '\r\n'), `## ${version} — 2026-10-27\n`])(
    'respeta una sección existente, incluso vacía, sin llamar a la IA',
    async (entry) => {
      changelog = entry
      await generate()
      expect(fetch).not.toHaveBeenCalled()
      expect(writeFileSync).not.toHaveBeenCalled()
      expect(changelog).toBe(entry)
    }
  )

  it.each([null, '', '## 1x2x3\n', `## ${version}-rc1\n`, '## 1.2.30\n'])(
    'genera si falta la versión exacta y no vuelve a escribir en la segunda ejecución',
    async (initial) => {
      changelog = initial
      await generate()
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(writeFileSync).toHaveBeenCalledTimes(1)
      expect(changelog).toContain(`## ${version} —`)

      vi.resetModules()
      await generate()
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(writeFileSync).toHaveBeenCalledTimes(1)
    }
  )
})
