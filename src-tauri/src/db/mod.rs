// =============================================================
// db/mod.rs — Inicialización de SQLite + migraciones
// Rust es solo I/O. Cero lógica de negocio acá.
// =============================================================

use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("migration failed: {0}")]
    Migration(String),
    #[error("not found")]
    NotFound,
}

pub type DbResult<T> = Result<T, DbError>;

// Helper: convierte cualquier DbError a String para retornar desde
// #[tauri::command] (Tauri 2 acepta Result<T, String> out-of-the-box).
impl From<DbError> for String {
    fn from(e: DbError) -> Self {
        e.to_string()
    }
}

/// Extensión para terminar los commands con `.to_str_err()` en vez de
/// `.map_err(|e| e.to_string())` repetido en cada uno.
pub trait IntoStringErr<T> {
    fn to_str_err(self) -> Result<T, String>;
}

impl<T> IntoStringErr<T> for DbResult<T> {
    fn to_str_err(self) -> Result<T, String> {
        self.map_err(|e| e.to_string())
    }
}

// Pool minimalista: un solo Mutex<Connection> por instancia de la app.
// Suficiente para Tauri (single-window desktop app, sin concurrencia masiva).
pub struct Db {
    pub conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &Path) -> DbResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        Self::migrate_legacy_db_filename(path)?;
        let conn = Connection::open(path)?;
        // WAL: mejor concurrencia lectura/escritura. Foreign keys ON para ON DELETE CASCADE.
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    #[allow(dead_code)] // usado en tests de integración
    pub fn open_in_memory() -> DbResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    /// Renombra la DB legada con el nombre viejo ("habitos.sqlite") al
    /// nombre actual ("aeon.sqlite") la primera vez, conservando la data.
    /// También mueve los archivos WAL/SHM asociados si existen. Es una
    /// migración de identidad del archivo, no de esquema.
    fn migrate_legacy_db_filename(path: &Path) -> DbResult<()> {
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("aeon.sqlite");
        // Solo aplica para el nombre canónico de producción.
        if file_name != "aeon.sqlite" {
            return Ok(());
        }
        let dir = path.parent().unwrap_or_else(|| Path::new("."));
        let new_path = dir.join("aeon.sqlite");
        if new_path.exists() {
            return Ok(()); // ya migrado
        }
        let legacy = dir.join("habitos.sqlite");
        if !legacy.exists() {
            return Ok(()); // no hay nada que migrar
        }
        std::fs::rename(&legacy, &new_path)?;
        // Mueve sidecar WAL/SHM si quedaron (renombre mantiene coherencia).
        for ext in ["-wal", "-shm"] {
            let from = dir.join(format!("habitos.sqlite{ext}"));
            if from.exists() {
                let _ = std::fs::rename(&from, dir.join(format!("aeon.sqlite{ext}")));
            }
        }
        Ok(())
    }

    fn run_migrations(&self) -> DbResult<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_version (
                version    INTEGER PRIMARY KEY,
                applied_at TEXT    NOT NULL
             );",
        )
        .map_err(|e| DbError::Migration(format!("schema_version: {e}")))?;

        let migrations: [(i64, &str, &str); 12] = [
            (1, "001_init", include_str!("migrations/001_init.sql")),
            (2, "002_config", include_str!("migrations/002_config.sql")),
            (
                3,
                "003_tasks_goals",
                include_str!("migrations/003_tasks_goals.sql"),
            ),
            (
                4,
                "004_tasks_goals_archived",
                include_str!("migrations/004_tasks_goals_archived.sql"),
            ),
            (
                5,
                "005_weekly_schedule",
                include_str!("migrations/005_weekly_schedule.sql"),
            ),
            (6, "006_block_slots", ""), // Migración 006 se ejecuta en Rust (run_migration_006)
            (7, "007_aeon_storage_keys", ""), // Migración 007 se ejecuta en Rust (run_migration_007)
            (8, "008_habit_logs_count", ""), // Migración 008 se ejecuta en Rust (run_migration_008)
            (9, "009_repair_habit_progressive_schema", ""),
            (10, "010_repair_schedule_blocks", ""),
            (11, "011_notes", include_str!("migrations/011_notes.sql")),
            (12, "012_exams", include_str!("migrations/012_exams.sql")),
        ];

        for (version, name, sql) in &migrations {
            let already_applied: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM schema_version WHERE version = ?1)",
                    params![version],
                    |r| r.get(0),
                )
                .unwrap_or(false);

            // La 009 y la 010 reconcilian el esquema real y deben ejecutarse
            // también si quedaron registradas durante una ejecución
            // incompleta anterior.
            if !already_applied || *version == 9 || *version == 10 {
                // Para migraciones 006/007, manejar por lógica Rust (rutas parciales)
                if *version == 6 {
                    Self::run_migration_006(&conn)?;
                    conn.execute(
                        "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                        params![version, now_iso8601()],
                    )?;
                } else if *version == 7 {
                    Self::run_migration_007(&conn)?;
                    conn.execute(
                        "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                        params![version, now_iso8601()],
                    )?;
                } else if *version == 8 {
                    Self::run_migration_008(&conn)?;
                    conn.execute(
                        "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                        params![version, now_iso8601()],
                    )?;
                } else if *version == 9 {
                    Self::run_migration_009(&conn)?;
                    conn.execute(
                        "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                        params![version, now_iso8601()],
                    )?;
                } else if *version == 10 {
                    Self::run_migration_010(&conn)?;
                    conn.execute(
                        "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                        params![version, now_iso8601()],
                    )?;
                } else {
                    conn.execute_batch(sql)
                        .map_err(|e| DbError::Migration(format!("{name}.sql: {e}")))?;
                    conn.execute(
                        "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                        params![version, now_iso8601()],
                    )?;
                }
            }
        }

        Ok(())
    }

    fn run_migration_006(conn: &Connection) -> DbResult<()> {
        // Migración robusta con transacción para atomicidad
        conn.execute_batch("BEGIN TRANSACTION;")
            .map_err(|e| DbError::Migration(format!("006: begin transaction: {e}")))?;

        let result = (|| -> DbResult<()> {
            // Verificar si la tabla schedule_block_slots existe
            let slots_table_exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schedule_block_slots')",
                [],
                |r| r.get(0),
            )?;

            if !slots_table_exists {
                // Crear la tabla schedule_block_slots
                conn.execute_batch(
                    "CREATE TABLE schedule_block_slots (
                        id            TEXT PRIMARY KEY,
                        block_id      TEXT NOT NULL REFERENCES schedule_blocks(id) ON DELETE CASCADE,
                        day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
                        start_minutes INTEGER NOT NULL CHECK (start_minutes >= 0 AND start_minutes < 1440),
                        end_minutes   INTEGER NOT NULL CHECK (end_minutes > 0 AND end_minutes <= 1440),
                        created_at    TEXT NOT NULL,
                        updated_at    TEXT NOT NULL,
                        CHECK (end_minutes > start_minutes)
                    );
                    CREATE INDEX idx_schedule_block_slots_block ON schedule_block_slots(block_id);
                    CREATE INDEX idx_schedule_block_slots_day ON schedule_block_slots(day_of_week);"
                ).map_err(|e| DbError::Migration(format!("006: crear tabla slots: {e}")))?;
            }

            // Verificar si schedule_blocks existe
            let blocks_table_exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schedule_blocks')",
                [],
                |r| r.get(0),
            )?;

            if !blocks_table_exists {
                // schedule_blocks no existe, verificar si schedule_blocks_new existe (migración parcial)
                let new_table_exists: bool = conn.query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schedule_blocks_new')",
                    [],
                    |r| r.get(0),
                )?;

                if new_table_exists {
                    // Completar el rename
                    conn.execute_batch(
                        "ALTER TABLE schedule_blocks_new RENAME TO schedule_blocks;",
                    )
                    .map_err(|e| DbError::Migration(format!("006: completar rename: {e}")))?;
                } else {
                    // Ni schedule_blocks ni schedule_blocks_new existen, crear desde cero
                    conn.execute_batch(
                        "CREATE TABLE schedule_blocks (
                            id            TEXT PRIMARY KEY,
                            title         TEXT NOT NULL,
                            color         TEXT NOT NULL,
                            sort_order    REAL NOT NULL DEFAULT 0,
                            created_at    TEXT NOT NULL,
                            updated_at    TEXT NOT NULL
                        );",
                    )
                    .map_err(|e| DbError::Migration(format!("006: crear schedule_blocks: {e}")))?;
                }
                return Ok(());
            }

            // schedule_blocks existe, verificar si tiene las columnas viejas
            let has_old_columns: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM pragma_table_info('schedule_blocks') WHERE name='day_of_week')",
                [],
                |r| r.get(0),
            )?;

            if has_old_columns {
                // Migrar datos existentes de schedule_blocks a schedule_block_slots
                conn.execute_batch(
                    "INSERT OR IGNORE INTO schedule_block_slots (id, block_id, day_of_week, start_minutes, end_minutes, created_at, updated_at)
                     SELECT 
                       'slot-' || id as id,
                       id as block_id,
                       day_of_week,
                       start_minutes,
                       end_minutes,
                       created_at,
                       updated_at
                     FROM schedule_blocks;"
                ).map_err(|e| DbError::Migration(format!("006: migrar datos: {e}")))?;

                // Eliminar índice viejo
                conn.execute_batch("DROP INDEX IF EXISTS idx_schedule_blocks_day;")
                    .map_err(|e| DbError::Migration(format!("006: drop index: {e}")))?;

                // Verificar si schedule_blocks_new existe (migración parcial)
                let new_table_exists: bool = conn.query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schedule_blocks_new')",
                    [],
                    |r| r.get(0),
                )?;

                if !new_table_exists {
                    // Crear tabla nueva sin columnas viejas
                    conn.execute_batch(
                        "CREATE TABLE schedule_blocks_new (
                            id            TEXT PRIMARY KEY,
                            title         TEXT NOT NULL,
                            color         TEXT NOT NULL,
                            sort_order    REAL NOT NULL DEFAULT 0,
                            created_at    TEXT NOT NULL,
                            updated_at    TEXT NOT NULL
                        );
                        INSERT INTO schedule_blocks_new (id, title, color, sort_order, created_at, updated_at)
                        SELECT id, title, color, sort_order, created_at, updated_at
                        FROM schedule_blocks;
                        DROP TABLE schedule_blocks;
                        ALTER TABLE schedule_blocks_new RENAME TO schedule_blocks;"
                    ).map_err(|e| DbError::Migration(format!("006: recrear tabla: {e}")))?;
                } else {
                    // La tabla new existe pero no se completó el rename
                    conn.execute_batch(
                        "DROP TABLE IF EXISTS schedule_blocks;
                         ALTER TABLE schedule_blocks_new RENAME TO schedule_blocks;",
                    )
                    .map_err(|e| DbError::Migration(format!("006: completar rename: {e}")))?;
                }
            }

            Ok(())
        })();

        match result {
            Ok(_) => {
                conn.execute_batch("COMMIT;")
                    .map_err(|e| DbError::Migration(format!("006: commit: {e}")))?;
                Ok(())
            }
            Err(e) => {
                conn.execute_batch("ROLLBACK;").map_err(|e2| {
                    DbError::Migration(format!("006: rollback failed: {e2}, original error: {e}"))
                })?;
                Err(e)
            }
        }
    }

    /// Migración 007: renombra la clave de config del layout del dashboard
    /// ("habitos-dashboard-layout" -> "aeon-dashboard-layout") para quedar
    /// consistente con el rebranding a AEON. Idempotente: si la clave nueva
    /// ya existe, se prioriza la nueva y se descarta la legada; si solo
    /// existe la legada, se renombra; si no hay ninguna, no hace nada.
    /// También migra cualquier otra clave de config habitual con prefijo
    /// "habitos." del pasado (token de OAuth, settings) manteniendo la data.
    fn run_migration_007(conn: &Connection) -> DbResult<()> {
        conn.execute_batch("BEGIN TRANSACTION;")
            .map_err(|e| DbError::Migration(format!("007: begin transaction: {e}")))?;

        let result = (|| -> DbResult<()> {
            // Renombrar key de layout si la nueva no existe.
            let new_exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM config WHERE key = 'aeon-dashboard-layout')",
                [],
                |r| r.get(0),
            )?;

            let legacy_exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM config WHERE key = 'habitos-dashboard-layout')",
                [],
                |r| r.get(0),
            )?;

            if legacy_exists && !new_exists {
                conn.execute(
                    "UPDATE config SET key = 'aeon-dashboard-layout' WHERE key = 'habitos-dashboard-layout'",
                    [],
                )?;
            }

            // Migrar las claves de config "habitos.*" a "aeon.*", si existen.
            // NO migra claves de localStorage (esas van en el frontend).
            let renames: &[(&str, &str)] = &[
                ("habitos.theme", "aeon.theme"),
                ("habitos.viewMode", "aeon.viewMode"),
                ("habitos.sidebarCollapsed", "aeon.sidebarCollapsed"),
                ("habitos-dashboard-layout", "aeon-dashboard-layout"),
            ];
            for (old_key, new_key) in renames {
                let new_key_exists: bool = conn.query_row(
                    "SELECT EXISTS(SELECT 1 FROM config WHERE key = ?1)",
                    params![new_key],
                    |r| r.get(0),
                )?;
                if !new_key_exists {
                    conn.execute(
                        "UPDATE config SET key = ?1 WHERE key = ?2",
                        params![new_key, old_key],
                    )?;
                }
            }

            Ok(())
        })();

        match result {
            Ok(_) => {
                conn.execute_batch("COMMIT;")
                    .map_err(|e| DbError::Migration(format!("007: commit failed: {e}")))?;
                Ok(())
            }
            Err(e) => {
                conn.execute_batch("ROLLBACK;").map_err(|e2| {
                    DbError::Migration(format!("007: rollback failed: {e2}, original error: {e}"))
                })?;
                Err(e)
            }
        }
    }

    /// Migración 008: multi-check-in progresivo.
    /// 1) Recrea la tabla `habits` relajando el CHECK `target_per_period <= 7`
    ///    a `<= 20` (SQLite no permite alterar CHECKs; patrón de recreación
    ///    de la 006).
    /// 2) Agrega la columna `count` a `habit_logs` con DEFAULT 1 (los logs
    ///    existentes quedan backfilleados a 1).
    ///
    /// Requiere desactivar la enforcement de foreign keys AROUND la recreación
    /// (en autocommit) porque `habit_logs` referencia `habits` con ON DELETE
    /// CASCADE: con `foreign_keys=ON`, `DROP TABLE habits` cascadearía a borrar
    /// todos los logs. Se sigue el procedimiento oficial de SQLite para
    /// "ALTER TABLE ... DROP/RECREATE": PRAGMA foreign_keys=OFF → recrear →
    /// PRAGMA foreign_keys=ON, seguido de un foreign_key_check.
    fn run_migration_008(conn: &Connection) -> DbResult<()> {
        Self::ensure_progressive_schema(conn, "008")
    }

    /// Repara instalaciones donde la versión 008 quedó registrada sin aplicar
    /// sus cambios de esquema. La inspección real permite que sea idempotente.
    fn run_migration_009(conn: &Connection) -> DbResult<()> {
        Self::ensure_progressive_schema(conn, "009")
    }

    /// Migración 010: repara `schedule_blocks`/`schedule_block_slots`.
    /// La 006 detectaba la forma vieja por la columna `day_of_week`, pero las
    /// instalaciones reales quedaron en un estado intermedio: sin `day_of_week`
    /// y con `start_minutes`/`end_minutes` NOT NULL en `schedule_blocks`, con
    /// `schema_version` ya en la última. Esta repair detecta por
    /// `start_minutes` (presente en la forma 005 completa y en la intermedia,
    /// ausente en la nueva) y reconstruye a Bloque 1:N Slots preservando datos:
    /// las filas con día+horario se convierten a slots con id UUID, y las
    /// intermedias (ya sin día) conservan bloque + slots existentes.
    /// Sigue el procedimiento oficial de SQLite (PRAGMA foreign_keys=OFF en
    /// autocommit → recrear → ON + foreign_key_check) para que el DROP no
    /// dispare borrados en cascada de slots. Idempotente por inspección real.
    fn run_migration_010(conn: &Connection) -> DbResult<()> {
        Self::ensure_schedule_blocks_schema(conn, "010")
    }

    fn ensure_schedule_blocks_schema(conn: &Connection, migration: &str) -> DbResult<()> {
        let slots_table_exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schedule_block_slots')",
            [],
            |row| row.get(0),
        )?;
        if slots_table_exists && !Self::schedule_slot_ids_are_uuid(conn)? {
            Self::normalize_schedule_slot_ids(conn, migration)?;
        }

        let has_time_columns = Self::schedule_blocks_has_time_columns(conn)?;
        if !has_time_columns {
            let violations: i64 =
                conn.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |row| {
                    row.get(0)
                })?;
            if violations > 0 {
                return Err(DbError::Migration(format!(
                    "{migration}: foreign_key_check encontró {violations} violaciones"
                )));
            }
            return Ok(());
        }

        // PRAGMA foreign_keys=OFF debe correr en autocommit (no puede
        // ejecutarse dentro de una transacción). En este punto la conexión
        // está en autocommit (las migraciones previas ya committearon).
        conn.pragma_update(None, "foreign_keys", "OFF")
            .map_err(|e| DbError::Migration(format!("{migration}: foreign_keys=OFF: {e}")))?;

        let result = (|| -> DbResult<()> {
            conn.execute_batch("BEGIN TRANSACTION;")
                .map_err(|e| DbError::Migration(format!("{migration}: begin transaction: {e}")))?;

            let result = (|| -> DbResult<()> {
                if !slots_table_exists {
                    conn.execute_batch(
                        "CREATE TABLE schedule_block_slots (
                           id            TEXT PRIMARY KEY,
                           block_id      TEXT NOT NULL REFERENCES schedule_blocks(id) ON DELETE CASCADE,
                           day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
                           start_minutes INTEGER NOT NULL CHECK (start_minutes >= 0 AND start_minutes < 1440),
                           end_minutes   INTEGER NOT NULL CHECK (end_minutes > 0 AND end_minutes <= 1440),
                           created_at    TEXT NOT NULL,
                           updated_at    TEXT NOT NULL,
                           CHECK (end_minutes > start_minutes)
                         );
                         CREATE INDEX idx_schedule_block_slots_block ON schedule_block_slots(block_id);
                         CREATE INDEX idx_schedule_block_slots_day ON schedule_block_slots(day_of_week);",
                    )
                    .map_err(|e| {
                        DbError::Migration(format!("{migration}: crear tabla slots: {e}"))
                    })?;
                }

                let has_day_column: bool = conn.query_row(
                    "SELECT EXISTS(SELECT 1 FROM pragma_table_info('schedule_blocks') WHERE name='day_of_week')",
                    [],
                    |row| row.get(0),
                )?;

                if has_day_column {
                    // Forma 005 completa: convertir filas a slots UUID antes de
                    // descartar las columnas de horario.
                    conn.execute_batch(
                        "INSERT OR IGNORE INTO schedule_block_slots
                           (id, block_id, day_of_week, start_minutes, end_minutes, created_at, updated_at)
                         SELECT
                           lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4'
                             || substr(lower(hex(randomblob(2))), 2) || '-'
                             || substr('89ab', abs(random()) % 4 + 1, 1)
                             || substr(lower(hex(randomblob(2))), 2) || '-'
                             || lower(hex(randomblob(6))),
                           id,
                           day_of_week,
                           start_minutes,
                           end_minutes,
                           created_at,
                           updated_at
                         FROM schedule_blocks;",
                    )
                    .map_err(|e| {
                        DbError::Migration(format!("{migration}: migrar datos: {e}"))
                    })?;
                }

                conn.execute_batch("DROP INDEX IF EXISTS idx_schedule_blocks_day;")
                    .map_err(|e| DbError::Migration(format!("{migration}: drop index: {e}")))?;

                // Completar un rename parcial previo si quedó a medias.
                let new_table_exists: bool = conn.query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schedule_blocks_new')",
                    [],
                    |row| row.get(0),
                )?;
                if new_table_exists {
                    conn.execute_batch(
                        "INSERT OR IGNORE INTO schedule_blocks_new
                           (id, title, color, sort_order, created_at, updated_at)
                         SELECT id, title, color, sort_order, created_at, updated_at
                         FROM schedule_blocks;
                         DROP TABLE schedule_blocks;
                         ALTER TABLE schedule_blocks_new RENAME TO schedule_blocks;",
                    )
                    .map_err(|e| {
                        DbError::Migration(format!("{migration}: completar rename: {e}"))
                    })?;
                } else {
                    conn.execute_batch(
                        "CREATE TABLE schedule_blocks_new (
                           id            TEXT PRIMARY KEY,
                           title         TEXT NOT NULL,
                           color         TEXT NOT NULL,
                           sort_order    REAL NOT NULL DEFAULT 0,
                           created_at    TEXT NOT NULL,
                           updated_at    TEXT NOT NULL
                         );
                         INSERT INTO schedule_blocks_new
                           (id, title, color, sort_order, created_at, updated_at)
                         SELECT id, title, color, sort_order, created_at, updated_at
                         FROM schedule_blocks;
                         DROP TABLE schedule_blocks;
                         ALTER TABLE schedule_blocks_new RENAME TO schedule_blocks;",
                    )
                    .map_err(|e| DbError::Migration(format!("{migration}: recrear tabla: {e}")))?;
                }

                let violations: i64 =
                    conn.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |row| {
                        row.get(0)
                    })?;
                if violations > 0 {
                    return Err(DbError::Migration(format!(
                        "{migration}: foreign_key_check encontró {violations} violaciones"
                    )));
                }

                Ok(())
            })();

            match result {
                Ok(()) => match conn.execute_batch("COMMIT;") {
                    Ok(()) => Ok(()),
                    Err(error) => {
                        let rollback = conn.execute_batch("ROLLBACK;");
                        match rollback {
                            Ok(()) => {
                                Err(DbError::Migration(format!("{migration}: commit: {error}")))
                            }
                            Err(rollback_error) => Err(DbError::Migration(format!(
                                "{migration}: commit: {error}; rollback failed: {rollback_error}"
                            ))),
                        }
                    }
                },
                Err(error) => match conn.execute_batch("ROLLBACK;") {
                    Ok(()) => Err(error),
                    Err(rollback_error) => Err(DbError::Migration(format!(
                        "{migration}: migration: {error}; rollback failed: {rollback_error}"
                    ))),
                },
            }
        })();

        let fk_check: DbResult<()> = (|| {
            conn.pragma_update(None, "foreign_keys", "ON")?;
            let violations: i64 =
                conn.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
                    r.get(0)
                })?;
            if violations > 0 {
                return Err(DbError::Migration(format!(
                    "{migration}: foreign_key_check encontró {violations} violaciones"
                )));
            }
            Self::normalize_schedule_slot_ids(conn, migration)?;
            Ok(())
        })();

        match result {
            Ok(()) => fk_check,
            Err(e) => match conn.pragma_update(None, "foreign_keys", "ON") {
                Ok(()) => Err(e),
                Err(fk_error) => Err(DbError::Migration(format!(
                    "{e}; foreign_keys=ON: {fk_error}"
                ))),
            },
        }
    }

    fn schedule_blocks_has_time_columns(conn: &Connection) -> DbResult<bool> {
        Ok(conn.query_row(
            "SELECT EXISTS(
               SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schedule_blocks'
             ) AND EXISTS(
               SELECT 1 FROM pragma_table_info('schedule_blocks') WHERE name = 'start_minutes'
             )",
            [],
            |row| row.get(0),
        )?)
    }

    /// Los ids `slot-…` generados por la 006 no pasan la validación UUID del
    /// frontend (`z.string().uuid()`) y la carga falla con "Error al cargar".
    /// Detecta por forma: 36 chars con guiones y versión/variante UUID.
    fn schedule_slot_ids_are_uuid(conn: &Connection) -> DbResult<bool> {
        let non_uuid: i64 = conn.query_row(
            "SELECT count(*) FROM schedule_block_slots
             WHERE length(id) != 36
                OR substr(id, 9, 1) != '-'
                OR substr(id, 14, 1) != '-'
                OR substr(id, 19, 1) != '-'
                OR substr(id, 24, 1) != '-'
                OR substr(id, 15, 1) != '4'
                OR substr(id, 20, 1) NOT IN ('8', '9', 'a', 'b', 'A', 'B')",
            [],
            |row| row.get(0),
        )?;
        Ok(non_uuid == 0)
    }

    fn normalize_schedule_slot_ids(conn: &Connection, migration: &str) -> DbResult<()> {
        let legacy_ids: Vec<String> = conn
            .prepare(
                "SELECT id FROM schedule_block_slots
                 WHERE length(id) != 36
                    OR substr(id, 9, 1) != '-'
                    OR substr(id, 14, 1) != '-'
                    OR substr(id, 19, 1) != '-'
                    OR substr(id, 24, 1) != '-'
                    OR substr(id, 15, 1) != '4'
                    OR substr(id, 20, 1) NOT IN ('8', '9', 'a', 'b', 'A', 'B')",
            )
            .and_then(|mut stmt| {
                stmt.query_map([], |row| row.get(0))
                    .and_then(|rows| rows.collect::<Result<Vec<String>, _>>())
            })
            .map_err(|e| DbError::Migration(format!("{migration}: leer slot ids: {e}")))?;
        for old_id in legacy_ids {
            let new_id: String = conn.query_row(
                "SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4'
                   || substr(lower(hex(randomblob(2))), 2) || '-'
                   || substr('89ab', abs(random()) % 4 + 1, 1)
                   || substr(lower(hex(randomblob(2))), 2) || '-'
                   || lower(hex(randomblob(6)))",
                [],
                |row| row.get(0),
            )?;
            conn.execute(
                "UPDATE schedule_block_slots SET id = ?1 WHERE id = ?2",
                rusqlite::params![new_id, old_id],
            )
            .map_err(|e| DbError::Migration(format!("{migration}: normalizar slot id: {e}")))?;
        }
        Ok(())
    }

    fn ensure_progressive_schema(conn: &Connection, migration: &str) -> DbResult<()> {
        let has_count_column = Self::habit_log_count_exists(conn)?;
        let has_valid_count = Self::habit_log_count_is_valid(conn)?;
        let has_valid_count_values =
            has_count_column && Self::habit_log_count_values_are_valid(conn)?;
        let needs_habits_rebuild = !Self::habits_accept_target_twenty(conn)?;

        if has_valid_count && has_valid_count_values && !needs_habits_rebuild {
            return Ok(());
        }

        // PRAGMA foreign_keys=OFF debe correr en autocommit (no puede
        // ejecutarse dentro de una transacción). En este punto la conexión
        // está en autocommit (las migraciones previas ya committearon).
        conn.pragma_update(None, "foreign_keys", "OFF")
            .map_err(|e| DbError::Migration(format!("{migration}: foreign_keys=OFF: {e}")))?;

        let result = (|| -> DbResult<()> {
            conn.execute_batch("BEGIN TRANSACTION;")
                .map_err(|e| DbError::Migration(format!("{migration}: begin transaction: {e}")))?;

            let result = (|| -> DbResult<()> {
                if needs_habits_rebuild {
                    conn.execute_batch(
                        "CREATE TABLE habits_new (
                          id                TEXT    PRIMARY KEY,
                          name              TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
                          description       TEXT             CHECK (description IS NULL OR length(description) <= 500),
                          icon              TEXT             CHECK (icon       IS NULL OR length(icon)       <= 32),
                          color             TEXT    NOT NULL CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
                          frequency_type    TEXT    NOT NULL CHECK (frequency_type IN ('daily','weekly','interval')),
                          target_per_period INTEGER NOT NULL DEFAULT 1 CHECK (target_per_period > 0 AND target_per_period <= 20),
                          interval_days     INTEGER          CHECK (interval_days IS NULL OR interval_days BETWEEN 1 AND 365),
                          days_of_week      TEXT             CHECK (days_of_week  IS NULL OR json_valid(days_of_week)),
                          sort_order        INTEGER NOT NULL DEFAULT 0,
                          created_at        TEXT    NOT NULL,
                          updated_at        TEXT    NOT NULL,
                          archived_at       TEXT             CHECK (archived_at IS NULL OR archived_at >= created_at),
                          CHECK (
                            (frequency_type = 'daily'    AND interval_days IS NULL AND days_of_week IS NULL) OR
                            (frequency_type = 'weekly'   AND interval_days IS NULL AND days_of_week IS NOT NULL) OR
                            (frequency_type = 'interval' AND interval_days IS NOT NULL AND days_of_week IS NULL)
                          )
                        );
                        INSERT INTO habits_new (
                          id, name, description, icon, color, frequency_type, target_per_period,
                          interval_days, days_of_week, sort_order, created_at, updated_at, archived_at
                        )
                        SELECT
                          id, name, description, icon, color, frequency_type, target_per_period,
                          interval_days, days_of_week, sort_order, created_at, updated_at, archived_at
                        FROM habits;
                        DROP TABLE habits;
                        ALTER TABLE habits_new RENAME TO habits;
                        CREATE INDEX idx_habits_archived ON habits(archived_at);
                        CREATE INDEX idx_habits_sort ON habits(sort_order) WHERE archived_at IS NULL;",
                    )
                    .map_err(|e| {
                        DbError::Migration(format!("{migration}: recrear habits: {e}"))
                    })?;
                }

                if has_count_column && (!has_valid_count || !has_valid_count_values) {
                    conn.execute_batch(
                        "CREATE TABLE habit_logs_new (
                           id            TEXT    PRIMARY KEY,
                           habit_id     TEXT    NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
                           log_date     TEXT    NOT NULL CHECK (log_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
                           completed_at TEXT    NOT NULL,
                           note         TEXT             CHECK (note IS NULL OR length(note) <= 280),
                           count        INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
                           created_at   TEXT    NOT NULL,
                           UNIQUE (habit_id, log_date)
                         );
                         INSERT INTO habit_logs_new (
                           id, habit_id, log_date, completed_at, note, count, created_at
                         )
                         SELECT
                           id, habit_id, log_date, completed_at, note,
                            CASE
                              WHEN CAST(count AS INTEGER) >= 1
                                AND CAST(count AS REAL) = CAST(count AS INTEGER)
                                AND (
                                  typeof(count) IN ('integer', 'real')
                                   OR (
                                     typeof(count) = 'text'
                                     AND trim(count) <> ''
                                     AND trim(count) NOT GLOB '*[^0-9]*'
                                   )
                                )
                              THEN CAST(count AS INTEGER)
                             ELSE 1
                           END,
                           created_at
                         FROM habit_logs;
                         DROP TABLE habit_logs;
                         ALTER TABLE habit_logs_new RENAME TO habit_logs;
                         CREATE INDEX idx_logs_habit_date ON habit_logs(habit_id, log_date DESC);
                         CREATE INDEX idx_logs_date ON habit_logs(log_date DESC);",
                    )
                    .map_err(|e| {
                        DbError::Migration(format!("{migration}: recrear habit_logs: {e}"))
                    })?;
                } else if !has_count_column {
                    conn.execute(
                        "ALTER TABLE habit_logs ADD COLUMN count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1)",
                        [],
                    )?;
                }

                let violations: i64 =
                    conn.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |row| {
                        row.get(0)
                    })?;
                if violations > 0 {
                    return Err(DbError::Migration(format!(
                        "{migration}: foreign_key_check encontró {violations} violaciones"
                    )));
                }

                Ok(())
            })();

            match result {
                Ok(()) => match conn.execute_batch("COMMIT;") {
                    Ok(()) => Ok(()),
                    Err(error) => {
                        let rollback = conn.execute_batch("ROLLBACK;");
                        match rollback {
                            Ok(()) => {
                                Err(DbError::Migration(format!("{migration}: commit: {error}")))
                            }
                            Err(rollback_error) => Err(DbError::Migration(format!(
                                "{migration}: commit: {error}; rollback failed: {rollback_error}"
                            ))),
                        }
                    }
                },
                Err(error) => match conn.execute_batch("ROLLBACK;") {
                    Ok(()) => Err(error),
                    Err(rollback_error) => Err(DbError::Migration(format!(
                        "{migration}: migration: {error}; rollback failed: {rollback_error}"
                    ))),
                },
            }
        })();

        let fk_check: DbResult<()> = (|| {
            conn.pragma_update(None, "foreign_keys", "ON")?;
            let violations: i64 =
                conn.query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
                    r.get(0)
                })?;
            if violations > 0 {
                return Err(DbError::Migration(format!(
                    "{migration}: foreign_key_check encontró {violations} violaciones"
                )));
            }
            Ok(())
        })();

        match result {
            Ok(()) => fk_check,
            Err(e) => match conn.pragma_update(None, "foreign_keys", "ON") {
                Ok(()) => Err(e),
                Err(fk_error) => Err(DbError::Migration(format!(
                    "{e}; foreign_keys=ON: {fk_error}"
                ))),
            },
        }
    }

    fn habit_log_count_exists(conn: &Connection) -> DbResult<bool> {
        Ok(conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('habit_logs') WHERE name = 'count')",
            [],
            |row| row.get(0),
        )?)
    }

    fn habit_log_count_is_valid(conn: &Connection) -> DbResult<bool> {
        let definition: Option<(String, i64, Option<String>)> = conn
            .query_row(
                "SELECT type, \"notnull\", dflt_value
                 FROM pragma_table_info('habit_logs') WHERE name = 'count'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()?;
        let Some((column_type, not_null, default_value)) = definition else {
            return Ok(false);
        };
        if !column_type.eq_ignore_ascii_case("INTEGER")
            || not_null != 1
            || default_value.as_deref() != Some("1")
        {
            return Ok(false);
        }
        let table_sql: String = conn.query_row(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'habit_logs'",
            [],
            |row| row.get(0),
        )?;
        let normalized_sql: String = table_sql
            .to_ascii_lowercase()
            .chars()
            .filter(|character| !character.is_ascii_whitespace())
            .collect();
        Ok(normalized_sql.contains("count>=1"))
    }

    fn habit_log_count_values_are_valid(conn: &Connection) -> DbResult<bool> {
        let invalid_values: i64 = conn.query_row(
            "SELECT count(*) FROM habit_logs
             WHERE count IS NULL
                OR (typeof(count) = 'integer' AND count < 1)
                OR (typeof(count) = 'real' AND (count < 1 OR count != CAST(count AS INTEGER)))
                OR (typeof(count) = 'text' AND (
                     trim(count) = ''
                     OR trim(count) GLOB '*[^0-9]*'
                     OR CAST(trim(count) AS INTEGER) < 1
                ))
                OR typeof(count) NOT IN ('integer', 'real', 'text')",
            [],
            |row| row.get(0),
        )?;
        Ok(invalid_values == 0)
    }

    /// Comprueba el límite mediante SQLite, en lugar de interpretar el SQL
    /// serializado de sqlite_master. El INSERT vive en un savepoint y nunca
    /// modifica los datos persistidos.
    fn habits_accept_target_twenty(conn: &Connection) -> DbResult<bool> {
        conn.execute_batch("SAVEPOINT progressive_schema_probe;")?;
        let result = conn.execute(
            "INSERT INTO habits (
                id, name, color, frequency_type, target_per_period,
                interval_days, days_of_week, sort_order, created_at, updated_at, archived_at
             ) VALUES (
                'progressive-schema-probe-' || lower(hex(randomblob(16))), 'schema probe', '#000000', 'daily', 20,
                NULL, NULL, 0, '1970-01-01T00:00:00.000Z',
                '1970-01-01T00:00:00.000Z', NULL
             )",
            [],
        );
        conn.execute_batch(
            "ROLLBACK TO progressive_schema_probe; RELEASE progressive_schema_probe;",
        )?;

        match result {
            Ok(_) => Ok(true),
            Err(rusqlite::Error::SqliteFailure(error, message))
                if error.code == rusqlite::ErrorCode::ConstraintViolation
                    && message
                        .as_deref()
                        .is_some_and(|message| message.contains("target_per_period")) =>
            {
                Ok(false)
            }
            Err(error) => Err(error.into()),
        }
    }
}

// Helper: timestamp ISO 8601 UTC con milisegundos. Usado solo para
// marcar cuándo se aplicó una migración. El resto de timestamps los
// genera el frontend y los validamos con Zod.
fn now_iso8601() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs() as i64;
    let millis = dur.subsec_millis();

    // Date math manual (sin chrono) — UTC, formato 2026-06-27T14:30:00.000Z
    let days = secs.div_euclid(86_400);
    let secs_of_day = secs.rem_euclid(86_400);
    let hour = (secs_of_day / 3600) as u32;
    let minute = ((secs_of_day % 3600) / 60) as u32;
    let second = (secs_of_day % 60) as u32;

    let (y, m, d) = civil_from_days(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        y, m, d, hour, minute, second, millis
    )
}

// Howard Hinnant date algorithm — converts days-since-epoch to (y, m, d) UTC.
fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u32; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe as i32 + (era * 400) as i32;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 }; // [1, 12]
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

#[cfg(test)]
mod tests;
