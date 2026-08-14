import { describe, expect, it } from 'vitest'
import { isApplicationNavigation, isExternalWebUrl } from '../src/navigation.ts'

describe('Desktop navigation policy', () => {
  it('allows only the booted application origin in the renderer', () => {
    const appUrl = 'http://127.0.0.1:43210'
    expect(isApplicationNavigation(appUrl, `${appUrl}/settings?tab=models`)).toBe(true)
    expect(isApplicationNavigation(appUrl, 'http://127.0.0.1:43211/')).toBe(false)
    expect(isApplicationNavigation(appUrl, 'https://example.com/')).toBe(false)
    expect(isApplicationNavigation(appUrl, 'not a URL')).toBe(false)
  })

  it('hands only HTTP destinations to the operating-system browser', () => {
    expect(isExternalWebUrl('https://example.com/docs')).toBe(true)
    expect(isExternalWebUrl('http://example.com/')).toBe(true)
    expect(isExternalWebUrl('file:///tmp/secret')).toBe(false)
    expect(isExternalWebUrl('javascript:alert(1)')).toBe(false)
    expect(isExternalWebUrl('not a URL')).toBe(false)
  })
})
