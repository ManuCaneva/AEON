use crate::db::{Db, DbError, DbResult, IntoStringErr};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct GoalFrequency {
    #[serde(rename = "type")]
    pub frequency_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interval_days: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days_of_week: Option<String>,
}

fn default_direction() -> String {
    String::from("up")
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateGoalInput {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub color: String,
    pub target: i32,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default = "default_direction")]
    pub direction: String,
    pub frequency: GoalFrequency,
    #[serde(default)]
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateGoalInput {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub color: Option<String>,
    pub target: Option<i32>,
    pub unit: Option<Option<String>>,
    pub direction: Option<String>,
    pub frequency: Option<GoalFrequency>,
    pub sort_order: Option<i32>,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct GoalRow {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub color: String,
    pub target: i32,
    pub unit: Option<String>,
    pub direction: String,
    pub frequency_type: String,
    pub interval_days: Option<i32>,
    pub days_of_week: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
}

fn row_to_goal(r: &rusqlite::Row<'_>) -> rusqlite::Result<GoalRow> {
    Ok(GoalRow {
        id: r.get("id")?,
        title: r.get("title")?,
        description: r.get("description")?,
        color: r.get("color")?,
        target: r.get("target")?,
        unit: r.get("unit")?,
        direction: r.get("direction")?,
        frequency_type: r.get("frequency_type")?,
        interval_days: r.get("interval_days")?,
        days_of_week: r.get("days_of_week")?,
        sort_order: r.get("sort_order")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
        archived_at: r.get("archived_at")?,
    })
}

fn frequency_to_parts(f: &GoalFrequency) -> (String, Option<i32>, Option<String>) {
    (
        f.frequency_type.clone(),
        f.interval_days,
        f.days_of_week.clone(),
    )
}

#[tauri::command]
pub fn create_goal(db: State<'_, Db>, input: CreateGoalInput) -> Result<GoalRow, String> {
    let result: DbResult<GoalRow> = (|| {
        let conn = db.conn.lock().unwrap();
        let (ftype, idays, dows) = frequency_to_parts(&input.frequency);

        conn.execute(
            "INSERT INTO goals (id, title, description, color, target, unit, direction, frequency_type, interval_days, days_of_week, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                input.id,
                input.title,
                input.description,
                input.color,
                input.target,
                input.unit,
                input.direction,
                ftype,
                idays,
                dows,
                input.sort_order,
                input.created_at,
                input.updated_at,
            ],
        )?;

        let row = conn
            .query_row(
                "SELECT * FROM goals WHERE id = ?1",
                params![input.id],
                row_to_goal,
            )
            .optional()?
            .ok_or(DbError::NotFound)?;
        Ok(row)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn list_goals(db: State<'_, Db>, include_archived: bool) -> Result<Vec<GoalRow>, String> {
    let result: DbResult<Vec<GoalRow>> = (|| {
        let conn = db.conn.lock().unwrap();
        let sql = if include_archived {
            "SELECT * FROM goals ORDER BY sort_order ASC, created_at ASC"
        } else {
            "SELECT * FROM goals WHERE archived_at IS NULL ORDER BY sort_order ASC, created_at ASC"
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map([], row_to_goal)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn update_goal(db: State<'_, Db>, input: UpdateGoalInput) -> Result<GoalRow, String> {
    let result: DbResult<GoalRow> = (|| {
        let conn = db.conn.lock().unwrap();

        let (ftype, idays, dows) = match &input.frequency {
            Some(f) => frequency_to_parts(f),
            None => (String::new(), None, None),
        };

        conn.execute(
            "UPDATE goals SET
                title          = COALESCE(?2, title),
                description    = CASE WHEN ?3 = 1 THEN ?4 ELSE description END,
                color          = COALESCE(?5, color),
                target         = COALESCE(?6, target),
                unit           = CASE WHEN ?7 = 1 THEN ?8 ELSE unit END,
                direction      = COALESCE(?9, direction),
                frequency_type = COALESCE(NULLIF(?10, ''), frequency_type),
                interval_days  = CASE WHEN ?10 != '' THEN ?11 ELSE interval_days END,
                days_of_week   = CASE WHEN ?10 != '' THEN ?12 ELSE days_of_week END,
                sort_order     = COALESCE(?13, sort_order),
                updated_at     = ?14
             WHERE id = ?1",
            params![
                input.id,
                input.title,
                input.description.is_some() as i32,
                input.description.flatten(),
                input.color,
                input.target,
                input.unit.is_some() as i32,
                input.unit.flatten(),
                input.direction,
                ftype,
                idays,
                dows,
                input.sort_order,
                input.updated_at,
            ],
        )?;

        let row = conn
            .query_row(
                "SELECT * FROM goals WHERE id = ?1",
                params![input.id],
                row_to_goal,
            )
            .optional()?
            .ok_or(DbError::NotFound)?;
        Ok(row)
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn delete_goal(db: State<'_, Db>, id: String) -> Result<(), String> {
    let result: DbResult<()> = (|| {
        let conn = db.conn.lock().unwrap();
        let n = conn.execute("DELETE FROM goals WHERE id = ?1", params![id])?;
        if n == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn archive_goal(db: State<'_, Db>, id: String, archived_at: String) -> Result<(), String> {
    let result: DbResult<()> = (|| {
        let conn = db.conn.lock().unwrap();
        let n = conn.execute(
            "UPDATE goals SET archived_at = ?2, updated_at = ?2 WHERE id = ?1",
            params![id, archived_at],
        )?;
        if n == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    })();
    result.to_str_err()
}

#[tauri::command]
pub fn restore_goal(db: State<'_, Db>, id: String, updated_at: String) -> Result<(), String> {
    let result: DbResult<()> = (|| {
        let conn = db.conn.lock().unwrap();
        let n = conn.execute(
            "UPDATE goals SET archived_at = NULL, updated_at = ?2 WHERE id = ?1",
            params![id, updated_at],
        )?;
        if n == 0 {
            return Err(DbError::NotFound);
        }
        Ok(())
    })();
    result.to_str_err()
}
