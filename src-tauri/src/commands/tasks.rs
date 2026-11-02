use crate::db::{Db, DbError, DbResult, IntoStringErr};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskInput {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub color: String,
    pub status: String,
    #[serde(default)]
    pub due_date: Option<String>,
    // Bloque del Cronograma semanal (la materia) y vínculo opcional a un
    // evento del calendario (par calendar_id + event_id). #144: mismo modelo
    // que los exámenes; cero lógica acá, sólo persistencia.
    #[serde(default)]
    pub block_id: Option<String>,
    #[serde(default)]
    pub calendar_id: Option<String>,
    #[serde(default)]
    pub event_id: Option<String>,
    #[serde(default = "default_steps")]
    pub steps: String,
    #[serde(default)]
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

fn default_steps() -> String {
    "[]".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTaskInput {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub color: Option<String>,
    pub status: Option<String>,
    pub due_date: Option<Option<String>>,
    // Double-Option: None no toca el bloque; Some(None) lo desasocia.
    pub block_id: Option<Option<String>>,
    // Double-Option: None no toca el vínculo; Some(None) lo limpia;
    // Some(par) lo fija. El par se envía junto desde el frontend.
    pub calendar_id: Option<Option<String>>,
    pub event_id: Option<Option<String>>,
    pub steps: Option<String>,
    pub sort_order: Option<i32>,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct TaskRow {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub color: String,
    pub status: String,
    pub due_date: Option<String>,
    pub block_id: Option<String>,
    pub calendar_id: Option<String>,
    pub event_id: Option<String>,
    pub steps: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
}

fn row_to_task(r: &rusqlite::Row<'_>) -> rusqlite::Result<TaskRow> {
    Ok(TaskRow {
        id: r.get("id")?,
        title: r.get("title")?,
        description: r.get("description")?,
        color: r.get("color")?,
        status: r.get("status")?,
        due_date: r.get("due_date")?,
        block_id: r.get("block_id")?,
        calendar_id: r.get("calendar_id")?,
        event_id: r.get("event_id")?,
        steps: r.get("steps")?,
        sort_order: r.get("sort_order")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
        archived_at: r.get("archived_at")?,
    })
}

#[tauri::command]
pub fn create_task(db: State<'_, Db>, input: CreateTaskInput) -> Result<TaskRow, String> {
    let result: DbResult<TaskRow> = (|| {
        let conn = db.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO tasks (id, title, description, color, status, due_date, block_id, calendar_id, event_id, steps, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                input.id,
                input.title,
                input.description,
                input.color,
                input.status,
                input.due_date,
                input.block_id,
                input.calendar_id,
                input.event_id,
                input.steps,
                input.sort_order,
                input.created_at,
                input.updated_at,
            ],
        )?;

        let row = conn
            .query_row(
                "SELECT * FROM tasks WHERE id = ?1",
                params![input.id],
                row_to_task,
            )
            .optional()?
            .ok_or(DbError::NotFound)?;
        Ok(row)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn list_tasks(db: State<'_, Db>, include_archived: bool) -> Result<Vec<TaskRow>, String> {
    let result: DbResult<Vec<TaskRow>> = (|| {
        let conn = db.conn.lock().unwrap();
        let sql = if include_archived {
            "SELECT * FROM tasks ORDER BY sort_order ASC, created_at ASC"
        } else {
            "SELECT * FROM tasks WHERE archived_at IS NULL ORDER BY sort_order ASC, created_at ASC"
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map([], row_to_task)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn update_task(db: State<'_, Db>, input: UpdateTaskInput) -> Result<TaskRow, String> {
    let result: DbResult<TaskRow> = (|| {
        let conn = db.conn.lock().unwrap();

        conn.execute(
            "UPDATE tasks SET
                title       = COALESCE(?2, title),
                description = CASE WHEN ?3 = 1 THEN ?4 ELSE description END,
                color       = COALESCE(?5, color),
                status      = COALESCE(?6, status),
                due_date    = CASE WHEN ?7 = 1 THEN ?8 ELSE due_date END,
                block_id    = CASE WHEN ?9 = 1 THEN ?10 ELSE block_id END,
                calendar_id = CASE WHEN ?11 = 1 THEN ?12 ELSE calendar_id END,
                event_id    = CASE WHEN ?13 = 1 THEN ?14 ELSE event_id END,
                steps       = COALESCE(?15, steps),
                sort_order  = COALESCE(?16, sort_order),
                updated_at  = ?17
             WHERE id = ?1",
            params![
                input.id,
                input.title,
                input.description.is_some() as i32,
                input.description.flatten(),
                input.color,
                input.status,
                input.due_date.is_some() as i32,
                input.due_date.flatten(),
                input.block_id.is_some() as i32,
                input.block_id.flatten(),
                input.calendar_id.is_some() as i32,
                input.calendar_id.flatten(),
                input.event_id.is_some() as i32,
                input.event_id.flatten(),
                input.steps,
                input.sort_order,
                input.updated_at,
            ],
        )?;

        let row = conn
            .query_row(
                "SELECT * FROM tasks WHERE id = ?1",
                params![input.id],
                row_to_task,
            )
            .optional()?
            .ok_or(DbError::NotFound)?;
        Ok(row)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn delete_task(db: State<'_, Db>, id: String) -> Result<(), String> {
    let result: DbResult<()> = (|| {
        let conn = db.conn.lock().unwrap();
        let n = conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
        if n == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    })();
    result.to_str_err()
}
