/**
 * ai:web-search / ai:image-search for the editors' main processes: reads
 * ai-settings.json live and turns the search provider choice into
 * SearchOptions — Genspark keeps the historic chain (gsk when signed in and
 * cloud tools are on, then env keys, then free Parallel MCP, then DuckDuckGo); a
 * selected custom provider runs first and skips gsk. Keenable's free endpoint
 * only runs when Keenable is the selected provider.
 */

import {
  activeSearchProvider,
  cloudToolsEnabled,
  searchEnabled,
  type AiSearchProviderId,
  type AiSettings,
} from '@genoffice/ai-provider'
import { imageSearch, webSearch, type SearchOptions, type WebSearchResponse } from './index'
import { readAiSettingsFile } from './media-tools'

export function searchOptionsFromSettings(settings: AiSettings): SearchOptions {
  const provider = activeSearchProvider(settings)
  if (provider === 'genspark') return { useGsk: cloudToolsEnabled(settings) }
  const key = settings.search!.providers?.[provider]?.apiKey?.trim() ?? ''
  if (provider === 'parallel') return { useGsk: false, parallelKey: key, prefer: 'parallel' }
  if (provider === 'serply') return { useGsk: false, serplyKey: key, prefer: 'serply' }
  if (provider === 'exa') return { useGsk: false, exaKey: key, prefer: 'exa' }
  if (provider === 'firecrawl') return { useGsk: false, firecrawlKey: key, prefer: 'firecrawl' }
  if (provider === 'keenable') return { useGsk: false, keenableKey: key, prefer: 'keenable' }
  return provider === 'tavily'
    ? { useGsk: false, tavilyKey: key, prefer: 'tavily' }
    : { useGsk: false, serperKey: key }
}

/** Told to the model, so it stops and informs the user instead of retrying. */
export const SEARCH_OFF_ERROR =
  'search is turned off in Settings. Do not retry. Tell the user that web and image search are off.'

/**
 * The switch is enforced here rather than in the renderers, so no app and no
 * keyless fallback (Parallel, DuckDuckGo) can send a query while it is off.
 */
export async function webSearchTool(
  settingsPath: string,
  query: string,
  maxResults = 6,
): Promise<WebSearchResponse> {
  const settings = readAiSettingsFile(settingsPath)
  if (!searchEnabled(settings)) return { results: [], method: 'error', error: SEARCH_OFF_ERROR }
  return webSearch(query, maxResults, searchOptionsFromSettings(settings))
}

export async function imageSearchTool(settingsPath: string, query: string, maxResults = 8) {
  const settings = readAiSettingsFile(settingsPath)
  if (!searchEnabled(settings)) return { images: [], method: 'error', error: SEARCH_OFF_ERROR }
  return imageSearch(query, maxResults, searchOptionsFromSettings(settings))
}

/** settings-UI test: the selected backend (keyed or free) must answer one minimal query. */
export async function testSearchProvider(
  provider: AiSearchProviderId,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  if (provider === 'genspark') return { ok: true }
  apiKey = apiKey.trim()
  if (!apiKey && provider !== 'parallel' && provider !== 'keenable')
    return { ok: false, error: 'API key is empty' }
  const options: SearchOptions = {
    useGsk: false,
    serperKey: provider === 'serper' ? apiKey : '',
    serplyKey: provider === 'serply' ? apiKey : '',
    tavilyKey: provider === 'tavily' ? apiKey : '',
    parallelKey: provider === 'parallel' ? apiKey : '',
    exaKey: provider === 'exa' ? apiKey : '',
    firecrawlKey: provider === 'firecrawl' ? apiKey : '',
    keenableKey: provider === 'keenable' ? apiKey : '',
    prefer: provider,
  }
  const r = await webSearch('GenOffice', 1, options)
  if (r.method === provider) return { ok: true }
  return {
    ok: false,
    error:
      r.method === 'error'
        ? (r.error ?? 'search failed')
        : `${provider} did not answer (service unavailable, key rejected or quota exhausted); fell back to ${r.method}`,
  }
}
