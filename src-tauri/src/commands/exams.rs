use crate::db::{Db, DbError, DbResult, IntoStringErr};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

// Commands delgados de Examen: solo persisten. Cero lógica de negocio.
// El walking skeleton (#133) cablea título, fecha, estado, color de
// respaldo y orden; #138 agrega la nota (0–10, nullable); #136 agrega los
// temas embebidos como JSON string. El resto de las columnas T1 usan los
// defaults del SQL.

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateExamInput {
    pub id: String,
    pub title: String,
    pub date: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub grade: Option<f64>,
    #[serde(default = "default_fallback_color")]
    pub fallback_color: String,
    #[serde(default = "default_topics")]
    pub topics: String,
    #[serde(default)]
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

fn default_status() -> String {
    "pendiente".to_string()
}

fn default_fallback_color() -> String {
    "lavender".to_string()
}

fn default_topics() -> String {
    "[]".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateExamInput {
    pub id: String,
    pub title: Option<String>,
    pub date: Option<String>,
    pub status: Option<String>,
    // Double-Option: None no toca la nota; Some(None) la limpia; Some(n) la fija.
    pub grade: Option<Option<f64>>,
    pub fallback_color: Option<String>,
    pub topics: Option<String>,
    pub sort_order: Option<i32>,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct ExamRow {
    pub id: String,
    pub title: String,
    pub date: String,
    pub status: String,
    pub grade: Option<f64>,
    pub block_id: Option<String>,
    pub fallback_color: String,
    pub calendar_id: Option<String>,
    pub event_id: Option<String>,
    pub topics: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

fn row_to_exam(r: &rusqlite::Row<'_>) -> rusqlite::Result<ExamRow> {
    Ok(ExamRow {
        id: r.get("id")?,
        title: r.get("title")?,
        date: r.get("date")?,
        status: r.get("status")?,
        grade: r.get("grade")?,
        block_id: r.get("block_id")?,
        fallback_color: r.get("fallback_color")?,
        calendar_id: r.get("calendar_id")?,
        event_id: r.get("event_id")?,
        topics: r.get("topics")?,
        sort_order: r.get("sort_order")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
    })
}

#[tauri::command]
pub fn create_exam(db: State<'_, Db>, input: CreateExamInput) -> Result<ExamRow, String> {
    let result: DbResult<ExamRow> = (|| {
        let conn = db.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO exams (id, title, date, status, grade, fallback_color, topics, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                input.id,
                input.title,
                input.date,
                input.status,
                input.grade,
                input.fallback_color,
                input.topics,
                input.sort_order,
                input.created_at,
                input.updated_at,
            ],
        )?;

        let row = conn
            .query_row(
                "SELECT * FROM exams WHERE id = ?1",
                params![input.id],
                row_to_exam,
            )
            .optional()?
            .ok_or(DbError::NotFound)?;
        Ok(row)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn list_exams(db: State<'_, Db>) -> Result<Vec<ExamRow>, String> {
    let result: DbResult<Vec<ExamRow>> = (|| {
        let conn = db.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT * FROM exams ORDER BY date ASC, sort_order ASC, created_at ASC")?;
        let rows = stmt.query_map([], row_to_exam)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn update_exam(db: State<'_, Db>, input: UpdateExamInput) -> Result<ExamRow, String> {
    let result: DbResult<ExamRow> = (|| {
        let conn = db.conn.lock().unwrap();

        conn.execute(
            "UPDATE exams SET
                title          = COALESCE(?2, title),
                date           = COALESCE(?3, date),
                status         = COALESCE(?4, status),
                grade          = CASE WHEN ?5 = 1 THEN ?6 ELSE grade END,
                fallback_color = COALESCE(?7, fallback_color),
                topics         = COALESCE(?8, topics),
                sort_order     = COALESCE(?9, sort_order),
                updated_at     = ?10
             WHERE id = ?1",
            params![
                input.id,
                input.title,
                input.date,
                input.status,
                input.grade.is_some() as i32,
                input.grade.flatten(),
                input.fallback_color,
                input.topics,
                input.sort_order,
                input.updated_at,
            ],
        )?;

        let row = conn
            .query_row(
                "SELECT * FROM exams WHERE id = ?1",
                params![input.id],
                row_to_exam,
            )
            .optional()?
            .ok_or(DbError::NotFound)?;
        Ok(row)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn delete_exam(db: State<'_, Db>, id: String) -> Result<(), String> {
    let result: DbResult<()> = (|| {
        let conn = db.conn.lock().unwrap();
        let n = conn.execute("DELETE FROM exams WHERE id = ?1", params![id])?;
        if n == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    })();
    result.to_str_err()
}
