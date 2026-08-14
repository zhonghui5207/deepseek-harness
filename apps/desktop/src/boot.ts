/**
 * Thin profile boot for the desktop shell: resolve the web profile, stack its
 * patch layers (bundle layers, the profile's own `cordis.patch.yml`, the
 * home-level user layer, then a desktop port overlay), and mount the tree in
 * the Electron main process. Mirrors `apps/cli`'s `runProfile` without its
 * process-signal ownership and without live user-patch HMR — the desktop shell
 * owns shutdown through `ctx.fiber.dispose()` instead.
 * @module @deepseek-ai/dsh-desktop/boot
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import {
  boot,
  healProfilesModuleFallback,
  installFailLoud,
  loadLayeredEnv,
  loadOptionalPatches,
  loadProfile,
  PROFILE_PATCH_FILENAME,
} from '@deepseek-ai/dsh-app-boot'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { DSH_LAUNCH_ENVIRONMENT_KEY } from '@deepseek-ai/dsh-launch-environment'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'

/** Boot-surface name used for diagnostics and the `.env` layering snapshot. */
const NAME = 'dsh-desktop'
/** The local port the desktop window loads; distinct from `dsh web`'s 3080. */
const DESKTOP_PORT = 3081
/** Root config filename inside a profile directory. */
const PROFILE_ROOT_FILENAME = 'cordis.yml'

/** Empty root entry list every profile tree patches over. */
const PROFILE_ROOT_CONFIG = '[]\n'

/** Absolute path of this app's package.json: the bundle-resolution anchor. */
export const INSTALL_ANCHOR = fileURLToPath(new URL('../package.json', import.meta.url))

/** The home-level user patch layer (`$DSH_HOME/cordis.patch.yml`). */
export function homePatchPath(): string {
  return join(resolveDshHome(), PROFILE_PATCH_FILENAME)
}

/**
 * Boot the `web` profile in-process and return its settled root context.
 *
 * The desktop window loads `http://127.0.0.1:3081`, so a programmatic overlay
 * pins the `webserver` row away from the default 3080 that a concurrently
 * running `dsh web` owns. A `prepare` hook supplies the frozen launch
 * environment and the command-line snapshot before any config-tree entry
 * mounts, exactly as the CLI surface does. Fail-loud wraps the booted tree so
 * an unhandled rejection tears it down instead of wedging the process.
 * @returns the booted root context; dispose it with `ctx.fiber.dispose()`.
 */
export async function bootDesktop(): Promise<Context> {
  healProfilesModuleFallback(INSTALL_ANCHOR)
  const profile = loadProfile(NAME, 'web', INSTALL_ANCHOR)
  // The root is always rewritten: the whole composition is patch layers, and
  // the Loader's write-back can bake composed rows into this file otherwise.
  writeFileSync(join(profile.dir, PROFILE_ROOT_FILENAME), PROFILE_ROOT_CONFIG)
  const bundlePatches = profile.layers.flatMap(layer => layer.patches)
  const homePatches = loadOptionalPatches(NAME, homePatchPath()) ?? []
  const overlays: PatchOptions[] = [
    { id: 'webserver', config: { host: '127.0.0.1', port: DESKTOP_PORT } },
  ]
  const ctx = await boot(
    NAME,
    join(profile.dir, PROFILE_ROOT_FILENAME),
    [...bundlePatches, ...profile.patches, ...homePatches, ...overlays],
    (hostCtx) => {
      // Before any config-tree entry mounts, so plugins resolve launch-time
      // environment values from the same immutable provenance snapshot.
      hostCtx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, loadLayeredEnv(NAME))
      // The command line is a launcher fact; the desktop shell owns no inner
      // arguments, and app exit is driven by window closure, not a plugin.
      provideCmdline(hostCtx, { args: [], exit: () => undefined })
    },
  )
  installFailLoud(NAME, process, async () => {
    await ctx.fiber.dispose()
  })
  return ctx
}
