import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import electron from 'electron'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const desktopEntry = fileURLToPath(new URL('../lib/main.js', import.meta.url))
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Desktop built entry snapshot', () => {
  it('boots the Web profile and creates a session from every shipped preset', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-desktop-snapshot-'))
    temporaryRoots.push(home)
    const { stdout, stderr } = await execFileAsync(electron as unknown as string, [
      desktopEntry,
      '--dsh-desktop-smoke',
    ], {
      cwd: home,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE,
        SHELL: process.env.SHELL,
        DSH_HOME: home,
        DSH_TELEMETRY_DISABLED: '1',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
      timeout: 60_000,
    })

    expect(stderr).toBe('')
    const smokeLine = stdout.split('\n').find(line => line.startsWith('dsh desktop smoke: '))
    expect(smokeLine).toBeDefined()
    expect(JSON.parse(smokeLine?.slice('dsh desktop smoke: '.length) ?? '')).toMatchInlineSnapshot(`
      {
        "agentPresetIds": [
          "code",
          "cordis",
          "minimal",
          "standard",
        ],
        "contentType": "text/html; charset=utf-8",
        "createdPresets": [
          "code",
          "cordis",
          "minimal",
          "standard",
        ],
        "hasBootManifest": true,
        "loopback": true,
        "status": 200,
      }
    `)
  })
})
