import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { genofficeUserDataDir } from '../../packages/cli/src/gui'
import { defaultAiSettings, resolveAiSettings } from '../../packages/ai-provider/src/providers'
import { upsertCustomEndpoint } from '../../packages/ai-provider/src/custom-endpoints'
import { sanitizeAiSettings } from '../../packages/ai-provider/src/ai-settings-guard'
import type { AiCustomEndpoint } from '../../packages/ai-provider/src/types'

// Close GenOffice before running: its settings UI also writes this file.
const directory = resolve(
  process.env.GENOFFICE_USER_DATA ?? `${genofficeUserDataDir(process.env)}-Dev`,
)
const path = join(directory, 'ai-settings.json')
const endpoint: AiCustomEndpoint = JSON.parse(
  readFileSync(join(__dirname, 'endpoint.json'), 'utf8'),
)
endpoint.baseUrl = process.env.FLINT_BASE_URL ?? endpoint.baseUrl
endpoint.apiKey = process.env.FLINT_API_KEY ?? endpoint.apiKey
const previous = existsSync(path) ? readFileSync(path, 'utf8') : undefined
const settings = resolveAiSettings(previous ? JSON.parse(previous) : {}, defaultAiSettings())
const updated = sanitizeAiSettings({
  ...upsertCustomEndpoint(settings, endpoint, true),
  provider: 'custom',
  maxOutputTokens: 32768,
})
if (!updated) throw new Error('Invalid Flint settings')
mkdirSync(directory, { recursive: true })
if (previous !== undefined) {
  const backup = `${path}.${Date.now()}.bak`
  copyFileSync(path, backup)
  console.log(`Previous settings saved to ${backup}`)
}
const temporary = `${path}.${process.pid}.tmp`
writeFileSync(temporary, `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600 })
renameSync(temporary, path)
console.log(`Configured Flint at ${endpoint.baseUrl} in ${path}`)
