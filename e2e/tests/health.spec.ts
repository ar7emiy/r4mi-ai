/**
 * Health checks — fast, no Gemini API calls.
 * Run these first to confirm infrastructure is up before the full demo flow.
 *
 * Prerequisites:
 *   backend:    cd backend && uvicorn main:app --reload --port 8000
 *   frontend:   cd frontend && npm run dev
 *   permit-app: cd mock-sites/permit-app && npm run dev
 *
 * Note: /api/stubs/* is served by the permit-app (port 4000) via its own
 * Vite middleware — NOT by the r4mi backend. The backend has no stubs router.
 */
import { test, expect } from '@playwright/test'

const BACKEND = 'http://localhost:8000'
const PERMIT_APP = 'http://localhost:4000'

test('backend is alive', async ({ request }) => {
  const r = await request.get(`${BACKEND}/health`)
  expect(r.status()).toBe(200)
  const body = await r.json()
  expect(body.status).toBe('ok')
})

test('permit-app: applications endpoint returns all 9 rows', async ({ request }) => {
  const r = await request.get(`${PERMIT_APP}/api/stubs/applications`)
  expect(r.ok()).toBeTruthy()
  const apps = await r.json()
  expect(apps.length).toBeGreaterThanOrEqual(9)
  const ids: string[] = apps.map((a: any) => a.application_id)
  expect(ids).toContain('PRM-2024-0041')  // demo application
  expect(ids).toContain('PRM-2024-0042')  // payoff application
})

test('backend: /api/stubs/* no longer exists on r4mi backend', async ({ request }) => {
  // Stubs moved to permit-app. Backend should 404 for stubs paths.
  const r = await request.get(`${BACKEND}/api/stubs/applications`)
  expect(r.status()).toBe(404)
})

test('permit-app: GIS returns R-2 for PRM-2024-0041 parcel', async ({ request }) => {
  const r = await request.get(`${PERMIT_APP}/api/stubs/gis/R2-0041-BW`)
  expect(r.ok()).toBeTruthy()
  const data = await r.json()
  expect(data.zone_classification).toBe('R-2')
})

test('permit-app: GIS returns R-2 for payoff app parcel', async ({ request }) => {
  const r = await request.get(`${PERMIT_APP}/api/stubs/gis/R2-0042-BW`)
  expect(r.ok()).toBeTruthy()
  const data = await r.json()
  expect(data.zone_classification).toBe('R-2')
})

test('permit-app: new fence variance tickets have GIS records', async ({ request }) => {
  for (const parcel of ['R2-0043-BW', 'R2-0044-BW', 'R2-0045-BW']) {
    const r = await request.get(`${PERMIT_APP}/api/stubs/gis/${parcel}`)
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
  await expect(page.locator('#r4mi-toggle')).toBeVisible({ timeout: 5000 })
})

test('frontend: clicking PRM-2024-0041 row opens Application Form', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="app-row-PRM-2024-0041"]').click()
  await expect(page.getByText('APPLICATION FORM — PRM-2024-0041')).toBeVisible()
  await expect(page.getByText('APPLICANT INFORMATION')).toBeVisible()
})

test('frontend: GIS PARCEL LOOKUP tab is accessible', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'GIS PARCEL LOOKUP' }).click()
  await expect(page.getByText('GIS PARCEL LOOKUP').first()).toBeVisible()
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
