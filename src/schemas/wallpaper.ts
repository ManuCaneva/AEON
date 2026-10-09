import { z } from 'zod'

const imageDataUrl = z
  .string()
  .regex(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/,
    'debe ser una data URL de imagen base64'
  )

export const WallpaperSettingsSchema = z.object({
  dataUrl: imageDataUrl.nullable().default(null),
  // Preset empaquetado (src/assets/wallpapers). Excluyente con dataUrl:
  // el preset reemplaza al custom y viceversa; null = sin fondo.
  presetId: z.string().min(1).nullable().default(null),
  // Translucidez de los widgets del dashboard (glass-soft): 1 = opaco.
  widgetGlassAlpha: z.number().min(0.5).max(1).default(0.8),
})
export type WallpaperSettings = z.infer<typeof WallpaperSettingsSchema>

export const defaultWallpaperSettings: WallpaperSettings = WallpaperSettingsSchema.parse({})

export function parseWallpaperSettingsJson(raw: string | null | undefined): WallpaperSettings {
  if (!raw) return defaultWallpaperSettings
  try {
    const parsed = WallpaperSettingsSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return defaultWallpaperSettings
    return {
      dataUrl: parsed.data.dataUrl,
      presetId: parsed.data.presetId,
      widgetGlassAlpha: parsed.data.widgetGlassAlpha,
    }
  } catch {
    return defaultWallpaperSettings
  }
}
