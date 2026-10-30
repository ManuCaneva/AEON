-- Archivado deja de ser una acción de usuario. Recupera los registros que
-- estaban ocultos para que sigan disponibles en sus listas normales.
UPDATE habits SET archived_at = NULL;
UPDATE goals SET archived_at = NULL;
UPDATE tasks SET archived_at = NULL;
