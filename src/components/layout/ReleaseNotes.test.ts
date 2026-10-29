import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ReleaseNotes from './ReleaseNotes.vue'
import type { ReleaseNotes as Notes } from '@/lib/update/notes'

describe('ReleaseNotes', () => {
  const notes: Notes = {
    summary: 'Esta versión trae novedades de calendario.',
    items: [
      { category: 'mejorado', text: 'El dashboard responde más rápido' },
      { category: 'nuevo', text: 'Cronograma semanal' },
      { category: 'arreglado', text: 'Se arregló el arranque en Wayland' },
      { category: 'nuevo', text: 'Temporizador pomodoro' },
    ],
  }

  it('muestra el resumen cuando existe', () => {
    const wrapper = mount(ReleaseNotes, { props: { notes } })

    expect(wrapper.text()).toContain('Esta versión trae novedades de calendario.')
  })

  it('agrupa los bullets bajo su categoría en orden nuevo → arreglado → mejorado', () => {
    const wrapper = mount(ReleaseNotes, { props: { notes } })

    const groups = wrapper.findAll('[data-note-group]')
    expect(groups.map((g) => g.attributes('data-note-group'))).toEqual([
      'nuevo',
      'arreglado',
      'mejorado',
    ])
    expect(groups[0].text()).toContain('Cronograma semanal')
    expect(groups[0].text()).toContain('Temporizador pomodoro')
    expect(groups[1].text()).toContain('Se arregló el arranque en Wayland')
    expect(groups[2].text()).toContain('El dashboard responde más rápido')
  })

  it('solo muestra las categorías con items', () => {
    const wrapper = mount(ReleaseNotes, {
      props: {
        notes: { summary: null, items: [{ category: 'arreglado', text: 'Algo' }] },
      },
    })

    expect(wrapper.findAll('[data-note-group]')).toHaveLength(1)
    expect(wrapper.find('[data-note-group="arreglado"]').exists()).toBe(true)
  })

  it('no muestra el resumen si es null', () => {
    const wrapper = mount(ReleaseNotes, {
      props: { notes: { summary: null, items: [{ category: 'nuevo', text: 'Algo' }] } },
    })

    expect(wrapper.text()).not.toContain('—')
  })
})
