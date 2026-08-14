/** Run the unpacked Electron artifact through boot, system-preset discovery, and session creation. */

import { execFile } from 'node:child_process'
import { globSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const workspaceRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const artifactRoot = join(workspaceRoot, '.artifacts', 'desktop')
const patterns = {
  darwin: ['mac*/*.app/Contents/MacOS/*'],
  linux: ['linux*/dsh-desktop', 'linux*/DSH Desktop'],
  win32: ['win*/*.exe'],
}
const platformPatterns = patterns[process.platform]
if (platformPatterns === undefined) throw new Error(`unsupported Desktop smoke platform: ${process.platform}`)

const matches = globSync(platformPatterns, { cwd: artifactRoot }).sort()
if (matches.length !== 1) {
  throw new Error(
    `expected one packaged Desktop executable matching ${platformPatterns.join(' or ')}, found ${String(matches.length)}`,
  )
}

const home = await mkdtemp(join(tmpdir(), 'dsh-desktop-packaged-smoke-'))
try {
  const executable = join(artifactRoot, matches[0])
  const electronUserData = join(home, 'electron-user-data')
  const { stdout, stderr } = await execFileAsync(executable, [
    `--user-data-dir=${electronUserData}`,
    '--dsh-desktop-smoke',
  ], {
    cwd: home,
    env: {
      ...process.env,
      DSH_HOME: home,
      DSH_TELEMETRY_DISABLED: '1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
    maxBuffer: 5 * 1024 * 1024,
    timeout: 60_000,
  })
  if (stderr.length > 0) process.stderr.write(stderr)
  const prefix = 'dsh desktop smoke: '
  const line = stdout.split(/\r?\n/).find(candidate => candidate.startsWith(prefix))
  if (line === undefined) throw new Error(`packaged Desktop emitted no smoke result:\n${stdout}`)
  const result = JSON.parse(line.slice(prefix.length))
  const shippedPresets = ['code', 'cordis', 'minimal', 'standard']
  const shippedUpdateCheck = {
    releasesUrl: 'https://github.com/zhonghui5207/deepseek-harness-desktop/releases/latest',
    menuLabels: { en: 'Check for Updates…', zh: '检查更新…' },
  }
  if (result.status !== 200 || result.contentType !== 'text/html; charset=utf-8'
    || result.hasBootManifest !== true || result.loopback !== true
    || JSON.stringify(result.agentPresetIds) !== JSON.stringify(shippedPresets)
    || JSON.stringify(result.createdPresets) !== JSON.stringify(shippedPresets)
    || JSON.stringify(result.updateCheck) !== JSON.stringify(shippedUpdateCheck)) {
    throw new Error(`packaged Desktop smoke returned an invalid result: ${JSON.stringify(result)}`)
  }
  process.stdout.write('dsh packaged Desktop smoke: ok\n')
} finally {
  await rm(home, { recursive: true, force: true })
}
