-- 013_task_block_event: la tarea se asocia a un Bloque del cronograma y a un
-- evento del calendario, con el mismo modelo ya usado por los exámenes (#144).
--
-- Migración aditiva: sólo agrega columnas; no altera ni borra datos existentes.
-- La lógica de negocio vive en TypeScript (frontend); Rust es sólo I/O.
--
-- `block_id` referencia el Bloque semanal (la materia) y se anula en cascada al
-- borrarlo (ON DELETE SET NULL): la tarea sobrevive y conserva su color manual.
-- `calendar_id` + `event_id` forman el par opcional que identifica el evento
-- vinculado; ambas quedan NULL cuando la tarea no tiene evento.
ALTER TABLE tasks ADD COLUMN block_id TEXT REFERENCES schedule_blocks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN calendar_id TEXT;
ALTER TABLE tasks ADD COLUMN event_id TEXT;
