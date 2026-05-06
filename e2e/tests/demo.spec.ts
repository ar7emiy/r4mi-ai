/**
 * Full demo flow — site-agnostic r4mi against the mock permit app.
 *
 * Architecture (post site-agnostic rewrite):
 *   - r4mi backend has zero domain knowledge. The mock permit app
 *     (mock-sites/permit-app/) serves its own /api/stubs/* via its Vite
 *     middleware. capture.js intercepts those fetches and stores them on
 *     the session record — that's the data NarrowAgent replays.
 *   - Workflow types are discovered by services/cluster_service.py via
 *     embedding cosine similarity. There is no permit_type taxonomy.
 *   - DOM targets are resolved at run time via element_resolver.js using
 *     accessibility roles + names + landmarks. No testid hardcoding.
 *
 * Prerequisites:
 *   backend:    cd backend && uvicorn main:app --reload --port 8000
 *               MIN_CLUSTER_SIZE=1 must be set so a single fresh session
 *               triggers OPTIMIZATION_OPPORTUNITY (replaces the old
 *               DEMO_SESSION_SEED scaffolding).
 *   frontend:   cd frontend && npm run dev
 *   permit-app: cd mock-sites/permit-app && npm run dev
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
  // Operator processes an application by hand. capture.js silently
  // records every UI event AND wraps fetch/XHR so the host's API calls
  // become spec-grade ground truth.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 1 — select PRM-2024-0041 from inbox', async () => {
    await page.locator('[data-testid="app-row-PRM-2024-0041"]').click()
    await expect(page.getByText('APPLICATION FORM — PRM-2024-0041')).toBeVisible()
    await expect(page.getByText('APPLICANT INFORMATION')).toBeVisible()
  })

  await test.step('Beat 1 — GIS lookup: parcel R2-0041-BW (host fetch captured)', async () => {
    await page.getByRole('button', { name: 'GIS PARCEL LOOKUP' }).click()
    await page.getByPlaceholder('e.g. R2-0041-BW').fill('R2-0041-BW')
    await page.getByRole('button', { name: 'Search' }).click()
    // exact: true avoids matching policy-tab paragraphs that contain "R-2" as a substring
    await expect(page.getByText('R-2', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Single Family Residential').first()).toBeVisible()
  })

  await test.step('Beat 1 — return to form, type zone manually', async () => {
    await page.getByRole('button', { name: 'APPLICATION FORM' }).click()
    await page.locator('[data-testid="field-zone"]').fill('R-2')
    await expect(page.locator('[data-testid="field-zone"]')).toHaveValue('R-2')
  })

  await test.step('Beat 1 — Policy Reference: read fence height rule (host fetch captured)', async () => {
    await page.getByRole('button', { name: 'POLICY REFERENCE' }).click()
    await expect(page.getByText('Section 14.3 — Residential Fencing Standards')).toBeVisible()
    await expect(page.getByText('shall not exceed six feet')).toBeVisible()
  })

  await test.step('Beat 1 — fill remaining fields, submit application', async () => {
    await page.getByRole('button', { name: 'APPLICATION FORM' }).click()
    // Zone value persists after tab switch (tabs stay mounted)
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
  // Embedding → cluster discovery (replaces permit_type filter) → SSE
  // OPTIMIZATION_OPPORTUNITY. With MIN_CLUSTER_SIZE=1 the first session
  // crosses the threshold immediately.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 2 — badge pulses after embedding + cluster discovery', async () => {
    await expect(page.locator('#r4mi-badge')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('#r4mi-badge')).not.toHaveText('0')
  })

  await test.step('Beat 2 — open sidebar, see pattern detected phase', async () => {
    await page.locator('#r4mi-toggle').click()
    await expect(sidebar.getByText(/pattern detected/i)).toBeVisible({ timeout: 5_000 })
    await expect(sidebar.getByText(/review replay/i)).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 3 — The Replay (0:55–1:25)
  // Click "review replay" → SpecBuilder generates a 5-action spec
  // (READ/FETCH/REASON/WRITE/ASSERT) from the captured trace +
  // network_calls. Site-agnostic — assertions don't reference field names.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 3 — review replay opens HITL phase with at least one step', async () => {
    await sidebar.getByText(/review replay/i).click()
    // Spec build is a Gemini call — allow 45s for steps to populate.
    // We assert that *some* step row appears (step number "1." anchored).
    await expect(sidebar.getByText(/^1\./).first()).toBeVisible({ timeout: 45_000 })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 4 — HITL Step Approval (1:25–2:00)
  // HITLReplay starts in a "ready" state (currentStep === -1). Click
  // "begin replay" first, then approve each step as it appears.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 4 — click begin replay, then approve steps one by one', async () => {
    // HITLReplay renders "▶ begin replay" before the first approve button appears
    await sidebar.getByText(/begin replay/i).click()

    const maxSteps = 8
    for (let i = 0; i < maxSteps; i++) {
      const approveBtn = sidebar.getByTestId('replay-approve')
      const appeared = await approveBtn.isVisible({ timeout: 8_000 }).catch(() => false)
      if (!appeared) break
      await approveBtn.click()
      await page.waitForTimeout(500)
    }
    await expect(sidebar.getByText(/review complete|all.*steps reviewed/i)).toBeVisible({ timeout: 10_000 })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 5 — Publish (2:00–2:25)
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 5 — publish agent to Agentverse', async () => {
    await expect(sidebar.getByText(/sources/i)).toBeVisible()
    await sidebar.getByText(/publish agent/i).click()
    // Publish = 2 Gemini calls (spec embed + publish) — allow 30s
    await expect(sidebar.getByText(/published/i)).toBeVisible({ timeout: 30_000 })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 6 — The Payoff (2:25–2:50)
  // Open a fresh application; run the agent. NarrowAgent dry-runs each
  // step against the source session's captured network_calls and posts
  // the resolved steps to the host via element_resolver.js. Form fills
  // come from the agent's writes; we assert the form is *not empty*
  // rather than expecting specific values (those depend on the spec
  // SpecBuilder produced).
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 6 — navigate back to inbox, open PRM-2024-0042', async () => {
    await page.getByRole('button', { name: 'APPLICATION INBOX' }).click()
    await expect(page.getByText('APPLICATION INBOX — PENDING REVIEW QUEUE')).toBeVisible()
    await page.locator('[data-testid="app-row-PRM-2024-0042"]').click()
    await expect(page.getByText('APPLICATION FORM — PRM-2024-0042')).toBeVisible()
  })

  await test.step('Beat 6 — open Agentverse, run the published agent', async () => {
    const isSidebarOpen = await page.locator('#r4mi-container').evaluate(
      (el) => (el as HTMLElement).offsetWidth > 0,
    )
    if (!isSidebarOpen) {
      await page.locator('#r4mi-toggle').click()
    }
    await sidebar.getByText('agents', { exact: true }).first().click()
    await expect(sidebar.locator('[data-testid="agent-card"]').first()).toBeVisible({ timeout: 5_000 })
    await sidebar.locator('[data-testid="agent-card"]').first().getByText('run').click()
  })

  await test.step('Beat 6 — agent writes at least one form field', async () => {
    // The agent's WRITE steps target the form fields by fingerprint. We
    // assert at least one of the form's known fields received content
    // — rather than asserting specific values (which depend on whatever
    // spec SpecBuilder generated for this run).
    await page.waitForFunction(
      () => {
        const fields = ['field-zone', 'field-max-height', 'field-notes']
        return fields.some((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement | null
          return el && el.value && el.value.length > 0
        })
      },
      { timeout: 30_000 },
    )
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 7 — The Agentverse (2:50–3:00)
  // Agent card carries trust badge + cluster_label (Gemini-generated, so
  // the assertion checks for *a* label, not a specific string).
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 7 — agent card shows supervised trust badge + cluster label', async () => {
    const cardVisible = await sidebar.locator('[data-testid="agent-card"]').first().isVisible().catch(() => false)
    if (!cardVisible) {
      await sidebar.getByText('agents', { exact: true }).first().click()
    }
    const card = sidebar.locator('[data-testid="agent-card"]').first()
    await expect(card).toBeVisible({ timeout: 5_000 })
    await expect(card.getByText('supervised')).toBeVisible()
    // Cluster label is auto-generated by Gemini; assert that *some*
    // non-empty label-or-runs string sits next to "runs".
    await expect(card.getByText(/\d+\s*runs/)).toBeVisible()
  })
})
