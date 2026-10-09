export const COLS = 12
export const ROWS = 10

/** Espaciado visual entre widgets vecinos, en px (ver DashboardView). */
export const GRID_GAP = 4

/**
 * Inset uniforme de cada item respecto de los bordes de su celda, en px
 * (GRID_GAP/2 por lado). La grilla CSS no usa `gap`: el aire lo aporta este
 * inset, así la card queda centrada en su celda con el mismo padding en las
 * 4 direcciones y la distancia entre widgets vecinos sigue siendo GRID_GAP.
 */
export const GRID_ITEM_INSET = GRID_GAP / 2

/**
 * Orden de apilado de los ítems de la grilla en modo edición: la cruz que
 * sobresale por arriba a la derecha debe quedar pintada por encima de los
 * vecinos que invade. Por eso el z-index crece hacia abajo (y) y hacia la
 * izquierda (COLS - x), y cada celda recibe un valor único y positivo.
 */
export function itemZIndex(x: number, y: number): number {
  return y * COLS + (COLS - x)
}

/**
 * El ítem en gesto (arrastre/redimensionado) se pinta por encima de la zona de
 * destino, y esta por encima de cualquier ítem en reposo. itemZIndex nunca pasa
 * de COLS*ROWS.
 */
export const DROP_ZONE_Z_INDEX = COLS * ROWS + 1
export const DRAGGING_Z_INDEX = COLS * ROWS + 2
