import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * La legibilidad de las clases glass nunca depende de `backdrop-filter`.
 *
 * El WebKitGTK que empaqueta la AppImage (build de `ubuntu-24.04`) parsea
 * `backdrop-filter` pero no siempre lo renderiza, y `@supports` no distingue
 * "se parsea" de "se dibuja". Si el alpha bajara dentro del bloque, los
 * popups volverían a ser transparentes exactamente en los runtimes donde el
 * blur no se dibuja. El blur es enhancement puro: solo suma frosting sobre un
 * fondo que ya es legible por sí solo.
 */

/** Piso de legibilidad: sin blur, el fondo del panel se lee igual. */
const PISO_ALPHA = 0.9

function css(): string {
  return readFileSync('src/styles/tailwind.css', 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')
}

interface Bloque {
  cuerpo: string
  inicio: number
  fin: number
}

/** Bloques `{ … }` cuya cabecera matchea `cabecera` (que termina en `{`). */
function bloquesCon(cabecera: RegExp, texto: string): Bloque[] {
  const bloques: Bloque[] = []
  const re = new RegExp(cabecera.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    let profundidad = 1
    let i = re.lastIndex
    while (i < texto.length && profundidad > 0) {
      if (texto[i] === '{') profundidad++
      else if (texto[i] === '}') profundidad--
      i++
    }
    bloques.push({ cuerpo: texto.slice(re.lastIndex, i - 1), inicio: m.index, fin: i })
  }
  return bloques
}

/** Reglas `.clase { … }` (matchea la clase exacta, no `.clase-otra`). */
function reglasDeClase(texto: string, clase: string): string[] {
  return bloquesCon(new RegExp(`\\.${clase}(?![\\w-])\\s*\\{`), texto).map((b) => b.cuerpo)
}

/** El CSS sin los bloques `@supports { … }` completos. */
function sinSupports(texto: string): string {
  let salida = texto
  for (const b of bloquesCon(/@supports[^{]*\{/, texto).reverse()) {
    salida = salida.slice(0, b.inicio) + salida.slice(b.fin)
  }
  return salida
}

/** Alphas de fondo de un bloque: `rgb(var(…) / 0.9)` y `@apply bg-surface-1/80`. */
function alphasDeFondo(bloque: string): number[] {
  const alphas: number[] = []
  for (const m of bloque.matchAll(/background-color:[^;]*?\/\s*([\d.]+)\s*\)/g)) {
    alphas.push(Number(m[1]))
  }
  for (const m of bloque.matchAll(/@apply[^;]*?\bbg-[\w-]+\/(\d+)\b/g)) {
    alphas.push(Number(m[1]) / 100)
  }
  return alphas
}

describe('glass legible sin backdrop-filter', () => {
  it('.glass y .glass-overlay fuera de @supports declaran fondo propio con alpha ≥ piso y sin blur', () => {
    const fuera = sinSupports(css())
    for (const clase of ['glass', 'glass-overlay']) {
      const reglas = reglasDeClase(fuera, clase)
      expect(reglas.length).toBe(1)
      const alphas = alphasDeFondo(reglas[0])
      expect(alphas.length).toBeGreaterThan(0)
      for (const alpha of alphas) expect(alpha).toBeGreaterThanOrEqual(PISO_ALPHA)
      expect(reglas[0]).not.toContain('backdrop-filter')
    }
  })

  it('el blur vive solo en @supports y nunca baja el alpha bajo el piso', () => {
    const cuerpos = bloquesCon(/@supports[^{]*\{/, css()).map((b) => b.cuerpo)
    expect(cuerpos.length).toBeGreaterThan(0)
    for (const cuerpo of cuerpos) {
      for (const clase of ['glass', 'glass-overlay']) {
        const reglas = reglasDeClase(cuerpo, clase)
        expect(reglas.length).toBe(1)
        expect(reglas[0]).toContain('backdrop-filter')
        for (const alpha of alphasDeFondo(reglas[0])) {
          expect(alpha).toBeGreaterThanOrEqual(PISO_ALPHA)
        }
      }
    }
  })

  it('ningún valor de backdrop-filter usa var() (WebKit no lo soporta)', () => {
    // Solo declaraciones (línea que empieza con la propiedad), no la
    // condición del propio @supports.
    const declaraciones = /^[ \t]*(?:-webkit-)?backdrop-filter\s*:\s*([^;]+);/gm
    for (const m of css().matchAll(declaraciones)) {
      expect(m[1]).not.toContain('var(')
    }
  })
})
