#!/usr/bin/env node
// =============================================================
// scripts/bump-version.mjs — Bump de versión en los tres archivos
//
// La versión vive en package.json, src-tauri/Cargo.toml y
// src-tauri/tauri.conf.json. El updater lee la de tauri.conf.json,
// y el workflow usa `tagName: v__VERSION__`, así que si se
// desincronizan la actualización automática falla en silencio.
//
// Este script los mueve juntos o no mueve ninguno.
//
// Uso:
//   npm run release:bump -- 0.1.0
// =============================================================

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isValidVersion, replaceVersion } from '../src/lib/update/bumpVersion.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const raw = process.argv[2]
if (!raw) {
  console.error('Uso: npm run release:bump -- <version>   (ej. 0.1.0)')
  process.exit(1)
}

const version = raw.replace(/^v/, '')
if (!isValidVersion(version)) {
  console.error(`Versión inválida: "${raw}". Se espera semver de tres componentes (ej. 0.1.0).`)
  process.exit(1)
}

const targets = [
  { kind: 'package.json', path: resolve(root, 'package.json') },
  { kind: 'Cargo.toml', path: resolve(root, 'src-tauri/Cargo.toml') },
  { kind: 'tauri.conf.json', path: resolve(root, 'src-tauri/tauri.conf.json') },
]

const updates = targets.map((target) => {
  const before = readFileSync(target.path, 'utf8')
  const after = replaceVersion(before, target.kind, version)
  if (after === before) {
    console.error(
      `No se pudo actualizar ${target.kind}: la versión no cambió (¿ya estaba en ${version}?).`
    )
    process.exit(1)
  }
  return { ...target, after }
})

for (const update of updates) {
  writeFileSync(update.path, update.after)
  console.log(`  ${update.kind} → ${version}`)
}

console.log(`\nVersión actualizada a ${version} en los tres archivos.`)
