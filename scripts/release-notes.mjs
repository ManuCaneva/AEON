#!/usr/bin/env node
// =============================================================
// scripts/release-notes.mjs — Novedades de la release
//
// Dos subcomandos:
//
//   generate  Redacta la sección de novedades de la versión actual con IA
//             (endpoint compatible con OpenAI, Gemini por defecto) a partir
//             de los commits del PR, y la deja en docs/CHANGELOG.md para
//             revisión humana en el diff.
//
//   extract   Compone el body de la release de GitHub a partir de esa
//             sección. Lo usa release.yml; cae en auto-notas de GitHub si
//             no hay sección.
//
// Uso:
//   node scripts/release-notes.mjs generate --commits commits.txt [--dry-run]
//   node scripts/release-notes.mjs extract [--github-output]
//
// La IA solo redacta; el formato lo decide el prompt en
// scripts/release-notes-prompt.md y la validación dura en
// src/lib/update/notes.ts (validateNotes). Si la IA se desvía se reintenta
// una vez con los errores; si insiste se comenta en el PR y jamás se
// bloquea el merge. Sin RELEASE_NOTES_API_KEY se omite la redacción y la
// release usa auto-notas de GitHub.
// =============================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filterReleaseCommits } from '../src/lib/update/releaseCommits.ts'
import { validateNotes } from '../src/lib/update/notes.ts'
import {
  buildVersionEntry,
  extractVersionBody,
  extractVersionEntry,
  upsertVersionEntry,
} from '../src/lib/update/changelog.ts'
import { composeReleaseBody } from '../src/lib/update/releaseBody.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROMPT_PATH = resolve(root, 'scripts/release-notes-prompt.md')
const CHANGELOG_PATH = resolve(root, 'docs/CHANGELOG.md')
const TAURI_CONF_PATH = resolve(root, 'src-tauri/tauri.conf.json')

const AI_URL =
  process.env.RELEASE_NOTES_API ??
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const AI_MODEL = process.env.RELEASE_NOTES_MODEL ?? 'gemini-3.8-flash'

function readVersion() {
  return JSON.parse(readFileSync(TAURI_CONF_PATH, 'utf8')).version
}

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i === -1 ? null : (process.argv[i + 1] ?? null)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

// ---------- IA ----------

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('la respuesta no trae JSON')
  return JSON.parse(candidate.slice(start, end + 1))
}

async function callAi(messages) {
  const token = process.env.RELEASE_NOTES_API_KEY
  if (!token) throw new Error('RELEASE_NOTES_API_KEY no está definida')

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    throw new Error(`la IA respondió ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  const payload = await res.json()
  return payload.choices?.[0]?.message?.content ?? ''
}

async function commentOnPullRequest(body) {
  const { GITHUB_PR_NUMBER: pr, GITHUB_REPOSITORY: repo, GITHUB_TOKEN: token } = process.env
  if (!pr || !repo || !token) {
    console.error(`(sin PR para comentar) ${body}`)
    return
  }

  await fetch(`https://api.github.com/repos/${repo}/issues/${pr}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  })
}

async function redactNotes(version, subjects) {
  const prompt = readFileSync(PROMPT_PATH, 'utf8')
  const user = [
    `Commits de la versión ${version} (subjects de commits convencionales):`,
    ...subjects.map((s) => `- ${s}`),
  ].join('\n')

  let notes = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    const extra =
      attempt === 1
        ? ''
        : `\n\nTu JSON anterior no pasó la validación:\n${notes.errors
            .map((e) => `- ${e}`)
            .join('\n')}\nCorregilo y devolvé solo el JSON.`

    const content = await callAi([
      { role: 'system', content: prompt },
      { role: 'user', content: user + extra },
    ])

    let result
    try {
      result = validateNotes(extractJson(content))
    } catch (error) {
      result = { ok: false, errors: [`respuesta ilegible: ${error.message}`] }
    }
    if (result.ok) return result.notes
    notes = result
  }

  throw new Error(
    `la IA no produjo notas válidas:\n${notes.errors.map((e) => `- ${e}`).join('\n')}`
  )
}

// ---------- generate ----------

async function generate() {
  const commitsPath = argValue('--commits')
  if (!commitsPath) fail('Uso: generate --commits <archivo de subjects>')

  const version = readVersion()
  const changelog = existsSync(CHANGELOG_PATH) ? readFileSync(CHANGELOG_PATH, 'utf8') : ''
  if (extractVersionEntry(changelog, version) !== null) {
    console.log(`docs/CHANGELOG.md ya tiene la sección de ${version}: no se regenera.`)
    return
  }

  const subjects = readFileSync(resolve(commitsPath), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
  const releaseSubjects = filterReleaseCommits(subjects)

  if (releaseSubjects.length === 0) {
    console.log(
      'Sin commits visibles para el usuario (solo cambios internos): no se toca el changelog.'
    )
    return
  }

  if (!process.env.RELEASE_NOTES_API_KEY) {
    console.log(
      'Sin RELEASE_NOTES_API_KEY: se omite la redacción de novedades. La release usará auto-notas de GitHub.'
    )
    return
  }

  const date = new Date().toISOString().slice(0, 10)
  const dryRun = process.argv.includes('--dry-run')

  let notes
  try {
    notes = await redactNotes(version, releaseSubjects)
  } catch (error) {
    console.error(`No se generaron novedades: ${error.message}`)
    if (!dryRun) {
      await commentOnPullRequest(
        `⚠️ No pude generar las novedades de la release \`${version}\`:\n\n> ${error.message}\n\n` +
          'Podés escribir la sección a mano en `docs/CHANGELOG.md` (formato: `- **Nuevo** — texto`).'
      )
    }
    return
  }

  const entry = buildVersionEntry(version, date, notes)
  console.log(entry)

  if (dryRun) {
    console.log('\n(dry-run: no se escribió docs/CHANGELOG.md)')
    return
  }

  writeFileSync(CHANGELOG_PATH, upsertVersionEntry(changelog, entry) + '\n')
  console.log('docs/CHANGELOG.md actualizado')
}

// ---------- extract ----------

function extract() {
  const version = readVersion()
  const changelog = existsSync(CHANGELOG_PATH) ? readFileSync(CHANGELOG_PATH, 'utf8') : ''
  const sectionBody = extractVersionBody(changelog, version)
  const { body, generateReleaseNotes } = composeReleaseBody(sectionBody)

  if (process.argv.includes('--github-output')) {
    // Formato de GITHUB_OUTPUT para valores multilínea.
    console.log('body<<AEON_NOTES_EOF')
    console.log(body)
    console.log('AEON_NOTES_EOF')
    console.log(`generate=${generateReleaseNotes}`)
    return
  }

  if (sectionBody == null) {
    console.log(`docs/CHANGELOG.md no tiene sección para ${version}: se usan auto-notas de GitHub.`)
  } else {
    console.log(`Sección de ${version} encontrada en docs/CHANGELOG.md.`)
  }
  console.log(`generateReleaseNotes=${generateReleaseNotes}`)
  console.log(`\n${body}`)
}

// ---------- main ----------

const command = process.argv[2]
if (command === 'generate') {
  await generate()
} else if (command === 'extract') {
  extract()
} else {
  fail(
    'Uso: node scripts/release-notes.mjs <generate --commits archivo | extract [--github-output]>'
  )
}
