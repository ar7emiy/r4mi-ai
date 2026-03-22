/**
 * Health checks — fast, no Gemini API calls.
 * Run these first to confirm infrastructure is up before the full demo flow.
 *
 * Prerequisites:
 *   backend:  cd backend && uvicorn main:app --reload --port 8000
 *   frontend: cd frontend && npm run dev
 */
import { test, expect } from '@playwright/test'

test('backend is alive', async ({ request }) => {
  const r = await request.get('http://localhost:8000/health')
  expect(r.status()).toBe(200)
  const body = await r.json()
  expect(body.status).toBe('ok')
})

test('seed data: applications endpoint returns all 9 rows', async ({ request }) => {
  const r = await request.get('http://localhost:8000/api/stubs/applications')
  expect(r.ok()).toBeTruthy()
  const apps = await r.json()
  expect(apps.length).toBeGreaterThanOrEqual(9)
  const ids: string[] = apps.map((a: any) => a.application_id)
  expect(ids).toContain('PRM-2024-0041')  // demo application
  expect(ids).toContain('PRM-2024-0042')  // payoff application
})

test('seed data: demo session_001 exists (DEMO_SESSION_SEED=true required)', async ({ request }) => {
  const r = await request.get('http://localhost:8000/api/evidence/session_001')
  expect(r.status()).toBe(200)
})

test('seed data: GIS returns R-2 for PRM-2024-0041 parcel', async ({ request }) => {
  const r = await request.get('http://localhost:8000/api/stubs/gis/R2-0041-BW')
  expect(r.ok()).toBeTruthy()
  const data = await r.json()
  expect(data.zone_classification).toBe('R-2')
})

test('seed data: GIS returns R-2 for payoff app parcel', async ({ request }) => {
  const r = await request.get('http://localhost:8000/api/stubs/gis/R2-0042-BW')
  expect(r.ok()).toBeTruthy()
  const data = await r.json()
  expect(data.zone_classification).toBe('R-2')
})

test('seed data: new fence variance tickets have GIS records', async ({ request }) => {
  for (const parcel of ['R2-0043-BW', 'R2-0044-BW', 'R2-0045-BW']) {
    const r = await request.get(`http://localhost:8000/api/stubs/gis/${parcel}`)
    expect(r.ok(), `GIS missing for ${parcel}`).toBeTruthy()
    const data = await r.json()
    expect(data.zone_classification, `Wrong zone for ${parcel}`).toBe('R-2')
  }
})

test('frontend loads: APPLICATION INBOX is visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('APPLICATION INBOX — PENDING REVIEW QUEUE')).toBeVisible()
  await expect(page.getByText('PRM-2024-0041')).toBeVisible()
  await expect(page.getByText('Margaret Hollis')).toBeVisible()
})

test('frontend: r4mi-ai sidebar toggle button is rendered', async ({ page }) => {
  await page.goto('/')
  // The loader script injects a floating toggle button
  await expect(page.locator('#r4mi-toggle')).toBeVisible({ timeout: 5000 })
})

test('frontend: clicking PRM-2024-0041 row opens Application Form', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="app-row-PRM-2024-0041"]').click()
  // Form title confirms correct application loaded; applicant fields are readonly textareas
  // (Playwright can't select by textarea value; use toHaveValue on a specific locator)
  await expect(page.getByText('APPLICATION FORM — PRM-2024-0041')).toBeVisible()
  await expect(page.getByText('APPLICANT INFORMATION')).toBeVisible()
})

test('frontend: GIS PARCEL LOOKUP tab is accessible', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'GIS PARCEL LOOKUP' }).click()
  // The tab button and panel header both contain this text — use first() to avoid strict mode error
  await expect(page.getByText('GIS PARCEL LOOKUP').first()).toBeVisible()
  // Actual placeholder on the GIS input is "e.g. R2-0041-BW"
  await expect(page.getByPlaceholder('e.g. R2-0041-BW')).toBeVisible()
})

test('frontend: POLICY REFERENCE shows §14.3 text', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'POLICY REFERENCE' }).click()
  await expect(page.getByText('Section 14.3')).toBeVisible()
  await expect(page.getByText("shall not exceed six feet")).toBeVisible()
})

test('frontend: Policy Reference PDF tab has clickable sections', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'POLICY REFERENCE' }).click()
  await page.getByRole('button', { name: 'PDF Viewer' }).click()
  await expect(page.locator('[data-testid="pdf-section-section-14-3"]')).toBeVisible()
})
