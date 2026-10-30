// =============================================================
// commands/habits.rs — CRUD de hábitos
//
// Reglas:
//   * Solo I/O. Cero cálculo de rachas, "is_due_today", etc.
//   * Acepta JSON ya validado por Zod en el frontend.
//   * Devuelve filas crudas (row shape). El frontend las mapea a dominio.
// =============================================================

use crate::db::{Db, DbError, DbResult, IntoStringErr};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HabitFrequency {
    #[serde(rename = "type")]
    pub frequency_type: String,
    #[serde(default = "default_target")]
    pub target_per_period: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_days: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days_of_week: Option<String>,
}

fn default_target() -> i32 {
    1
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateHabitInput {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    pub color: String,
    pub frequency: HabitFrequency,
    #[serde(default)]
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateHabitInput {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub icon: Option<Option<String>>,
    pub color: Option<String>,
    pub frequency: Option<HabitFrequency>,
    pub sort_order: Option<i32>,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct HabitRow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: String,
    pub frequency_type: String,
    pub target_per_period: i32,
    pub interval_days: Option<i32>,
    pub days_of_week: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
}

fn row_to_habit(r: &rusqlite::Row<'_>) -> rusqlite::Result<HabitRow> {
    Ok(HabitRow {
        id: r.get("id")?,
        name: r.get("name")?,
        description: r.get("description")?,
        icon: r.get("icon")?,
        color: r.get("color")?,
        frequency_type: r.get("frequency_type")?,
        target_per_period: r.get("target_per_period")?,
        interval_days: r.get("interval_days")?,
        days_of_week: r.get("days_of_week")?,
        sort_order: r.get("sort_order")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
        archived_at: r.get("archived_at")?,
    })
}

fn frequency_to_parts(f: &HabitFrequency) -> (String, i32, Option<i32>, Option<String>) {
    (
        f.frequency_type.clone(),
        f.target_per_period,
        f.interval_days,
        f.days_of_week.clone(),
    )
}

#[tauri::command]
pub fn create_habit(db: State<'_, Db>, input: CreateHabitInput) -> Result<HabitRow, String> {
    let result: DbResult<HabitRow> = (|| {
        let conn = db.conn.lock().unwrap();
        let (ftype, target, idays, dows) = frequency_to_parts(&input.frequency);

        conn.execute(
            "INSERT INTO habits (id, name, description, icon, color, frequency_type, target_per_period, interval_days, days_of_week, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                input.id,
                input.name,
                input.description,
                input.icon,
                input.color,
                ftype,
                target,
                idays,
                dows,
                input.sort_order,
                input.created_at,
                input.updated_at,
            ],
        )?;

        let row = conn
            .query_row(
                "SELECT * FROM habits WHERE id = ?1",
                params![input.id],
                row_to_habit,
            )
            .optional()?
            .ok_or(DbError::NotFound)?;
        Ok(row)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn list_habits(db: State<'_, Db>, include_archived: bool) -> Result<Vec<HabitRow>, String> {
    let result: DbResult<Vec<HabitRow>> = (|| {
        let conn = db.conn.lock().unwrap();
        let sql = if include_archived {
            "SELECT * FROM habits ORDER BY sort_order ASC, created_at ASC"
        } else {
            "SELECT * FROM habits WHERE archived_at IS NULL ORDER BY sort_order ASC, created_at ASC"
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map([], row_to_habit)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn update_habit(db: State<'_, Db>, input: UpdateHabitInput) -> Result<HabitRow, String> {
    let result: DbResult<HabitRow> = (|| {
        let conn = db.conn.lock().unwrap();

        let (ftype, target, idays, dows) = match &input.frequency {
            Some(f) => frequency_to_parts(f),
            None => (String::new(), 0, None, None),
        };

        conn.execute(
            "UPDATE habits SET
                name              = COALESCE(?2, name),
                description       = CASE WHEN ?3 = 1 THEN ?4 ELSE description END,
                icon              = CASE WHEN ?5 = 1 THEN ?6 ELSE icon END,
                color             = COALESCE(?7, color),
                frequency_type    = COALESCE(NULLIF(?8, ''), frequency_type),
                target_per_period = CASE WHEN ?8 != '' THEN ?9 ELSE target_per_period END,
                interval_days     = CASE WHEN ?8 = 'interval' THEN ?10 ELSE NULL END,
                days_of_week      = CASE WHEN ?8 != '' THEN ?11 ELSE days_of_week END,
                sort_order        = COALESCE(?12, sort_order),
                updated_at        = ?13
             WHERE id = ?1",
            params![
                input.id,
                input.name,
                input.description.is_some() as i32,
                input.description.flatten(),
                input.icon.is_some() as i32,
                input.icon.flatten(),
                input.color,
                ftype,
                target,
                idays,
                dows,
                input.sort_order,
                input.updated_at,
            ],
        )?;

        let row = conn
            .query_row(
                "SELECT * FROM habits WHERE id = ?1",
                params![input.id],
                row_to_habit,
            )
            .optional()?
            .ok_or(DbError::NotFound)?;
        Ok(row)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn delete_habit(db: State<'_, Db>, id: String) -> Result<(), String> {
    let result: DbResult<()> = (|| {
        let conn = db.conn.lock().unwrap();
        let n = conn.execute("DELETE FROM habits WHERE id = ?1", params![id])?;
        if n == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    })();
    result.to_str_err()
}
