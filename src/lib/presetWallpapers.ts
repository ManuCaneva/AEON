import fondo01Url from '@/assets/wallpapers/fondo-01.jpg'
import fondo02Url from '@/assets/wallpapers/fondo-02.jpg'
import fondo03Url from '@/assets/wallpapers/fondo-03.jpg'
import fondo04Url from '@/assets/wallpapers/fondo-04.jpg'
import fondo05Url from '@/assets/wallpapers/fondo-05.jpg'
import fondo06Url from '@/assets/wallpapers/fondo-06.jpg'

export interface PresetWallpaper {
  id: string
  label: string
  url: string
}

export const PRESET_WALLPAPERS: readonly PresetWallpaper[] = [
  { id: 'fondo-01', label: 'Fondo 1', url: fondo01Url },
  { id: 'fondo-02', label: 'Fondo 2', url: fondo02Url },
  { id: 'fondo-03', label: 'Fondo 3', url: fondo03Url },
  { id: 'fondo-04', label: 'Fondo 4', url: fondo04Url },
  { id: 'fondo-05', label: 'Fondo 5', url: fondo05Url },
  { id: 'fondo-06', label: 'Fondo 6', url: fondo06Url },
]

const byId = new Map(PRESET_WALLPAPERS.map((preset) => [preset.id, preset]))

export function isPresetWallpaperId(id: unknown): id is string {
  return typeof id === 'string' && byId.has(id)
}

export function presetWallpaperUrl(id: string | null | undefined): string | null {
  if (!isPresetWallpaperId(id)) return null
  return byId.get(id)?.url ?? null
}
