use crate::db::{Db, DbResult, IntoStringErr};
use rusqlite::params;
use tauri::State;

/// Borra todo el contenido de la app.
///
/// El alcance (qué tablas y qué claves de config son datos) lo define el
/// frontend en `dataScope.ts`; acá solo se ejecuta el borrado en una
/// transacción. La config conservada (distribución de Widgets, tokens de
/// Google, wallpaper, ajustes, primera ejecución) vive en `config` y no se
/// toca salvo las claves que el frontend envía en `data_config_keys`.
#[tauri::command]
pub fn clear_all_data(
    db: State<'_, Db>,
    tables: Vec<String>,
    data_config_keys: Vec<String>,
) -> Result<(), String> {
    // Las tablas llegan del frontend. Se restringe el identificador a
    // `[a-z0-9_]` y se entrecomilla para evitar inyección SQL.
    for table in &tables {
        let valid = !table.is_empty()
            && table
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
        if !valid {
            return Err(format!("nombre de tabla inválido: {table}"));
        }
    }

    let mut conn = db.conn.lock().unwrap();
    let result: DbResult<()> = (|| {
        let tx = conn.transaction()?;
        let mut stmt = String::new();
        for table in &tables {
            stmt.push_str(&format!("DELETE FROM \"{table}\";"));
        }
        tx.execute_batch(&stmt)?;
        for key in &data_config_keys {
            tx.execute("DELETE FROM config WHERE key = ?1", params![key])?;
        }
        tx.commit()?;
        Ok(())
    })();
    result.to_str_err()
}
