use super::*;
use rusqlite::Connection;

fn fixture_token(conn: &Connection) -> String {
    conn.query_row("SELECT lower(hex(randomblob(16)))", [], |row| row.get(0))
        .expect("generate fixture token")
}

fn fixture_timestamp() -> String {
    now_iso8601()
}

fn fixture_date(timestamp: &str) -> &str {
    &timestamp[..10]
}

fn fixture_color() -> String {
    "#112233".to_owned()
}

fn record_versions(conn: &Connection, through: i64) {
    for version in 1..=through {
        conn.execute(
            "INSERT INTO schema_version (version, applied_at) VALUES (?1, 'test')",
            [version],
        )
        .expect("record migration version");
    }
}

fn legacy_db() -> (Db, String, String, String) {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    conn.execute_batch(include_str!("migrations/001_init.sql"))
        .expect("create legacy schema");
    let habit_id = fixture_token(&conn);
    let habit_name = fixture_token(&conn);
    let color = fixture_color();
    let timestamp = fixture_timestamp();
    let log_id = fixture_token(&conn);
    let log_timestamp = fixture_timestamp();
    let note = fixture_token(&conn);
    conn.execute(
        "INSERT INTO habits (
            id, name, color, frequency_type, target_per_period,
            interval_days, days_of_week, sort_order, created_at, updated_at
         ) VALUES (?1, ?2, ?3, 'daily', ?4, NULL, NULL, 0, ?5, ?5)",
        (&habit_id, &habit_name, &color, 7, &timestamp),
    )
    .expect("insert legacy habit");
    conn.execute(
        "INSERT INTO habit_logs (
            id, habit_id, log_date, completed_at, note, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?4)",
        (
            &log_id,
            &habit_id,
            fixture_date(&log_timestamp),
            &log_timestamp,
            &note,
        ),
    )
    .expect("insert legacy log");
    record_versions(&conn, 9);
    let db = Db {
        conn: Mutex::new(conn),
    };
    (db, habit_id, log_id, note)
}

#[test]
fn repairs_schema_and_preserves_existing_data_and_relations() {
    let (db, habit_id, log_id, note) = legacy_db();
    db.run_migrations().expect("repair stale schema");
    let conn = db.conn.lock().unwrap();

    let count_definition: (String, i64, String) = conn
        .query_row(
            "SELECT type, \"notnull\", COALESCE(dflt_value, '')
             FROM pragma_table_info('habit_logs') WHERE name = 'count'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("inspect count definition");
    assert_eq!(count_definition, ("INTEGER".to_owned(), 1, "1".to_owned()));

    let count_check: String = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'habit_logs'",
            [],
            |row| row.get(0),
        )
        .expect("inspect log constraints");
    assert!(count_check.contains("count >= 1"));

    let target: i64 = conn
        .query_row(
            "SELECT target_per_period FROM habits WHERE id = ?1",
            [&habit_id],
            |row| row.get(0),
        )
        .expect("find preserved habit");
    assert_eq!(target, 7);

    let preserved_log: (String, i64) = conn
        .query_row(
            "SELECT note, count FROM habit_logs WHERE id = ?1",
            [&log_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("find preserved log");
    assert_eq!(preserved_log, (note, 1));

    let foreign_key_target: String = conn
        .query_row(
            "SELECT \"table\" FROM pragma_foreign_key_list('habit_logs') WHERE \"from\" = 'habit_id'",
            [],
            |row| row.get(0),
        )
        .expect("inspect habit log foreign key");
    assert_eq!(foreign_key_target, "habits");

    conn.execute("DELETE FROM habits WHERE id = ?1", [&habit_id])
        .expect("delete preserved habit");
    let remaining_logs: i64 = conn
        .query_row(
            "SELECT count(*) FROM habit_logs WHERE id = ?1",
            [&log_id],
            |row| row.get(0),
        )
        .expect("count cascaded logs");
    assert_eq!(remaining_logs, 0);
}

#[test]
fn does_not_rebuild_a_schema_that_accepts_target_twenty() {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    conn.execute_batch(
        "CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
         CREATE TABLE habits (
           id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
           frequency_type TEXT NOT NULL,
           target_per_period INTEGER NOT NULL CHECK(target_per_period>0 AND target_per_period<=20),
           interval_days INTEGER, days_of_week TEXT, sort_order INTEGER NOT NULL,
           created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
         );
         CREATE TABLE habit_logs (
           id TEXT PRIMARY KEY, habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
           log_date TEXT NOT NULL, completed_at TEXT NOT NULL, note TEXT,
           count INTEGER NOT NULL DEFAULT 1 CHECK(count>=1), created_at TEXT NOT NULL
         );
          ;",
    )
    .expect("create semantically valid schema");
    let habit_id = fixture_token(&conn);
    let timestamp = fixture_timestamp();
    let habit_name = fixture_token(&conn);
    let color = fixture_color();
    conn.execute(
        "INSERT INTO habits VALUES (?1, ?2, ?3, 'daily', 20, NULL, NULL, 0, ?4, ?4, NULL)",
        (&habit_id, &habit_name, &color, &timestamp),
    )
    .expect("insert valid-schema fixture");
    record_versions(&conn, 9);
    let before: String = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'habits'",
            [],
            |row| row.get(0),
        )
        .expect("inspect schema before repair");

    let db = Db {
        conn: Mutex::new(conn),
    };
    db.run_migrations().expect("validate progressive schema");
    let conn = db.conn.lock().unwrap();
    let after: String = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'habits'",
            [],
            |row| row.get(0),
        )
        .expect("inspect schema after repair");
    assert_eq!(after, before);
}

#[test]
fn repairs_an_existing_malformed_count_column() {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    conn.pragma_update(None, "foreign_keys", "ON")
        .expect("enable foreign keys");
    conn.execute_batch(
        "CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
         CREATE TABLE habits (
           id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
           frequency_type TEXT NOT NULL,
           target_per_period INTEGER NOT NULL CHECK(target_per_period > 0 AND target_per_period <= 20),
           interval_days INTEGER, days_of_week TEXT, sort_order INTEGER NOT NULL,
           created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
         );
         CREATE TABLE habit_logs (
           id TEXT PRIMARY KEY, habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
           log_date TEXT NOT NULL, completed_at TEXT NOT NULL, note TEXT,
           count TEXT, created_at TEXT NOT NULL,
           UNIQUE (habit_id, log_date)
         );
         INSERT INTO habits VALUES (
           lower(hex(randomblob(16))), 'fixture habit', '#123456', 'daily', 20,
           NULL, NULL, 0, '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', NULL
         );
         INSERT INTO habit_logs
            SELECT lower(hex(randomblob(16))), id, '2020-01-02',
                   '2020-01-02T00:00:00.000Z', NULL, '2', '2020-01-02T00:00:00.000Z'
            FROM habits;",
    )
    .expect("create malformed schema");
    conn.execute(
        "INSERT INTO habit_logs
         SELECT lower(hex(randomblob(16))), id, '2020-01-03',
                '2020-01-03T00:00:00.000Z', NULL, '2abc', '2020-01-03T00:00:00.000Z'
         FROM habits",
        [],
    )
    .expect("insert partially numeric count");
    record_versions(&conn, 9);

    let db = Db {
        conn: Mutex::new(conn),
    };
    db.run_migrations().expect("repair malformed count");
    let conn = db.conn.lock().unwrap();

    let count_definition: (i64, String) = conn
        .query_row(
            "SELECT \"notnull\", COALESCE(dflt_value, '')
             FROM pragma_table_info('habit_logs') WHERE name = 'count'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("inspect repaired count");
    assert_eq!(count_definition, (1, "1".to_owned()));

    let count: i64 = conn
        .query_row(
            "SELECT count FROM habit_logs WHERE log_date = '2020-01-02'",
            [],
            |row| row.get(0),
        )
        .expect("read normalized count");
    assert_eq!(count, 2);

    let invalid_count: i64 = conn
        .query_row(
            "SELECT count FROM habit_logs WHERE log_date = '2020-01-03'",
            [],
            |row| row.get(0),
        )
        .expect("read invalid count normalization");
    assert_eq!(invalid_count, 1);
}

fn fixture_uuid(conn: &Connection) -> String {
    let raw = fixture_token(conn);
    let variant = ["8", "9", "a", "b"][(raw.as_bytes()[0] % 4) as usize];
    format!(
        "{}-{}-4{}-{}{}-{}",
        &raw[0..8],
        &raw[8..12],
        &raw[13..16],
        variant,
        &raw[17..20],
        &raw[20..32]
    )
}

fn is_uuid_shape(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 36 {
        return false;
    }
    if bytes[8] != b'-' || bytes[13] != b'-' || bytes[18] != b'-' || bytes[23] != b'-' {
        return false;
    }
    if bytes[14] != b'4' {
        return false;
    }
    if !matches!(bytes[19], b'8' | b'9' | b'a' | b'b' | b'A' | b'B') {
        return false;
    }
    bytes
        .iter()
        .enumerate()
        .filter(|(index, _)| ![8, 13, 18, 23].contains(index))
        .all(|(_, byte)| byte.is_ascii_hexdigit())
}

fn schedule_base_db() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    conn.pragma_update(None, "foreign_keys", "ON")
        .expect("enable foreign keys");
    conn.execute_batch(
        "CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);",
    )
    .expect("create schema_version");
    conn.execute_batch(include_str!("migrations/001_init.sql"))
        .expect("create habits schema for progressive repair");
    conn
}

const NEW_SCHEDULE_SLOTS_DDL: &str = "CREATE TABLE schedule_block_slots (
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
    CREATE INDEX idx_schedule_block_slots_day ON schedule_block_slots(day_of_week);";

const NEW_SCHEDULE_BLOCKS_DDL: &str = "CREATE TABLE schedule_blocks (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      color         TEXT NOT NULL,
      sort_order    REAL NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );";

const INTERMEDIATE_SCHEDULE_BLOCKS_DDL: &str = "CREATE TABLE schedule_blocks (
      id            TEXT PRIMARY KEY,
      start_minutes INTEGER NOT NULL CHECK (start_minutes >= 0 AND start_minutes < 1440),
      end_minutes   INTEGER NOT NULL CHECK (end_minutes > 0 AND end_minutes <= 1440),
      title         TEXT NOT NULL,
      color         TEXT NOT NULL,
      sort_order    REAL NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      CHECK (end_minutes > start_minutes)
    );";

fn run_schedule_repair(conn: Connection) -> Db {
    let db = Db {
        conn: Mutex::new(conn),
    };
    db.run_migrations().expect("repair schedule schema");
    db
}

#[test]
fn repairs_full_old_schedule_shape_preserving_rows_as_slots() {
    let conn = schedule_base_db();
    conn.execute_batch(include_str!("migrations/005_weekly_schedule.sql"))
        .expect("create 005 schedule schema");
    let block_id = fixture_uuid(&conn);
    let timestamp = fixture_timestamp();
    let title = fixture_token(&conn);
    conn.execute(
        "INSERT INTO schedule_blocks
           (id, day_of_week, start_minutes, end_minutes, title, color, sort_order, created_at, updated_at)
         VALUES (?1, 0, 950, 1085, ?2, 'lavender', 0, ?3, ?3)",
        (&block_id, &title, &timestamp),
    )
    .expect("insert old-shape block");
    record_versions(&conn, 9);

    let db = run_schedule_repair(conn);
    let conn = db.conn.lock().unwrap();

    let has_start: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('schedule_blocks') WHERE name = 'start_minutes')",
            [],
            |row| row.get(0),
        )
        .expect("inspect repaired blocks");
    assert!(!has_start, "old time columns must be gone");

    let preserved: (String, String) = conn
        .query_row(
            "SELECT title, color FROM schedule_blocks WHERE id = ?1",
            [&block_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("find preserved block");
    assert_eq!(preserved, (title, "lavender".to_owned()));

    let slot: (String, String, i64, i64, i64) = conn
        .query_row(
            "SELECT id, block_id, day_of_week, start_minutes, end_minutes FROM schedule_block_slots",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .expect("find migrated slot");
    assert_eq!(slot.1, block_id);
    assert_eq!((slot.2, slot.3, slot.4), (0, 950, 1085));
    assert!(
        is_uuid_shape(&slot.0),
        "migrated slot id must be UUID, got {}",
        slot.0
    );
}

#[test]
fn repairs_intermediate_schedule_shape_without_cascade_wipe() {
    let conn = schedule_base_db();
    conn.execute_batch(INTERMEDIATE_SCHEDULE_BLOCKS_DDL)
        .expect("create intermediate schedule schema");
    conn.execute_batch(NEW_SCHEDULE_SLOTS_DDL)
        .expect("create slots table");
    let block_id = fixture_uuid(&conn);
    let slot_id = fixture_uuid(&conn);
    let timestamp = fixture_timestamp();
    let title = fixture_token(&conn);
    conn.execute(
        "INSERT INTO schedule_blocks
           (id, start_minutes, end_minutes, title, color, sort_order, created_at, updated_at)
         VALUES (?1, 950, 1085, ?2, 'green', 0, ?3, ?3)",
        (&block_id, &title, &timestamp),
    )
    .expect("insert intermediate block");
    conn.execute(
        "INSERT INTO schedule_block_slots
           (id, block_id, day_of_week, start_minutes, end_minutes, created_at, updated_at)
         VALUES (?1, ?2, 2, 600, 660, ?3, ?3)",
        (&slot_id, &block_id, &timestamp),
    )
    .expect("insert pre-existing slot");
    record_versions(&conn, 9);

    let db = run_schedule_repair(conn);
    let conn = db.conn.lock().unwrap();

    let has_start: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('schedule_blocks') WHERE name = 'start_minutes')",
            [],
            |row| row.get(0),
        )
        .expect("inspect repaired blocks");
    assert!(!has_start, "intermediate time columns must be gone");

    let preserved: String = conn
        .query_row(
            "SELECT title FROM schedule_blocks WHERE id = ?1",
            [&block_id],
            |row| row.get(0),
        )
        .expect("find preserved block");
    assert_eq!(preserved, title);

    let slot: (String, i64, i64, i64) = conn
        .query_row(
            "SELECT id, day_of_week, start_minutes, end_minutes FROM schedule_block_slots WHERE block_id = ?1",
            [&block_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .expect("pre-existing slot must survive the rebuild");
    assert_eq!(slot, (slot_id, 2, 600, 660));
}

#[test]
fn leaves_new_schedule_shape_untouched() {
    let conn = schedule_base_db();
    conn.execute_batch(NEW_SCHEDULE_BLOCKS_DDL)
        .expect("create new schedule blocks");
    conn.execute_batch(NEW_SCHEDULE_SLOTS_DDL)
        .expect("create slots table");
    let block_id = fixture_uuid(&conn);
    let slot_id = fixture_uuid(&conn);
    let timestamp = fixture_timestamp();
    conn.execute(
        "INSERT INTO schedule_blocks (id, title, color, sort_order, created_at, updated_at)
         VALUES (?1, 'Materia', 'lavender', 0, ?2, ?2)",
        (&block_id, &timestamp),
    )
    .expect("insert new-shape block");
    conn.execute(
        "INSERT INTO schedule_block_slots
           (id, block_id, day_of_week, start_minutes, end_minutes, created_at, updated_at)
         VALUES (?1, ?2, 0, 950, 1085, ?3, ?3)",
        (&slot_id, &block_id, &timestamp),
    )
    .expect("insert new-shape slot");
    record_versions(&conn, 10);

    let db = run_schedule_repair(conn);
    let conn = db.conn.lock().unwrap();

    let slot: (String, String, i64, i64, i64) = conn
        .query_row(
            "SELECT id, block_id, day_of_week, start_minutes, end_minutes FROM schedule_block_slots",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .expect("find untouched slot");
    assert_eq!(slot, (slot_id, block_id, 0, 950, 1085));
}

#[test]
fn normalizes_slot_prefixed_ids_to_uuid() {
    let conn = schedule_base_db();
    conn.execute_batch(NEW_SCHEDULE_BLOCKS_DDL)
        .expect("create new schedule blocks");
    conn.execute_batch(NEW_SCHEDULE_SLOTS_DDL)
        .expect("create slots table");
    let block_id = fixture_uuid(&conn);
    let timestamp = fixture_timestamp();
    conn.execute(
        "INSERT INTO schedule_blocks (id, title, color, sort_order, created_at, updated_at)
         VALUES (?1, 'Materia', 'lavender', 0, ?2, ?2)",
        (&block_id, &timestamp),
    )
    .expect("insert new-shape block");
    for day in [0, 3] {
        let legacy_id = format!("slot-{block_id}-{day}");
        conn.execute(
            "INSERT INTO schedule_block_slots
               (id, block_id, day_of_week, start_minutes, end_minutes, created_at, updated_at)
             VALUES (?1, ?2, ?3, 950, 1085, ?4, ?4)",
            (&legacy_id, &block_id, day, &timestamp),
        )
        .expect("insert legacy slot id");
    }
    record_versions(&conn, 9);

    let db = run_schedule_repair(conn);
    let conn = db.conn.lock().unwrap();

    let mut stmt = conn
        .prepare("SELECT id, block_id, day_of_week FROM schedule_block_slots ORDER BY day_of_week")
        .expect("prepare slots");
    let rows: Vec<(String, String, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .expect("query slots")
        .filter_map(|r| r.ok())
        .collect();
    assert_eq!(rows.len(), 2);
    assert!(
        is_uuid_shape(&rows[0].0),
        "slot id must be UUID, got {}",
        rows[0].0
    );
    assert!(
        is_uuid_shape(&rows[1].0),
        "slot id must be UUID, got {}",
        rows[1].0
    );
    assert_ne!(rows[0].0, rows[1].0, "normalized ids must be distinct");
    assert_eq!((&rows[0].1, rows[0].2), (&block_id, 0));
    assert_eq!((&rows[1].1, rows[1].2), (&block_id, 3));
}

#[test]
fn accepts_new_block_and_slot_after_schedule_repair() {
    let conn = schedule_base_db();
    conn.execute_batch(INTERMEDIATE_SCHEDULE_BLOCKS_DDL)
        .expect("create intermediate schedule schema");
    conn.execute_batch(NEW_SCHEDULE_SLOTS_DDL)
        .expect("create slots table");
    record_versions(&conn, 9);

    let db = run_schedule_repair(conn);
    let conn = db.conn.lock().unwrap();

    let block_id = fixture_uuid(&conn);
    let slot_id = fixture_uuid(&conn);
    let timestamp = fixture_timestamp();
    conn.execute(
        "INSERT INTO schedule_blocks (id, title, color, sort_order, created_at, updated_at)
         VALUES (?1, 'AACSW', 'lavender', 0, ?2, ?2)",
        (&block_id, &timestamp),
    )
    .expect("insert block after repair");
    // 15:50–18:05: el caso del ticket ya no debe fallar con
    // NOT NULL constraint failed: schedule_blocks.start_minutes.
    conn.execute(
        "INSERT INTO schedule_block_slots
           (id, block_id, day_of_week, start_minutes, end_minutes, created_at, updated_at)
         VALUES (?1, ?2, 0, 950, 1085, ?3, ?3)",
        (&slot_id, &block_id, &timestamp),
    )
    .expect("insert slot after repair");

    let counts: (i64, i64) = conn
        .query_row(
            "SELECT (SELECT count(*) FROM schedule_blocks WHERE id = ?1),
                    (SELECT count(*) FROM schedule_block_slots WHERE id = ?2)",
            (&block_id, &slot_id),
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("count inserted rows");
    assert_eq!(counts, (1, 1));
}

#[test]
fn normalizes_invalid_values_in_a_canonical_count_column() {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    conn.pragma_update(None, "foreign_keys", "ON")
        .expect("enable foreign keys");
    conn.execute_batch(
        "CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
         CREATE TABLE habits (
           id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
           frequency_type TEXT NOT NULL,
           target_per_period INTEGER NOT NULL CHECK(target_per_period > 0 AND target_per_period <= 20),
           interval_days INTEGER, days_of_week TEXT, sort_order INTEGER NOT NULL,
           created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
         );
         CREATE TABLE habit_logs (
           id TEXT PRIMARY KEY, habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
           log_date TEXT NOT NULL, completed_at TEXT NOT NULL, note TEXT,
           count INTEGER NOT NULL DEFAULT 1 CHECK(count >= 1), created_at TEXT NOT NULL,
           UNIQUE (habit_id, log_date)
         );
         INSERT INTO habits VALUES (
           lower(hex(randomblob(16))), 'fixture habit', '#123456', 'daily', 20,
           NULL, NULL, 0, '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', NULL
         );
         INSERT INTO habit_logs
           SELECT lower(hex(randomblob(16))), id, '2020-01-02',
                  '2020-01-02T00:00:00.000Z', NULL, '2abc', '2020-01-02T00:00:00.000Z'
           FROM habits;",
    )
    .expect("create canonical schema with malformed value");
    record_versions(&conn, 9);

    let db = Db {
        conn: Mutex::new(conn),
    };
    db.run_migrations()
        .expect("normalize canonical count values");
    let conn = db.conn.lock().unwrap();
    let count: i64 = conn
        .query_row("SELECT count FROM habit_logs", [], |row| row.get(0))
        .expect("read normalized count");
    assert_eq!(count, 1);
}

#[test]
fn adds_exams_table_additively_and_preserves_existing_data() {
    let (db, habit_id, _log_id, _note) = legacy_db();
    db.run_migrations().expect("apply exams migration");

    let conn = db.conn.lock().unwrap();

    let exams_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='exams')",
            [],
            |row| row.get(0),
        )
        .expect("check exams table");
    assert!(exams_exists, "la migración debe crear la tabla exams");

    // La data previa sobrevive intacta (migración aditiva).
    let habit_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM habits WHERE id = ?1",
            [&habit_id],
            |row| row.get(0),
        )
        .expect("count legacy habit");
    assert_eq!(habit_count, 1);
}

#[test]
fn exams_schema_applies_expected_defaults_on_a_fresh_database() {
    let db = Db::open_in_memory().expect("fresh database");
    let conn = db.conn.lock().unwrap();

    conn.execute(
        "INSERT INTO exams (id, title, date, created_at, updated_at)
         VALUES ('exam-fixture', 'Parcial', '2026-07-01',
                 '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')",
        [],
    )
    .expect("insert exam with defaults");

    let (status, fallback_color, topics, grade): (String, String, String, Option<f64>) = conn
        .query_row(
            "SELECT status, fallback_color, topics, grade FROM exams WHERE id = 'exam-fixture'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .expect("read exam defaults");
    assert_eq!(status, "pendiente");
    assert_eq!(fallback_color, "lavender");
    assert_eq!(topics, "[]");
    assert_eq!(grade, None);
}

#[test]
fn exams_grade_round_trips_and_enforces_range() {
    let db = Db::open_in_memory().expect("fresh database");
    let conn = db.conn.lock().unwrap();

    conn.execute(
        "INSERT INTO exams (id, title, date, status, grade, created_at, updated_at)
         VALUES ('exam-grade', 'Parcial', '2026-07-01', 'rendido', 8.5,
                 '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')",
        [],
    )
    .expect("insert exam with grade");

    let grade: Option<f64> = conn
        .query_row(
            "SELECT grade FROM exams WHERE id = 'exam-grade'",
            [],
            |row| row.get(0),
        )
        .expect("read grade");
    assert_eq!(grade, Some(8.5));

    // "Sin nota" se representa como NULL: limpiarla la deja sin valor.
    conn.execute("UPDATE exams SET grade = NULL WHERE id = 'exam-grade'", [])
        .expect("clear grade");
    let cleared: Option<f64> = conn
        .query_row(
            "SELECT grade FROM exams WHERE id = 'exam-grade'",
            [],
            |row| row.get(0),
        )
        .expect("read cleared grade");
    assert_eq!(cleared, None);

    // El CHECK rechaza una nota fuera del rango 0–10.
    let out_of_range = conn.execute(
        "INSERT INTO exams (id, title, date, status, grade, created_at, updated_at)
         VALUES ('exam-bad', 'Parcial', '2026-07-01', 'rendido', 11,
                 '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')",
        [],
    );
    assert!(out_of_range.is_err(), "grade > 10 debe violar el CHECK");
}

#[test]
fn exams_topics_round_trip_and_reject_invalid_json() {
    let db = Db::open_in_memory().expect("fresh database");
    let conn = db.conn.lock().unwrap();

    let topics = r#"[{"id":"t1","title":"Límites","completed":false}]"#;
    conn.execute(
        "INSERT INTO exams (id, title, date, topics, created_at, updated_at)
         VALUES ('exam-topics', 'Parcial', '2026-07-01', ?1,
                 '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')",
        [topics],
    )
    .expect("insert exam with topics");

    let stored: String = conn
        .query_row(
            "SELECT topics FROM exams WHERE id = 'exam-topics'",
            [],
            |row| row.get(0),
        )
        .expect("read topics");
    assert_eq!(stored, topics);

    // El CHECK(json_valid) rechaza un string que no es JSON.
    let invalid = conn.execute(
        "INSERT INTO exams (id, title, date, topics, created_at, updated_at)
         VALUES ('exam-bad-topics', 'Parcial', '2026-07-01', 'no-json',
                 '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')",
        [],
    );
    assert!(invalid.is_err(), "topics inválido debe violar el CHECK");
}
