import { test, expect } from '@playwright/test'

/**
 * End-to-end test: process a permit app → sidebar gets notification →
 * click "Build Agent" → spec appears → click "Publish" → agent in agentverse.
 *
 * This test requires DEMO_SESSION_SEED=true (2 prior fence_variance sessions).
 * The third live session triggers OPTIMIZATION_OPPORTUNITY.
 */
test.describe('Sidebar full flow', () => {
  test('notification → build → publish', async ({ page }) => {
    test.setTimeout(180_000)

    await page.goto('/')
    // Open sidebar
    await page.locator('#r4mi-toggle').click()
    await page.waitForTimeout(500)

    const sidebar = page.frameLocator('#r4mi-sidebar')
    await expect(sidebar.getByText('r4mi-ai', { exact: true })).toBeVisible({ timeout: 5000 })

    // ── Process a fence variance application ───────────────────────
    // Click PRM-2024-0041 in inbox
    await page.locator('[data-testid="app-row-PRM-2024-0041"]').click()
    await page.waitForTimeout(500)

    // Navigate through tabs to generate observe events
    await page.getByText('GIS PARCEL LOOKUP').click()
    await page.waitForTimeout(500)
    await page.getByText('POLICY REFERENCE').click()
    await page.waitForTimeout(500)
    await page.getByText('APPLICATION FORM').click()
    await page.waitForTimeout(500)

    // Fill in zone field and submit
    const zoneInput = page.locator('[name="zone_classification"], #zone_classification, [data-field="zone_classification"]').first()
    if (await zoneInput.isVisible()) {
      await zoneInput.fill('R-2')
    }

    // Click submit
    const submitBtn = page.locator('[data-testid="submit-application"], button:has-text("SUBMIT")')
    if (await submitBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.first().click()
    }

    // ── Wait for OPTIMIZATION_OPPORTUNITY in sidebar ──────────────
    const patternMsg = sidebar.locator('text=Pattern detected')
    await expect(patternMsg).toBeVisible({ timeout: 60_000 })

    // ── Click "Build Agent from Pattern" ──────────────────────────
    const buildBtn = sidebar.getByRole('button', { name: /Build Agent/i })
    await expect(buildBtn).toBeVisible({ timeout: 5000 })
    await buildBtn.click()

    // Wait for spec to appear
    const specMsg = sidebar.locator('text=Agent spec generated')
    await expect(specMsg).toBeVisible({ timeout: 60_000 })

    // ── Click "Publish Agent" ────────────────────────────────────
    const publishBtn = sidebar.getByRole('button', { name: /Publish Agent/i })
    await expect(publishBtn).toBeVisible({ timeout: 5000 })
    await publishBtn.click()

    // Wait for publish confirmation
    await expect(sidebar.getByText('Agent published:').first()).toBeVisible({ timeout: 30_000 })

    // ── Verify agent appears in agentverse ───────────────────────
    await sidebar.getByRole('button', { name: /Agents/i }).click()
    await expect(sidebar.locator('text=Agentverse')).toBeVisible()
    // There should be at least one agent card
    await expect(sidebar.getByText('SUPERVISED').first()).toBeVisible({ timeout: 5000 })
  })
})
