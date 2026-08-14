/** URL policy for the sandboxed Desktop renderer. */

/**
 * Whether a navigation stays inside the application server's origin.
 * @param appUrl - Booted application URL.
 * @param targetUrl - Navigation destination.
 * @returns true only for the same scheme, host, and port.
 */
export function isApplicationNavigation(appUrl: string, targetUrl: string): boolean {
  try {
    return new URL(targetUrl).origin === new URL(appUrl).origin
  } catch {
    return false
  }
}

/**
 * Whether Electron may hand a target to the operating system's browser.
 * @param targetUrl - Requested external destination.
 * @returns true only for HTTP and HTTPS URLs.
 */
export function isExternalWebUrl(targetUrl: string): boolean {
  try {
    const protocol = new URL(targetUrl).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
