export type VersionFileKind = 'package.json' | 'Cargo.toml' | 'tauri.conf.json'

const STRICT_SEMVER = /^\d+\.\d+\.\d+$/

/** Semver estricto de tres componentes (`0.1.0`). Rechaza `0.1`, `v1.0.0`, etc. */
export function isValidVersion(version: string): boolean {
  return STRICT_SEMVER.test(version)
}

/**
 * Devuelve el contenido de un archivo de versión con la versión reemplazada,
 * preservando el formato original (no re-serializa JSON).
 */
export function replaceVersion(content: string, kind: VersionFileKind, version: string): string {
  return kind === 'Cargo.toml'
    ? replaceCargoPackageVersion(content, version)
    : replaceJsonVersion(content, version)
}

/**
 * Reemplaza la primera clave `"version": "..."`. En `package.json` y en
 * `tauri.conf.json` es la versión del proyecto, que va antes que cualquier
 * versión de dependencia.
 */
function replaceJsonVersion(content: string, version: string): string {
  return content.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`)
}

/** Reemplaza la versión dentro de la sección `[package]` de un Cargo.toml. */
function replaceCargoPackageVersion(content: string, version: string): string {
  const lines = content.split('\n')
  let inPackage = false
  let replaced = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*\[/.test(line)) {
      inPackage = /^\s*\[package\]\s*$/.test(line)
      continue
    }
    if (inPackage && !replaced && /^\s*version\s*=/.test(line)) {
      lines[i] = line.replace(/=\s*"[^"]*"/, `= "${version}"`)
      replaced = true
      inPackage = false
    }
  }

  return lines.join('\n')
}
