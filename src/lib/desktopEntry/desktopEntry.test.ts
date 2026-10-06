import { describe, expect, it } from 'vitest'
import {
  buildDesktopEntryContent,
  desktopEntryDir,
  desktopEntryPath,
  escapeExecArgument,
  iconDir,
  iconPath,
  isSamePath,
  stableAppImageDir,
  stableAppImagePath,
} from './desktopEntry'

describe('desktopEntry', () => {
  describe('rutas destino', () => {
    it('arma las rutas estables dentro del home', () => {
      expect(stableAppImageDir('/home/ana')).toBe('/home/ana/Applications')
      expect(stableAppImagePath('/home/ana')).toBe('/home/ana/Applications/aeon.AppImage')
      expect(desktopEntryDir('/home/ana')).toBe('/home/ana/.local/share/applications')
      expect(desktopEntryPath('/home/ana')).toBe('/home/ana/.local/share/applications/aeon.desktop')
      expect(iconDir('/home/ana')).toBe('/home/ana/.local/share/icons/hicolor/256x256/apps')
      expect(iconPath('/home/ana')).toBe(
        '/home/ana/.local/share/icons/hicolor/256x256/apps/aeon.png'
      )
    })

    it('tolera slashes finales en el home', () => {
      expect(stableAppImagePath('/home/ana/')).toBe('/home/ana/Applications/aeon.AppImage')
    })
  })

  describe('escapeExecArgument', () => {
    it('no cita una ruta sin caracteres reservados', () => {
      expect(escapeExecArgument('/home/ana/Applications/aeon.AppImage')).toBe(
        '/home/ana/Applications/aeon.AppImage'
      )
    })

    it('cita una ruta con espacios', () => {
      expect(escapeExecArgument('/home/ana/Mis Apps/aeon.AppImage')).toBe(
        '"/home/ana/Mis Apps/aeon.AppImage"'
      )
    })

    it('escapa comillas y backslashes dentro de las comillas', () => {
      expect(escapeExecArgument('/home/a b/c"d\\e')).toBe('"/home/a b/c\\"d\\\\e"')
    })
  })

  describe('buildDesktopEntryContent', () => {
    it('incluye las claves requeridas por el menú de aplicaciones', () => {
      const content = buildDesktopEntryContent('/home/ana/Applications/aeon.AppImage')
      expect(content).toContain('[Desktop Entry]')
      expect(content).toContain('Type=Application')
      expect(content).toContain('Name=AEON')
      expect(content).toContain('Icon=aeon')
      expect(content).toContain('Terminal=false')
      expect(content).toContain('Exec=/home/ana/Applications/aeon.AppImage')
    })

    it('cita el Exec cuando la ruta tiene espacios', () => {
      const content = buildDesktopEntryContent('/home/ana/Mis Apps/aeon.AppImage')
      expect(content).toContain('Exec="/home/ana/Mis Apps/aeon.AppImage"')
    })
  })

  describe('isSamePath', () => {
    it('ignora el slash final', () => {
      expect(isSamePath('/a/aeon.AppImage', '/a/aeon.AppImage/')).toBe(true)
    })

    it('distingue rutas distintas', () => {
      expect(isSamePath('/a/aeon.AppImage', '/a/otro.AppImage')).toBe(false)
    })
  })
})
