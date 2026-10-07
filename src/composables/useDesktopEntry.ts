import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { mkdir, remove, rename, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import iconUrl from '@/assets/logo/logo-mark-256.png'
import {
  buildDesktopEntryContent,
  desktopEntryDir,
  desktopEntryPath,
  iconDir,
  iconPath,
  iconThemeCachePath,
  isSamePath,
  stableAppImageDir,
  stableAppImagePath,
} from '@/lib/desktopEntry/desktopEntry'

/**
 * Registra AEON en el menú de aplicaciones de Linux cuando corre como AppImage.
 *
 * La entrada `.desktop`, el icono y la caché del tema se re-escriben (o
 * invalidan) en cada arranque, de forma idempotente: si el usuario borra
 * accesos o mueve el archivo, el próximo arranque se auto-repara. Es silencioso
 * a propósito: un fallo de escritura no puede afectar el inicio de la app. Solo
 * corre en builds de producción.
 */
export function useDesktopEntry(enabled: boolean = import.meta.env.PROD) {
  async function readIconBytes(): Promise<Uint8Array> {
    const response = await fetch(iconUrl)
    return new Uint8Array(await response.arrayBuffer())
  }

  /**
   * Borra la caché derivada del tema hicolor para forzar a que el entorno
   * vuelva a escanear los iconos y encuentre `aeon`. Es best-effort: que la
   * caché no exista es lo normal y no debe interrumpir el registro.
   */
  async function invalidateIconThemeCache(home: string): Promise<void> {
    try {
      await remove(iconThemeCachePath(home))
    } catch {
      // Sin caché previa no hay nada que invalidar.
    }
  }

  /**
   * Escribe el icono (y limpia su caché) antes de crear el `.desktop`: si el
   * lanzador apareciera primero, el entorno podría cachear una entrada sin
   * icono y el icono no se vería hasta reiniciar la sesión.
   *
   * Si falla, se registra pero no se propaga: el acceso al menú sigue siendo
   * más importante que el icono.
   */
  async function writeIcon(home: string): Promise<void> {
    try {
      await mkdir(iconDir(home), { recursive: true })
      await writeFile(iconPath(home), await readIconBytes())
      await invalidateIconThemeCache(home)
    } catch (error) {
      console.error('[desktop-entry] no se pudo escribir el icono', error)
    }
  }

  /**
   * Asegura el AppImage estable y la entrada del menú.
   *
   * Devuelve `true` si movió el AppImage en este arranque: en ese caso el
   * updater no debe correr (todavía tiene en memoria la ruta vieja).
   */
  async function ensureDesktopEntry(): Promise<boolean> {
    if (!enabled) return false

    let renamed = false

    try {
      const appImagePath = await invoke<string | null>('app_image_path')
      // Sin `$APPIMAGE` no es un AppImage (dev, .deb/.rpm, Windows): no hay nada que registrar.
      if (!appImagePath) return false

      const home = await homeDir()
      const stablePath = stableAppImagePath(home)
      let execPath = appImagePath

      if (!isSamePath(appImagePath, stablePath)) {
        try {
          await mkdir(stableAppImageDir(home), { recursive: true })
          await rename(appImagePath, stablePath)
          execPath = stablePath
          renamed = true
        } catch (error) {
          // No se pudo mover (p. ej. cruza sistemas de archivos): seguimos
          // apuntando al path real para no dejar una entrada rota.
          console.error('[desktop-entry] no se pudo mover el AppImage', error)
        }
      }

      await writeIcon(home)

      await mkdir(desktopEntryDir(home), { recursive: true })
      await writeTextFile(desktopEntryPath(home), buildDesktopEntryContent(execPath))
    } catch (error) {
      console.error('[desktop-entry] registro silencioso fallido', error)
    }

    return renamed
  }

  return { ensureDesktopEntry }
}
