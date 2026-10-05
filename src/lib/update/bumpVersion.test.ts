import { describe, expect, it } from 'vitest'
import { isValidVersion, replaceVersion } from './bumpVersion'

describe('isValidVersion', () => {
  it('acepta semver de tres componentes', () => {
    expect(isValidVersion('0.1.0')).toBe(true)
    expect(isValidVersion('1.2.3')).toBe(true)
    expect(isValidVersion('10.0.12')).toBe(true)
  })

  it('rechaza versiones de dos componentes', () => {
    expect(isValidVersion('0.1')).toBe(false)
    expect(isValidVersion('1')).toBe(false)
  })

  it('rechaza cualquier cosa que no sea semver estricto', () => {
    expect(isValidVersion('')).toBe(false)
    expect(isValidVersion('v1.0.0')).toBe(false)
    expect(isValidVersion('1.0.0.0')).toBe(false)
    expect(isValidVersion('1.0.0-beta.1')).toBe(false)
    expect(isValidVersion('basura')).toBe(false)
  })
})

describe('replaceVersion', () => {
  it('reemplaza la versión en package.json y preserva el resto', () => {
    const input = [
      '{',
      '  "name": "aeon",',
      '  "private": true,',
      '  "version": "1.0.0",',
      '  "type": "module"',
      '}',
      '',
    ].join('\n')
    const out = replaceVersion(input, 'package.json', '0.1.0')
    expect(out).toContain('"version": "0.1.0"')
    expect(out).not.toContain('1.0.0')
    expect(out).toContain('"name": "aeon"')
    expect(out).toContain('"private": true')
  })

  it('no toca las versiones de dependencias en package.json', () => {
    const input = [
      '{',
      '  "version": "1.0.0",',
      '  "dependencies": { "vue": "^3.5.13", "@tauri-apps/api": "^2" }',
      '}',
      '',
    ].join('\n')
    const out = replaceVersion(input, 'package.json', '0.1.0')
    expect(out).toContain('"vue": "^3.5.13"')
    expect(out).toContain('"@tauri-apps/api": "^2"')
    expect(out).toContain('"version": "0.1.0"')
  })

  it('reemplaza la versión en tauri.conf.json', () => {
    const input = [
      '{',
      '  "productName": "AEON",',
      '  "version": "1.0.0",',
      '  "identifier": "com.aeon"',
      '}',
      '',
    ].join('\n')
    const out = replaceVersion(input, 'tauri.conf.json', '0.1.0')
    expect(out).toContain('"version": "0.1.0"')
    expect(out).toContain('"productName": "AEON"')
    expect(out).toContain('"identifier": "com.aeon"')
  })

  it('en Cargo.toml solo toca la versión del paquete, no las de dependencias', () => {
    const input = [
      '[package]',
      'name = "aeon"',
      'version = "1.0.0"',
      'edition = "2021"',
      '',
      '[dependencies]',
      'tauri = { version = "2", features = [] }',
      'rusqlite = { version = "0.32", features = ["bundled"] }',
      '',
    ].join('\n')
    const out = replaceVersion(input, 'Cargo.toml', '0.1.0')
    expect(out).toContain('version = "0.1.0"')
    expect(out).toContain('tauri = { version = "2", features = [] }')
    expect(out).toContain('rusqlite = { version = "0.32", features = ["bundled"] }')
    expect(out).not.toContain('version = "1.0.0"')
  })
})
