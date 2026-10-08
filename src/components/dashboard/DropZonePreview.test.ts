import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DropZonePreview from './DropZonePreview.vue'
import { hasRawPaletteColor } from '@/test/colorGuard'

function mountZone(
  overrides: Partial<{ x: number; y: number; w: number; h: number; occupied: boolean }> = {}
) {
  return mount(DropZonePreview, {
    props: { x: 0, y: 0, w: 1, h: 1, occupied: false, ...overrides },
  })
}

describe('DropZonePreview', () => {
  it('se posiciona en las celdas enteras derivadas de x/y/w/h', () => {
    const wrapper = mountZone({ x: 3, y: 2, w: 6, h: 4 })
    const el = wrapper.element as HTMLElement
    const style = el.getAttribute('style') ?? ''
    expect(style).toContain('grid-column: 4 / span 6')
    expect(style).toContain('grid-row: 3 / span 4')
  })

  it('no intercepta punteros para no robar el gesto en curso', () => {
    const wrapper = mountZone()
    expect(wrapper.classes()).toContain('pointer-events-none')
    expect((wrapper.element as HTMLElement).style.pointerEvents).toBe('')
  })

  it('en zona libre se marca con el acento primario (tint + borde)', () => {
    const wrapper = mountZone({ occupied: false })
    expect(wrapper.attributes('data-occupied')).toBe('false')
    expect(wrapper.classes()).toContain('border-primary/50')
    expect(wrapper.classes()).toContain('bg-primary/10')
    expect(wrapper.classes()).not.toContain('border-accent-red/60')
  })

  it('en zona ocupada se marca en tono de advertencia', () => {
    const wrapper = mountZone({ occupied: true })
    expect(wrapper.attributes('data-occupied')).toBe('true')
    expect(wrapper.classes()).toContain('border-accent-red/60')
    expect(wrapper.classes()).toContain('bg-accent-red-tint')
    expect(wrapper.classes()).not.toContain('bg-primary/10')
  })

  it('es decorativa: no se anuncia a lectores de pantalla', () => {
    const wrapper = mountZone()
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('no usa colores de paleta cruda de Tailwind', () => {
    expect(hasRawPaletteColor(mountZone({ occupied: false }).html())).toBe(false)
    expect(hasRawPaletteColor(mountZone({ occupied: true }).html())).toBe(false)
  })
})
