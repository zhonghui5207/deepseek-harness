// Keyless browser regression for the tabbed right inspector: the session-header
// Files action opens the existing details column on the Files tab, lists the
// session cwd (files and directories), drills one directory, and the Details
// tab remains reachable after close. Zero model calls — the session is a
// seeded fixture and the listing is host.listEntries over real files.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden,
  launchWebScaffold, seedSession, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/right-inspector-files', import.meta.url))
const SEED = fileURLToPath(new URL('./snapshots/seeded-history/seed.jsonl', import.meta.url))
const FILES_EXPECTED = join(SNAPSHOT_DIR, 'files.expected.md')
const DETAILS_EXPECTED = join(SNAPSHOT_DIR, 'details.expected.md')
const MODE = webSnapshotMode()
const SEED_ID = 'right-inspector-files-web-e2e'

describe.skipIf(MODE === 'record')('web e2e: right inspector Files and Details tabs', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    await mkdir(join(scaffold.workspaceCwd, 'src'), { recursive: true })
    await writeFile(join(scaffold.workspaceCwd, 'README.md'), 'hello\n')
    await writeFile(join(scaffold.workspaceCwd, 'src', 'index.ts'), 'export {}\n')
    await seedSession(scaffold, await readFile(SEED, 'utf8'), SEED_ID)
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })

    const groupRow = page.locator('[role="treeitem"]').first()
    await groupRow.waitFor({ timeout: 15_000 })
    await groupRow.click()
    const sessionRow = page.locator('[role="treeitem"]').nth(1)
    await sessionRow.waitFor({ timeout: 10_000 })
    await sessionRow.click()
    await page.getByText('DONE', { exact: true }).waitFor({ timeout: 15_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('opens Files, drills one directory, closes, and switches to Details', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-right-inspector-files'))
    const frame = page.locator('[style*="grid-template-columns"]').first()
    await page.getByRole('button', { name: 'Files', exact: true }).click()
    const inspector = page.getByRole('complementary', { name: 'Inspector' })
    await expect.poll(() => frame.getAttribute('data-details-collapsed'), { timeout: 5_000 }).toBeNull()
    await inspector.waitFor({ state: 'visible', timeout: 10_000 })
    expect(await inspector.getByRole('tab', { name: 'Files', exact: true }).getAttribute('aria-selected')).toBe('true')
    await inspector.getByRole('button', { name: 'README.md', exact: true }).waitFor({ state: 'visible' })
    await inspector.getByRole('button', { name: 'src', exact: true }).waitFor({ state: 'visible' })

    const filesSnapshot = await captureStableAria(page, '[aria-label="Inspector"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(FILES_EXPECTED, filesSnapshot, MODE)

    await inspector.getByRole('button', { name: 'src', exact: true }).click()
    await inspector.getByRole('button', { name: 'index.ts', exact: true }).waitFor({ state: 'visible' })

    await inspector.getByRole('button', { name: 'Close details', exact: true }).click()
    await expect.poll(() => frame.getAttribute('data-details-collapsed'), { timeout: 5_000 }).toBe('true')

    await page.getByRole('button', { name: 'Files', exact: true }).click()
    await expect.poll(() => frame.getAttribute('data-details-collapsed'), { timeout: 5_000 }).toBeNull()
    await inspector.waitFor({ state: 'visible', timeout: 10_000 })
    await inspector.getByRole('button', { name: 'index.ts', exact: true }).waitFor({ state: 'visible' })

    await inspector.getByRole('tab', { name: 'Details', exact: true }).click()
    expect(await inspector.getByRole('tab', { name: 'Details', exact: true }).getAttribute('aria-selected')).toBe('true')
    await inspector.getByText('Click a tool row in the message flow to view its details').waitFor({ state: 'visible' })

    const detailsSnapshot = await captureStableAria(page, '[aria-label="Inspector"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(DETAILS_EXPECTED, detailsSnapshot, MODE)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  }, 60_000)

  it('keeps its snapshot inventory closed', async () => {
    await assertFixtureInventory(SNAPSHOT_DIR, ['files.expected.md', 'details.expected.md'])
  })
})
