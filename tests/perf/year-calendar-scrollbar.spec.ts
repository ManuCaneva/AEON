import { test, expect } from '@playwright/test'
import { injectStub, waitForDashboard } from './harness'

// Regresión: la scrollbar del calendario anual debe ser fina (<=6px de
// gutter) y NO ensancharse en hover. Mezclar scrollbar-width: thin con
// ::-webkit-scrollbar activaba la barra nativa (~10px) con su propio hover.
const SEL = '[data-testid="year-grid-viewport"]'

test('year calendar scrollbar stays slim on hover', async ({ page }) => {
  await injectStub(page, { perfFocus: 'year-calendar' })
  await page.addInitScript(() => {
    localStorage.setItem('aeon:yearcal-mode', 'meses')
  })
  await page.setViewportSize({ width: 400, height: 650 })
  await page.goto('/?perf=1', { waitUntil: 'load' })
  await waitForDashboard(page)
  await page.waitForTimeout(600)

  expect(await page.locator(SEL).count()).toBeGreaterThan(0)
  expect(await page.locator("[data-testid='month-mini']").count()).toBe(12)

  // Forzar overflow para que la scrollbar exista. Las celdas encogen hasta
  // entrar en el ancho (nunca desbordan en horizontal), así que el tope debe
  // ser menor que el contenido encogido (~123px en este viewport).
  await page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement
    el?.scrollTo({ top: 0 })
    if (el) el.style.maxHeight = '100px'
  }, SEL)
  await page.waitForTimeout(300)

  const gutter = () =>
    page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement
      return {
        diff: el.offsetWidth - el.clientWidth,
        scrollable: el.scrollHeight > el.clientHeight,
      }
    }, SEL)

  const idle = await gutter()
  expect(idle.scrollable).toBe(true)
  expect(idle.diff).toBeLessThanOrEqual(6)

  const box = await page.locator(SEL).boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width - 2, box!.y + box!.height / 2)
  await page.waitForTimeout(500)

  const hovered = await gutter()
  expect(hovered.diff).toBeLessThanOrEqual(6)
})
