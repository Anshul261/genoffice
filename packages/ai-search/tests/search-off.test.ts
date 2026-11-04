import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultAiSettings } from '@genoffice/ai-provider'
import { imageSearchTool, SEARCH_OFF_ERROR, webSearchTool } from '../src/search-tools'

function settingsFile(search: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), 'search-off-')), 'ai-settings.json')
  writeFileSync(path, JSON.stringify({ ...defaultAiSettings(), gskToolsEnabled: false, search }))
  return path
}

const off = { provider: 'tavily', providers: { tavily: { apiKey: 'tvly-x' } }, enabled: false }

describe('the web search switch', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends nothing from web search while off, even with a key configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const result = await webSearchTool(settingsFile(off), 'private query')
    expect(result).toEqual({ results: [], method: 'error', error: SEARCH_OFF_ERROR })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends nothing from image search while off', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const result = await imageSearchTool(settingsFile(off), 'private query')
    expect(result).toEqual({ images: [], method: 'error', error: SEARCH_OFF_ERROR })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('still searches when the field is absent, as older settings files have it', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { enabled: _enabled, ...on } = off
    await webSearchTool(settingsFile(on), 'query')
    expect(fetchSpy).toHaveBeenCalled()
  })
})
