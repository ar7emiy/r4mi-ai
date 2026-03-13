/**
 * Full demo flow — all 7 beats from DEMO_SCRIPT.md
 *
 * Runs as a single test with test.step() so all beats share browser state
 * (SSE connection, published agents, etc.) exactly like a live demo.
 *
 * Prerequisites:
 *   backend:  cd backend && uvicorn main:app --reload --port 8000
 *             DEMO_SESSION_SEED=true must be set (2 prior sessions pre-loaded)
 *   frontend: cd frontend && npm run dev
 *
 * Run:
 *   cd e2e
 *   npx playwright test demo                       # headless
 *   npx playwright test demo --headed --slow-mo 400 # watch it run
 *   npx playwright test demo --grep "Beat 4"       # single beat (note: skips prior beats)
 */
import { test, expect } from '@playwright/test'

test('Complete demo flow — all 7 beats', async ({ page }) => {

  // ────────────────────────────────────────────────────────────────────
  // SETUP
  // ────────────────────────────────────────────────────────────────────
  await page.goto('/')
  await page.waitForLoadState('load')
  // Confirm clean state — inbox visible and Tab Bar rendered
  // Note: "No active agents" only shows on a fresh DB; skip if agents exist from prior runs
  await expect(page.getByText('APPLICATION INBOX — PENDING REVIEW QUEUE')).toBeVisible()
  await expect(page.getByRole('button', { name: /Agentverse/i })).toBeVisible()

  // ────────────────────────────────────────────────────────────────────
  // BEAT 1 — The Work (0:00–0:40)
  // Operator processes a fence variance the manual way: 5 screens
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 1 — select PRM-2024-0041 (Margaret Hollis) from inbox', async () => {
    await page.locator('[data-testid="app-row-PRM-2024-0041"]').click()
    // Form title confirms correct application; applicant data is in readonly textareas
    await expect(page.getByText('APPLICATION FORM — PRM-2024-0041')).toBeVisible()
    await expect(page.getByText('APPLICANT INFORMATION')).toBeVisible()
  })

  await test.step('Beat 1 — navigate to GIS, look up parcel R2-0041-BW, read zone R-2', async () => {
    await page.getByRole('button', { name: 'GIS PARCEL LOOKUP' }).click()
    const parcelInput = page.getByPlaceholder('e.g. R2-0041-BW')
    await parcelInput.fill('R2-0041-BW')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByText('R-2')).toBeVisible()
    await expect(page.getByText('Single Family Residential')).toBeVisible()
  })

  await test.step('Beat 1 — return to form, manually type zone R-2', async () => {
    await page.getByRole('button', { name: 'APPLICATION FORM' }).click()
    await expect(page.getByText('APPLICATION FORM — PRM-2024-0041')).toBeVisible()
    await page.locator('[data-testid="field-zone"]').fill('R-2')
    await expect(page.locator('[data-testid="field-zone"]')).toHaveValue('R-2')
  })

  await test.step('Beat 1 — navigate to Policy Reference, read §14.3 fence height rule', async () => {
    await page.getByRole('button', { name: 'POLICY REFERENCE' }).click()
    await expect(page.getByText('Section 14.3 — Residential Fencing Standards')).toBeVisible()
    await expect(page.getByText("shall not exceed six feet")).toBeVisible()
  })

  await test.step('Beat 1 — return to form, enter max height and notes, submit', async () => {
    await page.getByRole('button', { name: 'APPLICATION FORM' }).click()
    await page.locator('[data-testid="field-max-height"]').fill('6 ft')
    await page.locator('[data-testid="field-notes"]').fill(
      'Exceeds R-2 max by 1ft. Variance required per §14.3'
    )
    await page.getByRole('button', { name: 'SUBMIT APPLICATION' }).click()
    await expect(page.getByText(/submitted successfully/i)).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 2 — The Detection (0:40–0:55)
  // Backend embeds the session trace via Gemini text-embedding-004,
  // compares cosine similarity against 2 seeded sessions, fires READY.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 2 — optimization badge appears after Gemini embedding + similarity check', async () => {
    // Gemini embedding call + SSE round-trip — allow 45s (embedding can be slow under load)
    await expect(page.locator('[data-testid="optimization-badge"]')).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByText('Optimization detected')).toBeVisible()
  })

  await test.step('Beat 2 — click badge opens Optimization Panel', async () => {
    await page.locator('[data-testid="optimization-badge"]').click()
    await expect(page.getByText('r4mi-ai detected a repetitive workflow')).toBeVisible()
    await expect(page.getByText("I've seen this pattern 3 times")).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 3 — The Replay (0:55–1:25)
  // Distilled workflow shown with source tags. Animates automatically.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 3 — SessionReplay animation starts and shows distilled fields', async () => {
    // Animation starts after 600ms mount delay
    await expect(page.getByText('DISTILLED AGENT PATH: 1 screen')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Zone Classification')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Max Permitted Height')).toBeVisible({ timeout: 5_000 })
  })

  await test.step('Beat 3 — source tags appear after typing animation completes', async () => {
    await expect(page.getByText('from GIS API')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('from PDF §14.3')).toBeVisible({ timeout: 20_000 })
    // Completion summary
    await expect(page.getByText(/screens.*1 screen/i)).toBeVisible({ timeout: 25_000 })
  })

  await test.step('Beat 3 — confirm replay, advance to correction step', async () => {
    await page.getByRole('button', { name: 'Looks good — continue' }).click()
    await expect(page.getByText('CORRECTION (OPTIONAL)')).toBeVisible()
    await expect(page.getByPlaceholder('Describe the correction here...')).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 4 — The Correction (1:25–2:00)
  // Expert notices wiki is not the authoritative source.
  // Clicks "Show me" → UI navigates to Policy Reference PDF → expert clicks correct paragraph.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 4 — type correction noting PDF is authoritative', async () => {
    await page.getByPlaceholder('Describe the correction here...').fill(
      'The policy source should be the PDF document, not the wiki. The wiki is sometimes outdated.'
    )
    await expect(page.getByRole('button', { name: 'Show me' })).toBeVisible()
  })

  await test.step('Beat 4 — "Show me" auto-navigates legacy UI to Policy Reference PDF tab', async () => {
    await page.getByRole('button', { name: 'Show me' }).click()
    // Recording banner appears
    await expect(page.getByText(/RECORDING WORKFLOW/i)).toBeVisible({ timeout: 3_000 })
    // Legacy UI should have auto-switched to POLICY REFERENCE
    // and Policy Reference should have auto-switched to PDF Viewer
    await expect(page.getByText('MUNICIPAL CODE — Chapter 14')).toBeVisible({ timeout: 5_000 })
    // PDF paragraphs are selectable (dashed border visible in demo mode)
    await expect(page.locator('[data-testid="pdf-section-section-14-3"]')).toBeVisible()
  })

  await test.step('Beat 4 — click §14.3 paragraph registers as knowledge source', async () => {
    await page.locator('[data-testid="pdf-section-section-14-3"]').click()
    // Paragraph shows selected confirmation
    await expect(page.getByText('✓ Selected as knowledge source')).toBeVisible()
    // Demo mode turns off — recording banner disappears
    await expect(page.getByText(/RECORDING WORKFLOW/i)).toBeHidden({ timeout: 5_000 })
    // Correction textarea updated with the confirmed source reference
    const textarea = page.getByPlaceholder('Describe the correction here...')
    await expect(textarea).toContainText('Source confirmed', { timeout: 3_000 })
  })

  await test.step('Beat 4 — confirm correction triggers Gemini spec regeneration', async () => {
    await page.getByRole('button', { name: 'Confirm & continue' }).click()
    // Gemini gemini-2.5-flash call — allow up to 45s
    await expect(page.getByText('AGENT SPEC PREVIEW')).toBeVisible({ timeout: 45_000 })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 5 — Publish (2:00–2:25)
  // Expert reviews the corrected spec summary, validates it, publishes.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 5 — SpecSummary shows human-readable spec with action sequence', async () => {
    await expect(page.getByText('AGENT SPEC PREVIEW')).toBeVisible()
    await expect(page.getByText('ACTION SEQUENCE')).toBeVisible()
    await expect(page.getByText('KNOWLEDGE SOURCES')).toBeVisible()
    // Knowledge sources must include the PDF source the expert selected
    await expect(page.getByText(/PDF/i).first()).toBeVisible()
  })

  await test.step('Beat 5 — "Review & Validate" button opens ValidationReplay', async () => {
    await page.getByRole('button', { name: 'Review & Validate Workflow' }).click()
    await expect(page.getByText('HITL VALIDATION REPLAY')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Begin Validation Replay' })).toBeVisible()
  })

  await test.step('Beat 5 — ValidationReplay animates agent steps on Application Form', async () => {
    await page.getByRole('button', { name: 'Begin Validation Replay' }).click()
    // Animation plays through spec action steps
    await expect(page.getByText('Validation Complete')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Publish to Agentverse' })).toBeVisible()
  })

  await test.step('Beat 5 — publish agent to Agentverse', async () => {
    await page.getByRole('button', { name: 'Publish to Agentverse' }).click()
    // Publish calls Gemini twice (spec build + embedding) — allow 30s
    await expect(page.getByText('Agent published to Agentverse')).toBeVisible({ timeout: 30_000 })
    // Tab Progression Bar updates: agent pill appears
    await expect(page.locator('[data-testid="optimization-badge"]')).toBeHidden({ timeout: 5_000 })
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 6 — The Payoff (2:25–2:50)
  // Next fence variance app opens → published agent auto-fills fields.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 6 — close panel, navigate back to inbox', async () => {
    await page.getByRole('button', { name: 'View in Agentverse' }).click()
    // Close the Agentverse panel
    await page.locator('button').filter({ hasText: '×' }).click()
    await page.getByRole('button', { name: 'APPLICATION INBOX' }).click()
    await expect(page.getByText('APPLICATION INBOX — PENDING REVIEW QUEUE')).toBeVisible()
  })

  await test.step('Beat 6 — open PRM-2024-0042 (Thomas Redfield, another fence variance)', async () => {
    await page.locator('[data-testid="app-row-PRM-2024-0042"]').click()
    await expect(page.getByText('APPLICATION FORM — PRM-2024-0042')).toBeVisible()
  })

  await test.step('Beat 6 — ⚡ Automate button visible, click triggers agent run', async () => {
    await expect(page.getByRole('button', { name: /Automate/i })).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: /Automate/i }).click()
  })

  await test.step('Beat 6 — Zone and Max Height fields auto-fill with source tags', async () => {
    // Fields fill via typing animation from NarrowAgent AGENT_DEMO_STEP SSE events
    await expect(page.locator('[data-testid="field-zone"]')).toHaveValue('R-2', {
      timeout: 15_000,
    })
    await expect(page.locator('[data-testid="field-max-height"]')).toHaveValue('6 ft', {
      timeout: 15_000,
    })
    // Source tags visible (from GIS API, from PDF §14.3)
    await expect(page.getByText('from GIS API')).toBeVisible()
    await expect(page.getByText(/PDF §14\.3/i)).toBeVisible()
  })

  // ────────────────────────────────────────────────────────────────────
  // BEAT 7 — The Agentverse (2:50–3:00)
  // Agentverse panel shows the published agent card with metadata.
  // ────────────────────────────────────────────────────────────────────
  await test.step('Beat 7 — open Agentverse panel from Tab Progression Bar', async () => {
    await page.getByRole('button', { name: /Agentverse/i }).click()
    await expect(page.locator('[data-testid="agent-card"]').first()).toBeVisible({ timeout: 5_000 })
  })

  await test.step('Beat 7 — agent card shows SUPERVISED trust badge and run count', async () => {
    const card = page.locator('[data-testid="agent-card"]').first()
    await expect(card.getByText('supervised')).toBeVisible()
    // Run counter shows at least 1 successful run (Beat 6 payoff)
    await expect(card.getByText(/1 runs/i)).toBeVisible()
    // Permit type tag
    await expect(card.getByText('fence_variance')).toBeVisible()
  })
})
