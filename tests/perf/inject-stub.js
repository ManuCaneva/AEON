// =============================================================
// tests/perf/inject-stub.js
//
// Inyectado con Playwright `addInitScript` ANTES de cualquier módulo
// de la app. Simula el backend Tauri (window.__TAURI_INTERNALS__ +
// event plugin) para que la app corra en un navegador plano.
//
// Parámetros vía window.__perfParams (inyectado por addInitScript):
//   perfFocus=year-calendar|weekly-schedule|habits|tasks|goals
//       deja UN solo widget en el dashboard (modo "un widget a la vez")
//   perfLayout=<JSON de la grilla 12x10 entera>
//   perfHabits, perfTasks, perfGoals, perfCalendarEvents,
//   perfScheduleBlocksPerDay, perfLogsPerHabit → volumen de fixtures
// =============================================================

;(function installStub() {
  const params = window.__perfParams || {}

  function qInt(name, def) {
    const v = parseInt(params[name], 10)
    return Number.isFinite(v) ? v : def
  }

  // ── helpers ────────────────────────────────────────────────
  function uuid() {
    return crypto.randomUUID()
  }

  function ts(daysAgo) {
    return new Date(Date.now() - daysAgo * 86400000).toISOString()
  }

  function localDate(daysAgo) {
    const d = new Date(Date.now() - daysAgo * 86400000)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  }

  const COLORS = [
    '#8b5cf6',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#ec4899',
    '#84cc16',
    '#3b82f6',
  ]

  // ── fixtures ───────────────────────────────────────────────
  const habits = []
  const habitCount = qInt('perfHabits', 8)
  for (let i = 0; i < habitCount; i++) {
    habits.push({
      id: uuid(),
      name: `Hábito ${i + 1}`,
      description: null,
      icon: null,
      color: COLORS[i % COLORS.length],
      frequency_type: 'daily',
      target_per_period: 1,
      interval_days: null,
      days_of_week: null,
      sort_order: i,
      created_at: ts(120),
      updated_at: ts(120),
      archived_at: null,
    })
  }

  const logsPerHabit = qInt('perfLogsPerHabit', 30)
  const habitLogs = []
  for (const habit of habits) {
    for (let i = 0; i < logsPerHabit; i++) {
      const day = Math.floor((i * 90) / logsPerHabit)
      habitLogs.push({
        id: uuid(),
        habit_id: habit.id,
        log_date: localDate(day),
        completed_at: ts(day),
        note: null,
        count: 1,
        created_at: ts(day),
      })
    }
  }

  const tasks = []
  const taskCount = qInt('perfTasks', 25)
  for (let i = 0; i < taskCount; i++) {
    tasks.push({
      id: uuid(),
      title: `Tarea ${i + 1}`,
      description: null,
      color: COLORS[i % COLORS.length],
      status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'doing' : 'todo',
      due_date: i % 4 === 0 ? localDate(-1) : null,
      steps: '[]',
      sort_order: i,
      created_at: ts(30),
      updated_at: ts(1),
      archived_at: null,
    })
  }

  const goals = []
  const goalCount = qInt('perfGoals', 6)
  for (let i = 0; i < goalCount; i++) {
    goals.push({
      id: uuid(),
      title: `Objetivo ${i + 1}`,
      description: null,
      color: COLORS[i % COLORS.length],
      target: 30,
      unit: null,
      direction: 'up',
      frequency_type: 'daily',
      interval_days: null,
      days_of_week: null,
      sort_order: i,
      created_at: ts(60),
      updated_at: ts(1),
      archived_at: null,
    })
  }

  const goalLogs = []
  for (const goal of goals) {
    for (let i = 0; i < 20; i++) {
      const day = Math.floor((i * 90) / 20)
      goalLogs.push({
        id: uuid(),
        goal_id: goal.id,
        log_date: localDate(day),
        amount: 1,
        note: null,
        created_at: ts(day),
      })
    }
  }

  const calendarEvents = []
  const calendarCount = qInt('perfCalendarEvents', 40)
  const thisYear = new Date().getFullYear()
  for (let i = 0; i < calendarCount; i++) {
    const month = 1 + ((i * 7) % 12)
    const day = 1 + ((i * 13) % 28)
    const date = `${thisYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    calendarEvents.push({
      id: uuid(),
      date,
      title: `Evento ${i + 1}`,
      description: null,
      color: COLORS[i % COLORS.length],
      calendarId: 'local',
      start: `${date}T09:00:00`,
      end: `${date}T10:00:00`,
    })
  }

  const blocksPerDay = qInt('perfScheduleBlocksPerDay', 2)
  const scheduleBlocks = []
  for (let i = 0; i < blocksPerDay * 7; i++) {
    scheduleBlocks.push({
      id: uuid(),
      title: `Bloque ${i + 1}`,
      color: COLORS[i % COLORS.length].replace('#', ''),
      sort_order: i,
      created_at: ts(30),
      updated_at: ts(1),
    })
  }
  const scheduleSlots = []
  for (const block of scheduleBlocks) {
    for (let i = 0; i < 2; i++) {
      const start = 8 * 60 + i * 120
      scheduleSlots.push({
        id: uuid(),
        block_id: block.id,
        day_of_week: scheduleSlots.length % 7,
        start_minutes: start,
        end_minutes: start + 60,
        created_at: ts(30),
        updated_at: ts(1),
      })
    }
  }

  // ── config key-value (seeds el layout del dashboard) ───────
  const cfg = new Map()
  cfg.set('local-calendar-events', JSON.stringify(calendarEvents))

  // Fixture de rendimiento, no el default real de la app: layout de 6 widgets
  // SIN solapamiento para medir el costo real del dashboard (el default real
  // solapa year-calendar y weekly-schedule en la fila 7, lo que duplica el
  // render de los dos widgets pesados y no es representativo de un dashboard
  // armado por el usuario).
  const DEFAULT_LAYOUT = [
    { i: 'habits', x: 0, y: 0, w: 6, h: 4, minW: 1, minH: 1 },
    { i: 'tasks', x: 6, y: 0, w: 6, h: 4, minW: 1, minH: 1 },
    { i: 'goals', x: 0, y: 4, w: 8, h: 3, minW: 1, minH: 1 },
    { i: 'pomodoro', x: 8, y: 4, w: 4, h: 3, minW: 2, minH: 3 },
    { i: 'year-calendar', x: 0, y: 6, w: 6, h: 4, minW: 1, minH: 3 },
    { i: 'weekly-schedule', x: 6, y: 6, w: 6, h: 4, minW: 5, minH: 4 },
  ]

  function makeLayout() {
    const focus = params.perfFocus
    if (focus) {
      const widgets = {
        habits: { i: 'habits', x: 0, y: 0, w: 12, h: 6, minW: 1, minH: 1 },
        tasks: { i: 'tasks', x: 0, y: 0, w: 12, h: 6, minW: 1, minH: 1 },
        goals: { i: 'goals', x: 0, y: 0, w: 12, h: 6, minW: 1, minH: 1 },
        'year-calendar': { i: 'year-calendar', x: 0, y: 0, w: 12, h: 8, minW: 1, minH: 3 },
        'weekly-schedule': { i: 'weekly-schedule', x: 0, y: 0, w: 12, h: 8, minW: 5, minH: 4 },
      }
      return [widgets[focus]]
    }
    const raw = params.perfLayout
    if (raw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(raw))
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {}
    }
    return DEFAULT_LAYOUT
  }
  cfg.set('aeon-dashboard-layout', JSON.stringify(makeLayout()))

  // ── event plugin internals ────────────────────────────────
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = window.__TAURI_EVENT_PLUGIN_INTERNALS__ || {}
  window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener = function () {}

  const callbacks = new Map()
  function registerCallback(cb, once) {
    const id = crypto.getRandomValues(new Uint32Array(1))[0]
    callbacks.set(id, (data) => {
      if (once) callbacks.delete(id)
      return cb && cb(data)
    })
    return id
  }
  function unregisterCallback(id) {
    callbacks.delete(id)
  }

  // ── invoke stub ────────────────────────────────────────────
  function invoke(cmd, args) {
    if (cmd.startsWith('plugin:event|')) {
      if (cmd === 'plugin:event|listen') {
        return Promise.resolve(args && args.handler ? args.handler : 0)
      }
      return Promise.resolve(null)
    }
    let result
    switch (cmd) {
      case 'list_habits':
        result = habits
        break
      case 'list_logs_in_range':
        result =
          args && args.habitId ? habitLogs.filter((l) => l.habit_id === args.habitId) : habitLogs
        break
      case 'list_tasks':
        result = tasks
        break
      case 'list_goals':
        result = goals
        break
      case 'list_goal_logs_in_range':
        result = goalLogs
        break
      case 'save_config':
        cfg.set(args.key, args.value)
        result = null
        break
      case 'load_config':
        result = cfg.get(args.key) ?? null
        break
      case 'list_schedule_blocks':
        result = scheduleBlocks
        break
      case 'list_schedule_slots':
        result = scheduleSlots
        break
      default:
        console.warn(`[inject-stub] Unhandled command: ${cmd}`)
        result = null
    }
    return Promise.resolve(result)
  }

  window.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback: registerCallback,
    unregisterCallback,
    runCallback: (id, data) => {
      const cb = callbacks.get(id)
      if (cb) cb(data)
    },
    callbacks,
    convertFileSrc: (filePath) => `asset://localhost/${encodeURIComponent(filePath)}`,
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { windowLabel: 'main', label: 'main' },
    },
  }

  window.__TAURI_INTERNALS__.__aeonStubReady = true
})()
