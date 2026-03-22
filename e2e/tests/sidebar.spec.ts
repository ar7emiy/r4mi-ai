import { test, expect } from '@playwright/test'

test.describe('Sidebar Chat', () => {
  test('toggle button opens sidebar iframe with chat', async ({ page }) => {
    await page.goto('/')
    // Loader toggle button should exist
    const toggle = page.locator('#r4mi-toggle')
    await expect(toggle).toBeVisible({ timeout: 5000 })

    // Click to open sidebar
    await toggle.click()
    await page.waitForTimeout(500)

    // Sidebar container should have width
    const container = page.locator('#r4mi-container')
    const width = await container.evaluate((el) => el.getBoundingClientRect().width)
    expect(width).toBeGreaterThan(300)

    // Iframe should exist and load /sidebar
    const iframe = page.frameLocator('#r4mi-sidebar')
    await expect(iframe.getByText('r4mi-ai', { exact: true })).toBeVisible({ timeout: 5000 })

    // Welcome message should appear
    await expect(iframe.locator('text=observing')).toBeVisible()
  })

  test('clicking toggle again closes sidebar', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('#r4mi-toggle')
    await expect(toggle).toBeVisible({ timeout: 5000 })

    // Open
    await toggle.click()
    await page.waitForTimeout(500)
    let width = await page.locator('#r4mi-container').evaluate((el) => el.getBoundingClientRect().width)
    expect(width).toBeGreaterThan(300)

    // Close
    await toggle.click()
    await page.waitForTimeout(500)
    width = await page.locator('#r4mi-container').evaluate((el) => el.getBoundingClientRect().width)
    expect(width).toBe(0)
  })

  test('agents button opens agentverse drawer', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('#r4mi-toggle')
    await toggle.click()
    await page.waitForTimeout(500)

    const iframe = page.frameLocator('#r4mi-sidebar')
    // Click Agents button in header
    const agentsBtn = iframe.getByRole('button', { name: /Agents/i })
    await expect(agentsBtn).toBeVisible({ timeout: 5000 })
    await agentsBtn.click()

    // Agentverse drawer should show
    await expect(iframe.locator('text=Agentverse')).toBeVisible()
    await expect(iframe.locator('input[placeholder="Search agents..."]')).toBeVisible()
  })

  test('sidebar does not create duplicate button inside iframe', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    // There should be exactly ONE r4mi-toggle button on the page
    const toggleCount = await page.locator('#r4mi-toggle').count()
    expect(toggleCount).toBe(1)
  })

  test('record button toggles recording state', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('#r4mi-toggle')
    await toggle.click()
    await page.waitForTimeout(500)

    const iframe = page.frameLocator('#r4mi-sidebar')
    const recordBtn = iframe.getByRole('button', { name: /Record Workflow/i })
    await expect(recordBtn).toBeVisible({ timeout: 5000 })
    await recordBtn.click()

    // Should now say "Stop Recording"
    await expect(iframe.getByRole('button', { name: /Stop Recording/i })).toBeVisible()
    // Chat should show recording message
    await expect(iframe.locator('text=Recording started')).toBeVisible()
  })
})
