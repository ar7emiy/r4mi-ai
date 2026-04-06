/**
 * Full demo flow — all 7 beats from DEMO_SCRIPT.md
 *
 * Sidebar-based architecture (phase-based UI):
 *   - r4mi UI lives in the sidebar iframe (#r4mi-sidebar)
 *   - Toggle button (#r4mi-toggle) with badge (#r4mi-badge) in the host page
 *   - Sidebar phases: idle → detected → replay (HITL) → published → agents
 *   - All r4mi interactions use page.frameLocator('#r4mi-sidebar')
 *
 * Prerequisites:
 *   backend:  cd backend && uvicorn main:app --reload --port 8000
 *             DEMO_SESSION_SEED=true must be set (2 prior sessions pre-loaded)
 *   frontend: cd frontend && npm run dev
 *
 * Run:
 *   cd e2e
 *   npx playwright test demo                  # headless
 *   npx playwright test demo --headed         # watch it run
 */
import { test, expect } from '@playwright/test'

test('Complete demo flow — all 7 beats', async ({ page }) => {

  // ────────────────────────────────────────────────────────────────────
  // SETUP
  // ────────────────────────────────────────────────────────────────────
  await page.goto('/')
  await page.waitForLoadState('load')
  await expect(page.getByText('APPLICATION INBOX — PENDING REVIEW QUEUE')).toBeVisible()
  await expect(page.locator('#r4mi-toggle')).toBeVisible()

  const sidebar = page.frameLocator('#r4mi-sidebar')

  // ────────────────────────────────────────────────────────────────────
  // BEAT 1 — The Work (0:00–0:40)
  // Operator processes a fence variance the manual way
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 1 — select PRM-2024-0041 from inbox', async () => {
    await page.locator('[data-testid="app-row-PRM-2024-0041"]').click()
    await expect(page.getByText('APPLICATION FORM — PRM-2024-0041')).toBeVisible()
    await expect(page.getByText('APPLICANT INFORMATION')).toBeVisible()
  })

  await test.step('Beat 1 — GIS lookup: parcel R2-0041-BW, zone R-2', async () => {
    await page.getByRole('button', { name: 'GIS PARCEL LOOKUP' }).click()
    await page.getByPlaceholder('e.g. R2-0041-BW').fill('R2-0041-BW')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByText('R-2')).toBeVisible()
    await expect(page.getByText('Single Family Residential')).toBeVisible()
  })

  await test.step('Beat 1 — return to form, type zone R-2 manually', async () => {
    await page.getByRole('button', { name: 'APPLICATION FORM' }).click()
    await page.locator('[data-testid="field-zone"]').fill('R-2')
    await expect(page.locator('[data-testid="field-zone"]')).toHaveValue('R-2')
  })

  await test.step('Beat 1 — Policy Reference: read §14.3 fence height rule', async () => {
    await page.getByRole('button', { name: 'POLICY REFERENCE' }).click()
    await expect(page.getByText('Section 14.3 — Residential Fencing Standards')).toBeVisible()
    await expect(page.getByText('shall not exceed six feet')).toBeVisible()
  })

  await test.step('Beat 1 — fill max height and notes, submit application', async () => {
    await page.getByRole('button', { name: 'APPLICATION FORM' }).click()
    // Zone value should persist after tab switch (tabs stay mounted)
    await expect(page.locator('[data-testid="field-zone"]')).toHaveValue('R-2')
    await page.locator('[data-testid="field-max-height"]').fill('6 ft')
    await page.locator('[data-testid="field-notes"]').fill(
      'Exceeds R-2 max by 1ft. Variance required per §14.3',
    )
    await page.getByRole('button', { name: 'SUBMIT APPLICATION' }).click()
    await expect(page.getByText(/submitted successfully/i)).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 2 — The Detection (0:40–0:55)
  // Gemini embedding → cosine similarity → OPTIMIZATION_OPPORTUNITY SSE
  // Sidebar transitions from idle → detected phase
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 2 — badge pulses on sidebar toggle after Gemini embedding', async () => {
    await expect(page.locator('#r4mi-badge')).toBeVisible({ timeout: 45_000 })
    await expect(page.locator('#r4mi-badge')).not.toHaveText('0')
  })

  await test.step('Beat 2 — open sidebar, see pattern detected phase', async () => {
    await page.locator('#r4mi-toggle').click()
    // Sidebar should be in "detected" phase with pattern info
    await expect(sidebar.getByText(/pattern detected/i)).toBeVisible({ timeout: 5_000 })
    await expect(sidebar.getByText(/review replay/i)).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 3 — The Replay (0:55–1:25)
  // Click "review replay" → builds spec → HITL replay with step list
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 3 — click "review replay", spec builds, steps appear', async () => {
    await sidebar.getByText(/review replay/i).click()
    // Spec build is a Gemini call — allow 30s for steps to appear
    await expect(sidebar.getByText(/zone_classification|zone/i).first()).toBeVisible({ timeout: 30_000 })
    await expect(sidebar.getByText(/max_permitted_height|max_height|height/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 4 — HITL Step Approval (1:25–2:00)
  // Approve each step in the replay. Each step fills a field on the host.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 4 — approve replay steps one by one (host page navigates)', async () => {
    // Each step navigates the host page (tab switch + field fill) then waits for approval.
    // Steps vary by spec but typically 3-5 steps. Approve them all.
    const maxSteps = 8
    for (let i = 0; i < maxSteps; i++) {
      // Wait for approve button — each step takes ~1.4s (nav + fill animation)
      const approveBtn = sidebar.getByTestId('replay-approve')
      const appeared = await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false)
      if (!appeared) break
      await approveBtn.click()
      // Wait for next step to start navigating
      await page.waitForTimeout(500)
    }
    // After all steps approved, "review complete" should appear
    await expect(sidebar.getByText(/review complete|all.*steps reviewed/i)).toBeVisible({ timeout: 10_000 })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 5 — Publish (2:00–2:25)
  // All steps approved → publish agent
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 5 — publish agent to Agentverse', async () => {
    // Sources should be visible
    await expect(sidebar.getByText(/sources/i)).toBeVisible()

    await sidebar.getByText(/publish agent/i).click()
    // Publish = 2 Gemini calls (spec embed + publish) — allow 30s
    await expect(sidebar.getByText(/published/i)).toBeVisible({ timeout: 30_000 })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 6 — The Payoff (2:25–2:50)
  // Open next app → run agent from Agentverse → fields auto-fill
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 6 — navigate back to inbox, open PRM-2024-0042', async () => {
    await page.getByRole('button', { name: 'APPLICATION INBOX' }).click()
    await expect(page.getByText('APPLICATION INBOX — PENDING REVIEW QUEUE')).toBeVisible()
    await page.locator('[data-testid="app-row-PRM-2024-0042"]').click()
    await expect(page.getByText('APPLICATION FORM — PRM-2024-0042')).toBeVisible()
  })

  await test.step('Beat 6 — open Agentverse, run published fence-variance agent', async () => {
    // Open sidebar if closed
    const isSidebarOpen = await page.locator('#r4mi-container').evaluate(
      (el) => (el as HTMLElement).offsetWidth > 0,
    )
    if (!isSidebarOpen) {
      await page.locator('#r4mi-toggle').click()
    }
    // Open agents view
    await sidebar.getByText('agents', { exact: true }).first().click()
    await expect(sidebar.locator('[data-testid="agent-card"]').first()).toBeVisible({ timeout: 5_000 })
    // Click Run on the first agent
    await sidebar.locator('[data-testid="agent-card"]').first().getByText('run').click()
  })

  await test.step('Beat 6 — agent fills Zone and Max Height fields with source tags', async () => {
    // Zone fills first (typing animation)
    await expect(page.locator('[data-testid="field-zone"]')).toHaveValue('R-2', { timeout: 15_000 })
    // Max Height fills after zone
    await expect(page.locator('[data-testid="field-max-height"]')).not.toHaveValue('', {
      timeout: 15_000,
    })
    // Source tags appear next to the filled fields
    await expect(page.getByText('from GIS API')).toBeVisible()
    await expect(page.getByText(/PDF §14\.3/i)).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 7 — The Agentverse (2:50–3:00)
  // Agent card shows trust badge and permit type
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 7 — agent card shows supervised trust badge and fence_variance type', async () => {
    // Re-open agents view if needed
    const cardVisible = await sidebar.locator('[data-testid="agent-card"]').first().isVisible().catch(() => false)
    if (!cardVisible) {
      await sidebar.getByText('agents', { exact: true }).first().click()
    }
    const card = sidebar.locator('[data-testid="agent-card"]').first()
    await expect(card).toBeVisible({ timeout: 5_000 })
    await expect(card.getByText('supervised')).toBeVisible()
    await expect(card.getByText('fence_variance')).toBeVisible()
  })
})
