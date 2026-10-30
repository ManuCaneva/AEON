import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Contrato de la mascota de una sola ventana: disco de 100 px arriba y franja
 * de la pastilla debajo. La ventana se crea opaca (WebKitGTK no pinta completa
 * una superficie transparente) y el recorte nativo del sistema la ajusta a la
 * forma del disco y la pastilla. El arrastre nativo mueve las dos piezas juntas.
 */
describe('layout de la mascota de una sola ventana', () => {
  const css = readFileSync('src/styles/tailwind.css', 'utf-8')

  it('la raíz no recorta el contenido', () => {
    const rule = css.match(/\.pomodoro-mini-orb\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule![1]).toMatch(/overflow:\s*visible/)
  })

  it('el área del disco mide exactamente el disco', () => {
    const rule = css.match(/\.pomodoro-mini-orb-area\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule![1]).toMatch(/width:\s*100px/)
    expect(rule![1]).toMatch(/height:\s*100px/)
    expect(rule![1]).toMatch(/flex:\s*0 0 100px/)
  })

  it('el círculo llena el área sin container queries', () => {
    const rule = css.match(/\.pomodoro-mini-orb-area \.pomodoro-circle\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule![1]).toMatch(/width:\s*100%/)
    expect(rule![1]).toMatch(/height:\s*100%/)
    expect(rule![1]).toMatch(/max-width:\s*none/)
    expect(rule![1]).toMatch(/max-height:\s*none/)
  })

  it('el disco, el contador y los controles usan medidas fijas de la mascota', () => {
    const disc = css.match(/\.pomodoro-mini-orb-area \.pomodoro-disc\s*\{([^}]*)\}/)
    expect(disc).not.toBeNull()
    expect(disc![1]).toMatch(/width:\s*100px/)
    expect(disc![1]).toMatch(/height:\s*100px/)
    expect(disc![1]).toMatch(/gap:\s*2px/)

    const countdown = css.match(/\.pomodoro-mini-orb-area \.pomodoro-countdown\s*\{([^}]*)\}/)
    expect(countdown).not.toBeNull()
    expect(countdown![1]).toMatch(/font-size:\s*calc\(12px \* var\(--text-scale\)\)/)

    const controls = css.match(/\.pomodoro-mini-orb-area \.pomodoro-controls\s*\{([^}]*)\}/)
    expect(controls).not.toBeNull()
    expect(controls![1]).toMatch(/gap:\s*2px/)

    const button = css.match(/\.pomodoro-mini-orb-area \.pomodoro-btn\s*\{([^}]*)\}/)
    expect(button).not.toBeNull()
    expect(button![1]).toMatch(/width:\s*16px/)
    expect(button![1]).toMatch(/height:\s*16px/)
  })

  it('el disco no se compone en una capa que tape el anillo', () => {
    // El SVG del anillo es un descendiente posicionado del círculo. Si el disco
    // se promueve a capa con `translateZ(0)`, WebKitGTK lo pinta encima y el
    // borde desaparece: en la mini el anillo debe quedar visible.
    const disc = css.match(/\.pomodoro-mini-orb-area \.pomodoro-disc\s*\{([^}]*)\}/)
    expect(disc).not.toBeNull()
    expect(disc![1]).not.toMatch(/transform:/)
    expect(disc![1]).not.toMatch(/will-change:/)
  })

  it('la pastilla está siempre visible y en su propia capa', () => {
    const pill = css.match(/\.pomodoro-mini-pill\s*\{([^}]*)\}/)
    expect(pill).not.toBeNull()
    expect(pill![1]).toMatch(/transform:\s*translateZ\(0\)/)
    expect(pill![1]).toMatch(/opacity:\s*1/)
    expect(pill![1]).toMatch(/pointer-events:\s*auto/)
  })

  it('la mini no depende de container queries para escalar', () => {
    const miniBlock = css.slice(
      css.indexOf('.pomodoro-mini-orb {'),
      css.indexOf('/* Anillo SVG del pomodoro')
    )
    expect(miniBlock).not.toContain('cqw')
    expect(miniBlock).not.toContain('cqh')
    expect(miniBlock).not.toContain('cqmin')
  })
})
