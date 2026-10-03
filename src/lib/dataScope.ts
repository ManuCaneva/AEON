// =============================================================
// lib/dataScope.ts — Alcance "datos vs configuración" de la
// acción «Borrar datos».
//
// Frontera (definida y testada en TypeScript):
//   · Datos (se borra): las tablas de contenido que el usuario crea
//     y sus derivados + las claves de config que guardan datos.
//   · Configuración (no se toca): cómo se comporta la app.
//
// El borrado real lo ejecuta la capa de persistencia (Rust);
// este módulo solo DEFINE qué entra en cada lado. La
// preferencias de UI (vista activa, barra lateral) viven en
// localStorage y nunca se tocan, por lo que se conservan por
// construcción.
// =============================================================

// Tablas de contenido que se vacían por completo. El orden va de hijos a
// padres para respetar las claves foráneas al borrar.
export const DATA_TABLES = [
  'habit_logs',
  'habits',
  'goal_logs',
  'goals',
  'tasks',
  'notes',
  'schedule_block_slots',
  'schedule_blocks',
] as const

// Claves de la tabla `config` que almacenan DATOS (se borran):
// eventos locales del calendario y sesión transitoria del Pomodoro.
export const DATA_CONFIG_KEYS = ['local-calendar-events', 'pomodoro-session'] as const

// Claves de la tabla `config` que almacenan CONFIGURACIÓN (se conservan):
// distribución de Widgets, conexión y tokens de Google Calendar,
// wallpaper, ajustes del cronograma y del Pomodoro, y la marca de
// primera ejecución.

// Marca persistente de "ya se sembraron los datos de ejemplo": la siembra
// ocurre como máximo una vez en la vida de la instalación.
export const SEED_MARKER_KEY = 'aeon-seed-done'

export const PRESERVED_CONFIG_KEYS = [
  'aeon-dashboard-layout',
  SEED_MARKER_KEY,
  'gcal-visible-calendars',
  'gcal_access_token',
  'gcal_pending_oauth',
  'gcal_refresh_token',
  'gcal_token_expiry',
  'pomodoro-settings',
  'wallpaper-settings',
  'weekly-schedule-settings',
] as const
