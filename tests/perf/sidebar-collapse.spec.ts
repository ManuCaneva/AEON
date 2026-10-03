import { test, expect } from '@playwright/test'
import { injectStub, waitForDashboard } from './harness'
import { SIDEBAR_COLLAPSE_BUDGET } from './perf-constants.mjs'

// Colapso + expansión de la sidebar sobre el dashboard completo. Protege la
// regresión del freeze: el heat grid refloweaba sus ~364 celdas × N hábitos en
// cada cuadro de la animación de ancho. Con DOM constante + ancho intrínseco el
// toggle no debe producir long tasks.
async function runSidebarToggle(page: import('@playwright/test').Page) {
  await page.goto('/?perf=1', { waitUntil: 'load' })
  await waitForDashboard(page)
  await page.waitForTimeout(500)

  return page.evaluate(async () => {
    const toggle = document.querySelector('[data-testid="sidebar-toggle"]')
    if (!toggle) throw new Error('sidebar-toggle no encontrado')
    window.__perfT0 = performance.now()
    window.__perfMetrics.start()

    toggle.click()
    await new Promise((r) => setTimeout(r, 400))
    toggle.click()
    await new Promise((r) => setTimeout(r, 400))

    window.__perfLastChange = performance.now()
    const settledAt = await window.__perfMetrics.settle()
    const stats = window.__perfMetrics.stats(window.__perfT0, window.__perfLastChange)
    return {
      longTasks: stats.longTasks,
      maxFrameGap: stats.maxFrameGap,
      settleMs: Math.round(settledAt - window.__perfLastChange),
      frameCount: stats.frameCount,
    }
  })
}

test('sidebar collapse/expand stays within budget', async ({ page }) => {
  await injectStub(page, {})
  const metrics = await runSidebarToggle(page)

  console.log(
    `\n[perf] sidebar collapse -> longTasks=${metrics.longTasks.length} maxGap=${metrics.maxFrameGap.toFixed(1)}ms settle=${metrics.settleMs}ms`
  )

  expect(
    metrics.longTasks.length,
    'no long tasks > 50ms al colapsar/expandir la sidebar'
  ).toBeLessThanOrEqual(SIDEBAR_COLLAPSE_BUDGET.maxLongTasks)
  expect(metrics.maxFrameGap, 'max frame gap dentro de presupuesto').toBeLessThan(
    SIDEBAR_COLLAPSE_BUDGET.maxFrameGapMs
  )
})
