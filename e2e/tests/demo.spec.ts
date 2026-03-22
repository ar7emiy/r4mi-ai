/**
 * Full demo flow — all 7 beats from DEMO_SCRIPT.md
 *
 * Sidebar-based architecture:
 *   - r4mi UI lives in the sidebar iframe (#r4mi-sidebar)
 *   - Toggle button (#r4mi-toggle) with badge (#r4mi-badge) in the host page
 *   - All r4mi interactions use page.frameLocator('#r4mi-sidebar')
 *   - No overlay components injected into the host page
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
 *   npx playwright test demo --grep "Beat 4"  # single beat
 */
import { test, expect } from '@playwright/test'

test('Complete demo flow — all 7 beats', async ({ page }) => {

  // ────────────────────────────────────────────────────────────────────
  // SETUP
  // ────────────────────────────────────────────────────────────────────
  await page.goto('/')
  await page.waitForLoadState('load')
  await expect(page.getByText('APPLICATION INBOX — PENDING REVIEW QUEUE')).toBeVisible()
  // Sidebar toggle button injected by r4mi-loader.js
  await expect(page.locator('#r4mi-toggle')).toBeVisible()

  // Sidebar reference (iframe — always in DOM, collapsed until opened)
  const sidebar = page.frameLocator('#r4mi-sidebar')

  // ────────────────────────────────────────────────────────────────────
  // BEAT 1 — The Work (0:00–0:40)
  // Operator processes a fence variance the manual way
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 1 — select PRM-2024-0041 (Margaret Hollis) from inbox', async () => {
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
    await page.locator('[data-testid="field-max-height"]').fill('6 ft')
    await page.locator('[data-testid="field-notes"]').fill(
      'Exceeds R-2 max by 1ft. Variance required per §14.3',
    )
    await page.getByRole('button', { name: 'SUBMIT APPLICATION' }).click()
    await expect(page.getByText(/submitted successfully/i)).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 2 — The Detection (0:40–0:55)
  // Gemini text-embedding-004 embeds the session, cosine similarity > 0.85
  // → OPTIMIZATION_OPPORTUNITY SSE → badge pulses on sidebar toggle
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 2 — optimization badge pulses on sidebar toggle after Gemini embedding', async () => {
    // Badge appears after embedding + SSE round-trip; allow 45s for Gemini
    await expect(page.locator('#r4mi-badge')).toBeVisible({ timeout: 45_000 })
    await expect(page.locator('#r4mi-badge')).not.toHaveText('0')
  })

  await test.step('Beat 2 — open sidebar, see OPTIMIZATION_OPPORTUNITY notification', async () => {
    await page.locator('#r4mi-toggle').click()
    await expect(sidebar.getByText(/Pattern detected/i)).toBeVisible({ timeout: 5_000 })
    await expect(sidebar.getByRole('button', { name: 'Build Agent from Pattern' })).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 3 — The Replay (0:55–1:25)
  // Click "Build Agent from Pattern" → ReplayPreview animates action steps
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 3 — click "Build Agent from Pattern", replay preview builds', async () => {
    await sidebar.getByRole('button', { name: 'Build Agent from Pattern' }).click()
    // Steps animate in (400ms stagger); spec build is a Gemini call — allow 30s
    await expect(sidebar.getByText(/zone_classification|zone/i).first()).toBeVisible({ timeout: 30_000 })
    await expect(sidebar.getByText(/max_permitted_height|max_height|height/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  await test.step('Beat 3 — "Looks good — continue" appears after last step, click to confirm', async () => {
    // Button appears 1.5s after last step animates in
    await expect(sidebar.getByRole('button', { name: 'Looks good — continue' })).toBeVisible({
      timeout: 10_000,
    })
    await sidebar.getByRole('button', { name: 'Looks good — continue' }).click()
    // Correction sub-card appears
    await expect(sidebar.getByPlaceholder('Describe the correction here...')).toBeVisible({
      timeout: 3_000,
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 4 — The Correction (1:25–2:00)
  // Type correction, use "Show me" to navigate host page to PDF, click source
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 4 — type correction noting PDF is authoritative', async () => {
    await sidebar.getByPlaceholder('Describe the correction here...').fill(
      'The policy source should be the PDF document, not the wiki. The wiki is sometimes outdated.',
    )
    await expect(sidebar.getByRole('button', { name: 'Show me' })).toBeVisible()
    // "Confirm & continue" is now enabled (3+ chars typed)
    await expect(sidebar.getByRole('button', { name: 'Confirm & continue' })).toBeEnabled()
  })

  await test.step('Beat 4 — "Show me" navigates host page to Policy Reference PDF tab', async () => {
    await sidebar.getByRole('button', { name: 'Show me' }).click()
    // Host page switches to policy tab with PDF viewer
    await expect(page.getByText('MUNICIPAL CODE — Chapter 14')).toBeVisible({ timeout: 5_000 })
    // PDF sections rendered with dashed border (demo mode active)
    await expect(page.locator('[data-testid="pdf-section-section-14-3"]')).toBeVisible()
  })

  await test.step('Beat 4 — click §14.3 paragraph; source confirmation relayed to sidebar', async () => {
    await page.locator('[data-testid="pdf-section-section-14-3"]').click()
    await expect(page.getByText('✓ Selected as knowledge source')).toBeVisible()
    // Loader relays r4mi:source-confirmed to sidebar — system message appears in chat
    await expect(sidebar.getByText(/Source confirmed/i)).toBeVisible({ timeout: 5_000 })
  })

  await test.step('Beat 4 — confirm correction → Gemini regenerates spec', async () => {
    await sidebar.getByRole('button', { name: 'Confirm & continue' }).click()
    // Gemini call — allow 45s
    await expect(sidebar.getByText(/Updated spec|spec ready/i)).toBeVisible({ timeout: 45_000 })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 5 — Publish (2:00–2:25)
  // Spec displayed in sidebar — click Publish Agent
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 5 — spec message shows action sequence and sources', async () => {
    await expect(sidebar.getByText('Steps')).toBeVisible()
    await expect(sidebar.getByText('Sources')).toBeVisible()
  })

  await test.step('Beat 5 — publish agent to Agentverse', async () => {
    await sidebar.getByRole('button', { name: 'Publish Agent' }).click()
    // Publish = 2 Gemini calls (spec embed + publish) — allow 30s
    await expect(sidebar.getByText(/Agent published:/i)).toBeVisible({ timeout: 30_000 })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 6 — The Payoff (2:25–2:50)
  // Next fence variance app opens → Run agent from Agentverse → fields auto-fill
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 6 — navigate back to inbox, open PRM-2024-0042', async () => {
    // Close sidebar first to interact with host page tabs
    await page.getByRole('button', { name: 'APPLICATION INBOX' }).click()
    await expect(page.getByText('APPLICATION INBOX — PENDING REVIEW QUEUE')).toBeVisible()
    await page.locator('[data-testid="app-row-PRM-2024-0042"]').click()
    await expect(page.getByText('APPLICATION FORM — PRM-2024-0042')).toBeVisible()
  })

  await test.step('Beat 6 — open sidebar Agentverse, run published fence-variance agent', async () => {
    // Open sidebar if closed
    const isSidebarOpen = await page.locator('#r4mi-container').evaluate(
      (el) => (el as HTMLElement).offsetWidth > 0,
    )
    if (!isSidebarOpen) {
      await page.locator('#r4mi-toggle').click()
    }
    // Open agents drawer
    await sidebar.getByRole('button', { name: 'Agents' }).click()
    await expect(sidebar.locator('[data-testid="agent-card"]').first()).toBeVisible({ timeout: 5_000 })
    // Click Run on the first (fence_variance) agent
    await sidebar.locator('[data-testid="agent-card"]').first().getByRole('button', { name: 'Run' }).click()
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
  // Agent card in drawer shows trust badge and run count
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 7 — agent card shows SUPERVISED trust badge and fence_variance permit type', async () => {
    // Re-open agents drawer (may have been closed after Run)
    const drawerVisible = await sidebar.locator('[data-testid="agent-card"]').first().isVisible().catch(() => false)
    if (!drawerVisible) {
      await sidebar.getByRole('button', { name: 'Agents' }).click()
    }
    const card = sidebar.locator('[data-testid="agent-card"]').first()
    await expect(card).toBeVisible({ timeout: 5_000 })
    await expect(card.getByText('supervised')).toBeVisible()
    await expect(card.getByText('fence_variance')).toBeVisible()
  })
})
