import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'

const DIAG_DIR = 'test-results/diagnostic'

test.describe('Sidebar Diagnostic', () => {
  test.beforeAll(() => {
    fs.mkdirSync(DIAG_DIR, { recursive: true })
  })

  test('capture full sidebar experience', async ({ page }) => {
    test.setTimeout(120_000)

    const logs: string[] = []
    const errors: string[] = []

    page.on('console', (msg) => {
      logs.push(`[${msg.type()}] ${msg.text()}`)
    })
    page.on('pageerror', (err) => {
      errors.push(`PAGE ERROR: ${err.message}`)
    })

    // ── Step 1: Load main page ───────────────────────────────────
    await page.goto('/')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${DIAG_DIR}/01-main-page.png`, fullPage: true })

    // Check: toggle button exists
    const toggleVisible = await page.locator('#r4mi-toggle').isVisible()
    logs.push(`DIAG: Toggle button visible = ${toggleVisible}`)

    // Check: iframe exists
    const iframeExists = await page.locator('#r4mi-sidebar').count()
    logs.push(`DIAG: Sidebar iframe count = ${iframeExists}`)

    // ── Step 2: Open sidebar ─────────────────────────────────────
    await page.locator('#r4mi-toggle').click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${DIAG_DIR}/02-sidebar-open.png`, fullPage: true })

    // Check sidebar iframe content
    const sidebar = page.frameLocator('#r4mi-sidebar')

    const headerVisible = await sidebar.getByText('r4mi-ai', { exact: true }).isVisible().catch(() => false)
    logs.push(`DIAG: Sidebar header visible = ${headerVisible}`)

    const welcomeVisible = await sidebar.locator('text=observing').isVisible().catch(() => false)
    logs.push(`DIAG: Welcome message visible = ${welcomeVisible}`)

    const recordBtnVisible = await sidebar.getByRole('button', { name: /Record/i }).isVisible().catch(() => false)
    logs.push(`DIAG: Record button visible = ${recordBtnVisible}`)

    const agentsBtnVisible = await sidebar.getByRole('button', { name: /Agents/i }).isVisible().catch(() => false)
    logs.push(`DIAG: Agents button visible = ${agentsBtnVisible}`)

    const inputVisible = await sidebar.locator('input[placeholder*="command"]').isVisible().catch(() => false)
    logs.push(`DIAG: Chat input visible = ${inputVisible}`)

    // ── Step 3: Type in chat ─────────────────────────────────────
    const chatInput = sidebar.locator('input')
    await chatInput.fill('hello world')
    await chatInput.press('Enter')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${DIAG_DIR}/03-after-chat-input.png`, fullPage: true })

    const userMsgVisible = await sidebar.locator('text=hello world').isVisible().catch(() => false)
    logs.push(`DIAG: User message appeared = ${userMsgVisible}`)

    // ── Step 4: Type /help command ───────────────────────────────
    await chatInput.fill('/help')
    await chatInput.press('Enter')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${DIAG_DIR}/04-after-help.png`, fullPage: true })

    const helpVisible = await sidebar.locator('text=Available commands').isVisible().catch(() => false)
    logs.push(`DIAG: /help response visible = ${helpVisible}`)

    // ── Step 5: Agents drawer ────────────────────────────────────
    await sidebar.getByRole('button', { name: /Agents/i }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${DIAG_DIR}/05-agentverse.png`, fullPage: true })

    const agentverseVisible = await sidebar.locator('text=Agentverse').isVisible().catch(() => false)
    logs.push(`DIAG: Agentverse drawer visible = ${agentverseVisible}`)

    const searchVisible = await sidebar.locator('input[placeholder*="Search"]').isVisible().catch(() => false)
    logs.push(`DIAG: Search input visible = ${searchVisible}`)

    // Check how many agents are loaded
    const agentCards = await sidebar.locator('text=SUPERVISED').count().catch(() => 0)
    const agentCardsAuto = await sidebar.locator('text=AUTONOMOUS').count().catch(() => 0)
    logs.push(`DIAG: Agent cards (SUPERVISED) = ${agentCards}`)
    logs.push(`DIAG: Agent cards (AUTONOMOUS) = ${agentCardsAuto}`)

    // ── Step 6: Go back and process a permit ─────────────────────
    // Close agentverse
    await sidebar.getByRole('button', { name: 'x' }).first().click()
    await page.waitForTimeout(300)

    // Click on PRM-2024-0041
    await page.locator('[data-testid="app-row-PRM-2024-0041"]').click()
    await page.waitForTimeout(500)

    // Navigate GIS → Policy → Form → Submit
    await page.getByText('GIS PARCEL LOOKUP').click()
    await page.waitForTimeout(300)
    await page.getByText('POLICY REFERENCE').click()
    await page.waitForTimeout(300)
    await page.getByText('APPLICATION FORM').click()
    await page.waitForTimeout(300)

    // Submit
    const submitBtn = page.locator('[data-testid="submit-application"], button:has-text("SUBMIT")')
    if (await submitBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.first().click()
    }

    // Wait for SSE notification
    await page.waitForTimeout(5000) // Let embedding + comparison happen
    await page.screenshot({ path: `${DIAG_DIR}/06-after-submit.png`, fullPage: true })

    // Check if pattern notification appeared
    const patternMsg = await sidebar.locator('text=Pattern detected').isVisible().catch(() => false)
    logs.push(`DIAG: Pattern notification appeared = ${patternMsg}`)

    if (patternMsg) {
      // Wait a bit more for the full message
      await page.waitForTimeout(2000)
      await page.screenshot({ path: `${DIAG_DIR}/07-pattern-detected.png`, fullPage: true })

      // Check for build button
      const buildBtn = await sidebar.getByRole('button', { name: /Build Agent/i }).isVisible().catch(() => false)
      logs.push(`DIAG: Build Agent button visible = ${buildBtn}`)
    } else {
      // Wait longer and retry
      await page.waitForTimeout(30000)
      await page.screenshot({ path: `${DIAG_DIR}/07-waiting-longer.png`, fullPage: true })
      const patternRetry = await sidebar.locator('text=Pattern detected').isVisible().catch(() => false)
      logs.push(`DIAG: Pattern notification after 30s wait = ${patternRetry}`)
    }

    // ── Write diagnostic report ──────────────────────────────────
    const report = [
      '# Sidebar Diagnostic Report',
      `Date: ${new Date().toISOString()}`,
      '',
      '## Console Logs',
      ...logs.map((l) => `  ${l}`),
      '',
      '## Page Errors',
      errors.length ? errors.map((e) => `  ${e}`).join('\n') : '  (none)',
      '',
      '## Screenshots',
      '  01-main-page.png — Initial page load',
      '  02-sidebar-open.png — After clicking toggle',
      '  03-after-chat-input.png — After typing "hello world"',
      '  04-after-help.png — After /help command',
      '  05-agentverse.png — Agents drawer',
      '  06-after-submit.png — After submitting permit application',
      '  07-pattern-detected.png — After pattern detection (if any)',
    ].join('\n')

    fs.writeFileSync(`${DIAG_DIR}/REPORT.md`, report)
    console.log(report)

    // Fail if critical things are broken
    expect(toggleVisible, 'Toggle button should be visible').toBeTruthy()
    expect(headerVisible, 'Sidebar header should be visible').toBeTruthy()
    expect(welcomeVisible, 'Welcome message should appear').toBeTruthy()
    expect(userMsgVisible, 'User messages should appear in chat').toBeTruthy()
    expect(helpVisible, '/help should show commands').toBeTruthy()
    expect(agentverseVisible, 'Agentverse should open').toBeTruthy()
  })
})
