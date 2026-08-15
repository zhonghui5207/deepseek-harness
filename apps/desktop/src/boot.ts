/**
 * Thin profile boot for the desktop shell: resolve the web profile, stack its
 * patch layers (bundle layers, the profile's own `cordis.patch.yml`, the
 * home-level user layer, then desktop overlays), and mount the tree in the
 * Electron main process. Mirrors `apps/cli`'s `runProfile` without its
 * process-signal ownership and without live user-patch HMR — the desktop shell
 * owns shutdown through `ctx.fiber.dispose()` instead.
 * @module @deepseek-ai/dsh-desktop/boot
 */

import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import {
  boot,
  healProfilesModuleFallback,
  homePatchPath,
  indexComposedRows,
  installFailLoud,
  loadLayeredEnv,
  loadOptionalPatches,
  loadProfile,
  PROFILE_ROOT_FILENAME,
  resolveTelemetryPatch,
  shippedAgentPresetOverlay,
  TELEMETRY_ROW_ID,
} from '@deepseek-ai/dsh-app-boot'
import { DSH_LAUNCH_ENVIRONMENT_KEY } from '@deepseek-ai/dsh-launch-environment'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Boot-surface name used for diagnostics and the `.env` layering snapshot. */
const NAME = 'dsh-desktop'

/** Empty root entry list every profile tree patches over. */
const PROFILE_ROOT_CONFIG = '[]\n'

/** Absolute path of this app's package.json: the bundle-resolution anchor. */
const INSTALL_ANCHOR = fileURLToPath(new URL('../package.json', import.meta.url))

/** System presets supplied by the installed DSH application package. */
const SHIPPED_AGENT_PRESET_IDS = ['code', 'cordis', 'minimal', 'standard'] as const

/** Preset fields needed to verify the installed application assets. */
interface InstalledAgentPreset {
  id: string
  trust: 'system' | 'user'
  broken?: string
}

/** Runtime face used only for startup verification. */
interface AgentPresetRoster {
  list(): Promise<readonly InstalledAgentPreset[]>
}

/** Resolve the single installed source of DSH's system preset compositions. */
function shippedPresetRoot(): string {
  const require = createRequire(INSTALL_ANCHOR)
  const dshPackage = require.resolve('@deepseek-ai/dsh/package.json')
  return join(dirname(dshPackage), 'config', 'agent-presets')
}

/** Launch-owned patch inputs that do not belong in the shared Web profile. */
export interface DesktopPatchComposition {
  /** Bundle layers concatenated, below every user layer. */
  bundlePatches: readonly PatchOptions[]
  /** The profile's own `cordis.patch.yml` layer. */
  profilePatches: readonly PatchOptions[]
  /** The home-level user layer (`$DSH_HOME/cordis.patch.yml`). */
  homePatches: readonly PatchOptions[]
  /** Loopback port overlay; zero lets the operating system choose. */
  port: number
  /** Absolute directory of the installed DSH system preset compositions. */
  shippedPresetRoot: string
  /** Raw `DSH_TELEMETRY_DISABLED` value (`undefined` when unset). */
  telemetryDisabledEnv: string | undefined
}

/**
 * Compose Desktop's launch-owned overlays over the profile layers.
 *
 * The webserver loopback overlay is indexed with the profile layers so the
 * preset and telemetry patches see the same composed rows that mount. Missing
 * `agent-presets` fails loud: Desktop cannot open a session without the
 * installed system roster.
 * @param input - profile layers plus Desktop-owned overlay inputs.
 * @returns the full patch stack in application order.
 */
export function composeDesktopPatches(input: DesktopPatchComposition): PatchOptions[] {
  const overlays: PatchOptions[] = [
    { id: 'webserver', config: { host: '127.0.0.1', port: input.port } },
  ]
  const rows = indexComposedRows([
    [...input.bundlePatches],
    [...input.profilePatches],
    [...input.homePatches],
    overlays,
  ])
  const presetOverlay = shippedAgentPresetOverlay(rows, input.shippedPresetRoot)
  if (presetOverlay === undefined) {
    throw new Error('dsh-desktop: web profile has no agent-presets entry')
  }
  overlays.push(presetOverlay)
  const telemetryPatch = resolveTelemetryPatch(input.telemetryDisabledEnv, rows.has(TELEMETRY_ROW_ID))
  if (telemetryPatch !== undefined) overlays.push(telemetryPatch)
  return [
    ...input.bundlePatches,
    ...input.profilePatches,
    ...input.homePatches,
    ...overlays,
  ]
}

/** Reject an incomplete installation before an interaction needs a preset. */
async function verifyShippedPresets(ctx: Context): Promise<readonly string[]> {
  const roster = (ctx as Context & { agentPresets?: AgentPresetRoster }).agentPresets
  if (roster === undefined) throw new Error('dsh-desktop: web profile activated without agentPresets')
  const presets = await roster.list()
  const systemPresets = new Map(presets.filter(preset => preset.trust === 'system').map(preset => [preset.id, preset]))
  const missing = SHIPPED_AGENT_PRESET_IDS.filter(id => !systemPresets.has(id))
  const broken = SHIPPED_AGENT_PRESET_IDS.flatMap((id) => {
    const reason = systemPresets.get(id)?.broken
    return reason === undefined ? [] : [`${id}: ${reason}`]
  })
  if (missing.length > 0 || broken.length > 0) {
    const failures = [
      ...missing.length === 0 ? [] : [`missing ${missing.join(', ')}`],
      ...broken.length === 0 ? [] : [`invalid ${broken.join('; ')}`],
    ]
    throw new Error(`dsh-desktop: installed system agent presets are unusable (${failures.join('; ')})`)
  }
  return SHIPPED_AGENT_PRESET_IDS
}

/** Launch-owned inputs that do not belong in the shared Web profile. */
export interface DesktopBootOptions {
  /** Requested loopback port; zero lets the operating system choose an unused port. */
  port?: number
  /** Forward a config-tree exit request into the Electron lifecycle. */
  requestExit?: (code: number) => void
}

/** Settled Desktop host state and the exact loopback URL its renderer loads. */
export interface DesktopRuntime {
  /** Root context; the caller owns disposal and must await it before process exit. */
  context: Context
  /** URL built from the WebServer's actual bound host and port. */
  url: string
  /** Validated system preset ids supplied by the installed DSH package. */
  agentPresetIds: readonly string[]
}

/**
 * Boot the `web` profile in-process and return its settled root context.
 *
 * A programmatic overlay binds the server to loopback and requests an
 * OS-assigned port by default. A `prepare` hook supplies the frozen launch
 * environment and command-line snapshot before any config-tree entry mounts,
 * exactly as the CLI surface does. Fail-loud wraps the booted tree so an
 * unhandled rejection tears it down instead of wedging the process.
 * @param options - launch-owned port and application-exit handling.
 * @returns the booted context and exact URL; dispose `context.fiber` before exit.
 */
export async function bootDesktop(options: DesktopBootOptions = {}): Promise<DesktopRuntime> {
  healProfilesModuleFallback(INSTALL_ANCHOR)
  const profile = loadProfile(NAME, 'web', INSTALL_ANCHOR)
  // The root is always rewritten: the whole composition is patch layers, and
  // the Loader's write-back can bake composed rows into this file otherwise.
  writeFileSync(join(profile.dir, PROFILE_ROOT_FILENAME), PROFILE_ROOT_CONFIG)
  const patches = composeDesktopPatches({
    bundlePatches: profile.layers.flatMap(layer => layer.patches),
    profilePatches: profile.patches,
    homePatches: loadOptionalPatches(NAME, homePatchPath()) ?? [],
    port: options.port ?? 0,
    shippedPresetRoot: shippedPresetRoot(),
    telemetryDisabledEnv: process.env.DSH_TELEMETRY_DISABLED,
  })
  const ctx = await boot(
    NAME,
    join(profile.dir, PROFILE_ROOT_FILENAME),
    patches,
    (hostCtx) => {
      // Before any config-tree entry mounts, so plugins resolve launch-time
      // environment values from the same immutable provenance snapshot.
      hostCtx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, loadLayeredEnv(NAME))
      // The command line is a launcher fact; the desktop shell owns no inner
      // arguments, while the Electron lifecycle owns config-tree exit requests.
      provideCmdline(hostCtx, { args: [], exit: options.requestExit ?? (() => undefined) })
    },
    pathToFileURL(join(profile.dir, 'package.json')).href,
  )
  const webServer = ctx.get('webServer')
  if (webServer === undefined) {
    await ctx.fiber.dispose()
    throw new Error('dsh-desktop: web profile activated without a webServer service')
  }
  let agentPresetIds: readonly string[]
  try {
    agentPresetIds = await verifyShippedPresets(ctx)
  } catch (error) {
    await ctx.fiber.dispose()
    throw error
  }
  installFailLoud(NAME, process, async () => {
    await ctx.fiber.dispose()
  })
  return {
    context: ctx,
    url: `http://${webServer.host}:${String(webServer.port)}`,
    agentPresetIds,
  }
}
