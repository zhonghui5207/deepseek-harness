import { describe, expect, it } from 'vitest'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import { TELEMETRY_ROW_ID } from '@deepseek-ai/dsh-app-boot/src/index.ts'
import { composeDesktopPatches } from '../src/boot.ts'

const rosterInsert: PatchOptions = {
  insert: [{
    id: 'agent-presets',
    name: '@deepseek-ai/dsh-agent-presets',
    config: { extra: true, roots: [{ path: '/bundle', trust: 'system' }] },
  }],
}

const telemetryInsert: PatchOptions = {
  insert: [{ id: TELEMETRY_ROW_ID, name: 'telemetry' }],
}

describe('composeDesktopPatches', () => {
  it('stacks loopback, shipped-preset, and telemetry overlays over profile layers', () => {
    const patches = composeDesktopPatches({
      bundlePatches: [rosterInsert, telemetryInsert],
      profilePatches: [{ insert: [{ id: 'profile-row', name: 'profile' }] }],
      homePatches: [{ insert: [{ id: 'home-row', name: 'home' }] }],
      port: 0,
      shippedPresetRoot: '/installed/agent-presets',
      telemetryDisabledEnv: '1',
    })
    expect(patches).toEqual([
      rosterInsert,
      telemetryInsert,
      { insert: [{ id: 'profile-row', name: 'profile' }] },
      { insert: [{ id: 'home-row', name: 'home' }] },
      { id: 'webserver', config: { host: '127.0.0.1', port: 0 } },
      {
        id: 'agent-presets',
        config: { extra: true, roots: [{ path: '/installed/agent-presets', trust: 'system' }] },
      },
      { id: TELEMETRY_ROW_ID, disabled: true },
    ])
  })

  it('omits the telemetry overlay when the switch is unset', () => {
    const patches = composeDesktopPatches({
      bundlePatches: [rosterInsert, telemetryInsert],
      profilePatches: [],
      homePatches: [],
      port: 4120,
      shippedPresetRoot: '/installed/agent-presets',
      telemetryDisabledEnv: undefined,
    })
    expect(patches).toEqual([
      rosterInsert,
      telemetryInsert,
      { id: 'webserver', config: { host: '127.0.0.1', port: 4120 } },
      {
        id: 'agent-presets',
        config: { extra: true, roots: [{ path: '/installed/agent-presets', trust: 'system' }] },
      },
    ])
  })

  it('fails loud when the web profile has no agent-presets row', () => {
    expect(() => {
      composeDesktopPatches({
        bundlePatches: [],
        profilePatches: [],
        homePatches: [],
        port: 0,
        shippedPresetRoot: '/installed/agent-presets',
        telemetryDisabledEnv: '1',
      })
    }).toThrow('web profile has no agent-presets entry')
  })
})
