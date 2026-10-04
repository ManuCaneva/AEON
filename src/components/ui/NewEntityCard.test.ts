import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NewEntityCard from './NewEntityCard.vue'

describe('NewEntityCard', () => {
  const defaultProps = {
    label: 'Nuevo test',
  }

  it('renders the label text', () => {
    const wrapper = mount(NewEntityCard, {
      props: defaultProps,
      attrs: { 'aria-label': 'Crear nuevo test', 'data-testid': 'new-test-card' },
    })
    expect(wrapper.text()).toContain('Nuevo test')
  })

  it('has correct data-testid via attrs fallthrough', () => {
    const wrapper = mount(NewEntityCard, {
      props: defaultProps,
      attrs: { 'data-testid': 'new-test-card' },
    })
    expect(wrapper.find("[data-testid='new-test-card']").exists()).toBe(true)
  })

  it('has correct aria-label via attrs fallthrough', () => {
    const wrapper = mount(NewEntityCard, {
      props: defaultProps,
      attrs: { 'aria-label': 'Crear nuevo test' },
    })
    expect(wrapper.find("[aria-label='Crear nuevo test']").exists()).toBe(true)
  })

  it("has role='button' and tabindex='0'", () => {
    const wrapper = mount(NewEntityCard, { props: defaultProps })
    const el = wrapper.find("[role='button']")
    expect(el.exists()).toBe(true)
    expect(el.attributes('tabindex')).toBe('0')
  })

  it("emits 'create' on click", async () => {
    const wrapper = mount(NewEntityCard, { props: defaultProps })
    await wrapper.find("[role='button']").trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it("emits 'create' on Enter keydown", async () => {
    const wrapper = mount(NewEntityCard, { props: defaultProps })
    await wrapper.find("[role='button']").trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it("emits 'create' on Space keydown", async () => {
    const wrapper = mount(NewEntityCard, { props: defaultProps })
    await wrapper.find("[role='button']").trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('applies cssClass prop', () => {
    const wrapper = mount(NewEntityCard, {
      props: { label: 'Test', cssClass: 'extra-class' },
    })
    expect(wrapper.find("[role='button']").classes()).toContain('extra-class')
  })

  it('does not draw a dashed top border', () => {
    const wrapper = mount(NewEntityCard, { props: defaultProps })
    const el = wrapper.find("[role='button']")
    expect(el.classes()).not.toContain('border-t')
    expect(el.classes()).not.toContain('border-dashed')
  })

  it('keeps min height and centered layout', () => {
    const wrapper = mount(NewEntityCard, { props: defaultProps })
    const el = wrapper.find("[role='button']")
    expect(el.classes()).toContain('min-h-[44px]')
    expect(el.classes()).toContain('flex')
    expect(el.classes()).toContain('items-center')
  })

  it('keeps hover and focus-visible styles', () => {
    const wrapper = mount(NewEntityCard, { props: defaultProps })
    const el = wrapper.find("[role='button']")
    expect(el.classes()).toContain('hover:bg-surface-2')
    expect(el.classes()).toContain('hover:text-ink')
    expect(el.classes()).toContain('focus-visible:ring-2')
    expect(el.classes()).toContain('focus-visible:ring-primary/40')
  })

  it('renders Plus icon', () => {
    const wrapper = mount(NewEntityCard, { props: defaultProps })
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
