-- 012_exams: tabla de exámenes del widget "Exámenes".
--
-- Migración aditiva: solo crea; no altera ni borra nada existente. La
-- lógica de negocio vive en TypeScript (frontend); Rust es solo I/O.
-- Se crea desde ya el juego completo de campos de la spec (T1) para no
-- re-trabajar el esquema en tickets posteriores; el walking skeleton
-- (#133) sólo cablea título, fecha, estado, color de respaldo y orden.
CREATE TABLE exams (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 100),
  date           TEXT NOT NULL CHECK(date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status         TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','estudiando','rendido')),
  grade          REAL CHECK(grade IS NULL OR (grade >= 0 AND grade <= 10)),
  block_id       TEXT REFERENCES schedule_blocks(id) ON DELETE SET NULL,
  fallback_color TEXT NOT NULL DEFAULT 'lavender',
  calendar_id    TEXT,
  event_id       TEXT,
  topics         TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(topics)),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_date   ON exams(date);
CREATE INDEX idx_exams_sort   ON exams(sort_order);
