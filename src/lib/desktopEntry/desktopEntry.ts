/**
 * Utilidades puras para registrar AEON en el menú de aplicaciones de Linux.
 *
 * El AppImage no viene registrado: no tiene icono, no se puede anclar y el
 * nombre del archivo arrastra la versión. Estas funciones generan el `.desktop`
 * estable y resuelven las rutas destino. No tocan el sistema de archivos: de
 * eso se encarga `useDesktopEntry`.
 */

/** Nombre estable del AppImage, sin versión, para que el updater no lo pise. */
export const APPIMAGE_FILENAME = 'aeon.AppImage'

/** Carpeta destino del AppImage dentro del home del usuario. */
export const APPIMAGE_DIR = 'Applications'

/** Nombre del archivo de entrada del menú de aplicaciones. */
export const DESKTOP_ENTRY_FILENAME = 'aeon.desktop'

/** Nombre del icono; la clave `Icon=` lo referencia sin extensión. */
export const ICON_FILENAME = 'aeon.png'

/** Caché derivada del tema hicolor; se borra para forzar que se re-escanee. */
export const ICON_THEME_CACHE_FILENAME = 'icon-theme.cache'

/** Une segmentos garantizando un único separador (Linux). */
function joinPath(base: string, ...parts: string[]): string {
  const trimmedBase = base.replace(/\/+$/, '')
  const tail = parts.join('/').replace(/^\/+/, '')
  return `${trimmedBase}/${tail}`
}

/** Carpeta donde vive el AppImage estable (`~/Applications`). */
export function stableAppImageDir(homeDir: string): string {
  return joinPath(homeDir, APPIMAGE_DIR)
}

/** Ruta estable del AppImage (`~/Applications/aeon.AppImage`). */
export function stableAppImagePath(homeDir: string): string {
  return joinPath(homeDir, APPIMAGE_DIR, APPIMAGE_FILENAME)
}

/** Carpeta de entradas del menú por usuario. */
export function desktopEntryDir(homeDir: string): string {
  return joinPath(homeDir, '.local', 'share', 'applications')
}

/** Ruta del `.desktop` por usuario. */
export function desktopEntryPath(homeDir: string): string {
  return joinPath(desktopEntryDir(homeDir), DESKTOP_ENTRY_FILENAME)
}

/** Raíz del tema de iconos hicolor por usuario. */
export function iconThemeDir(homeDir: string): string {
  return joinPath(homeDir, '.local', 'share', 'icons', 'hicolor')
}

/** Carpeta del icono 256x256 en el tema hicolor. */
export function iconDir(homeDir: string): string {
  return joinPath(iconThemeDir(homeDir), '256x256', 'apps')
}

/** Ruta del icono que referencia `Icon=aeon`. */
export function iconPath(homeDir: string): string {
  return joinPath(iconDir(homeDir), ICON_FILENAME)
}

/**
 * Caché derivada del tema hicolor. Si existe y no conoce `aeon`, el entorno
 * puede ignorar el icono: se borra para forzar un re-escaneo.
 */
export function iconThemeCachePath(homeDir: string): string {
  return joinPath(iconThemeDir(homeDir), ICON_THEME_CACHE_FILENAME)
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

/** Compara rutas ignorando slashes finales (Linux es case-sensitive). */
export function isSamePath(a: string, b: string): boolean {
  return stripTrailingSlash(a) === stripTrailingSlash(b)
}

/** Caracteres reservados en la clave `Exec=` según el spec de freedesktop. */
const EXEC_RESERVED = /[\s"'\\<>~|&;$*?#()`]/

/**
 * Prepara un argumento de `Exec=`: cita la ruta si contiene caracteres
 * reservados y escapa lo que el spec exige dentro de comillas.
 */
export function escapeExecArgument(path: string): string {
  const escapedFieldCodes = path.replace(/%/g, '%%')
  if (!EXEC_RESERVED.test(path)) return escapedFieldCodes
  return `"${escapedFieldCodes.replace(/([\\"`$])/g, '\\$1')}"`
}

/** Genera el contenido del `.desktop` apuntando al AppImage real. */
export function buildDesktopEntryContent(execPath: string): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=AEON',
    'Comment=AEON productivity dashboard',
    `Exec=${escapeExecArgument(execPath)}`,
    'Icon=aeon',
    'Terminal=false',
    'Categories=Utility;',
    '',
  ].join('\n')
}
