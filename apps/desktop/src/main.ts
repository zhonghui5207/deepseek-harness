/**
 * Electron main entry: boot the web profile tree in-process, then load the
 * served SPA in a context-isolated window. The renderer stays a pure browser
 * environment — no Node, no preload — so the client behaves exactly as it
 * does in a browser tab; the agent's filesystem, shell, and sandbox seams all
 * live in the main process.
 * @module @deepseek-ai/dsh-desktop/main
 */

import { app, BrowserWindow } from 'electron'
import type { Context } from '@deepseek-ai/cordis'
import { bootDesktop } from './boot.ts'

/** The local URL the booted `webserver` serves the SPA on. */
const DESKTOP_URL = 'http://127.0.0.1:3081'

let root: Context | undefined
let mainWindow: BrowserWindow | undefined

/** Create the single desktop window pointing at the booted local server. */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'DeepSeek Harness',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  void mainWindow.loadURL(DESKTOP_URL)
  mainWindow.on('closed', () => {
    mainWindow = undefined
  })
}

void app.whenReady().then(async () => {
  root = await bootDesktop()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await root?.fiber.dispose()
  root = undefined
  if (process.platform !== 'darwin') app.quit()
})
