# Flint on DGX Spark

This checkout uses the existing RecursiveSI Flint NVFP4 server on port 8004.
Flint supplies the text and tool calls. GenOffice executes document operations
and saves native Office files.

The endpoint profile uses GenOffice's existing custom-provider settings on
Linux, macOS, and Windows. No app-code patch is required. Flint can remain on
the DGX Spark while GenOffice runs on another operating system.

## Build and launch

Requires Node 22.12+, npm 10+, a C compiler, and Rust with Cargo on PATH.

Clone this fork's setup branch on a new machine:

```bash
git clone --branch flint-local https://github.com/Anshul261/genoffice.git
cd genoffice
```

The commands below use the location of the original Linux checkout. Use your
clone's directory on other machines.

```bash
cd ~/Documents/genoffice
source "$HOME/.cargo/env"
npm ci
npm run build:all
npx tsx scripts/flint/configure.ts
npx electron apps/shell
```

For renderer hot reload, use `npm run dev` after the initial build.
On Linux hosts that restrict Electron's unprivileged user namespaces, use
`npx electron --no-sandbox apps/shell` for this local development build.

The configuration script selects Flint in the development profile. It uses
GenOffice's own cross-platform settings-path resolver:

| OS      | Default development settings file                                        |
| ------- | ------------------------------------------------------------------------ |
| Linux   | `~/.config/GenOffice-Dev/ai-settings.json`, respecting `XDG_CONFIG_HOME` |
| macOS   | `~/Library/Application Support/GenOffice-Dev/ai-settings.json`           |
| Windows | `%APPDATA%\GenOffice-Dev\ai-settings.json`                               |

Close the app before running it.
It preserves other configured endpoints and backs up an existing settings file.
Set `GENOFFICE_USER_DATA` to configure a different profile, or `FLINT_BASE_URL`
and `FLINT_API_KEY` for another server address and its credential.

The helper reads `scripts/flint/endpoint.json`, resolves existing settings with
GenOffice's `resolveAiSettings`, and adds or replaces the `ep-flint-local`
endpoint with `upsertCustomEndpoint`. It selects the custom provider, sets the
output budget to 32768, and validates the result with `sanitizeAiSettings`.
The active endpoint's profile is also copied into `providers.custom.profile`
by GenOffice's resolver, which is what the request adapter reads.

Before replacing an existing settings file, it saves an adjacent timestamped
`.bak` copy. It writes the new settings to a temporary file and renames that
file into place. To undo configuration, close GenOffice and restore the backup
as `ai-settings.json`.

For a source checkout on any OS, run `npm ci`, `npm run build:all`,
`npx tsx scripts/flint/configure.ts`, then `npx electron apps/shell`.
The `source` command above is only for Unix shells whose PATH does not yet
include the newly installed Cargo. Windows Rust installations also need the
MSVC C++ build tools for the spreadsheet sidecar.

For an installed GenOffice release, use Settings → AI Model → Custom and enter
the profile below. Its settings folder is `GenOffice` rather than `GenOffice-Dev`.
To configure an installed Windows release from this checkout with PowerShell:

```powershell
$env:GENOFFICE_USER_DATA = Join-Path $env:APPDATA 'GenOffice'
npx tsx scripts/flint/configure.ts
Remove-Item Env:GENOFFICE_USER_DATA
```

On macOS, use:

```bash
GENOFFICE_USER_DATA="$HOME/Library/Application Support/GenOffice" npx tsx scripts/flint/configure.ts
```

## Model settings

The reusable endpoint profile is in `scripts/flint/endpoint.json`.
You can also enter these under Settings → AI Model → Custom:

| Setting                   | Value                                                  |
| ------------------------- | ------------------------------------------------------ |
| Base URL                  | `http://127.0.0.1:8004/v1`                             |
| Model                     | `flint`                                                |
| API key                   | `local`, a placeholder for this unauthenticated server |
| Protocol                  | OpenAI-compatible                                      |
| Echo reasoning            | On                                                     |
| Vision                    | No                                                     |
| Use max completion tokens | Off, send `max_tokens`                                 |
| Idle timeout              | 300 seconds                                            |
| Output token budget       | 32768                                                  |
| Context window            | 262144                                                 |
| Extra request body        | `{"temperature":1,"top_p":0.95,"top_k":20,"min_p":0}`  |

Reasoning replay matters for multi-step tool use. GenOffice normally decides
whether to replay `reasoning_content` from the model name; the explicit profile
enables it for Flint. The context size matches this server's launch configuration.
Keep the placeholder key: this upstream version's desktop chat rejects an empty
key even though the settings page and direct provider adapter accept one.

## Try document work

Open a new Word document and ask:

> Draft a one-page implementation plan for an internal document search service.
> Include a scope section, an API example, and a table of milestones and owners.

In Sheets:

> Create a project budget with columns for item, quantity, unit cost, and total.
> Add five example items, calculate totals with formulas, and add a grand total.

Flint's coding and structured-output abilities are useful for formulas, document
operations, slide specifications, and HTML. This checkpoint is text-only, so
screenshot review and image analysis need a separate vision provider. Search
and media providers have their own settings in GenOffice.

## CLI

After building, the checkout's CLI works directly:

```bash
packages/cli/bin/genoffice --version
packages/cli/bin/genoffice create --type docx --from notes.md --out notes.docx
packages/cli/bin/genoffice info notes.docx --json
packages/cli/bin/genoffice mcp
```

In Windows PowerShell, use `packages\cli\bin\genoffice.cmd` in place of
`packages/cli/bin/genoffice`.

A coding agent can use the CLI or MCP tools with Flint as its model. The CLI
builds and edits files; it does not select or call the text model itself.

## Installed on this machine

The build and live checks were run on Linux ARM64. Windows and macOS use the
same profile and existing path resolver, but have not been run here.

- Checkout: `~/Documents/genoffice`, branch `flint-local`, based on upstream
  `8ab58a51`. The existing fork is `Anshul261/genoffice`.
- Open **GenOffice Flint Dev** from the applications menu.
- `genoffice` is on PATH through `~/.local/bin/genoffice`.
- A live Flint/MCP run created and inspected
  `~/Documents/GenOffice/flint-setup-demo.docx`.
- The desktop AI panel then corrected the document's Python example and saved
  the edit. The extracted code ran successfully and created another `.docx`.

The first draft invented a Python `DocumentTool` API. Supplying the real CLI
usage let Flint correct it through the editor. Give it the CLI reference or
agent skill for coding examples, and run generated code before relying on it.

The source build, formatting, lint, dependency-license check, provider typecheck,
508 provider tests, 230 agent-core tests, and 466 CLI tests passed. Two CLI tests
were skipped. Generate Sheets fixtures before running the CLI suite:

```bash
npm run fixtures -w @genoffice/sheets
npm run test -w @genoffice/cli
```

The full upstream checks are not green on this baseline. `npm test` stops at
`packages/font-metrics/tests/font-covering.test.ts`, where an installed font
maps a codepoint the test expects to be unmapped. `npm run typecheck` stops at
`packages/docx-engine/tests/resolve-props.test.ts`, which imports symbols that
the package index does not export. Logs are under `/tmp/opencode/genoffice-*.log`.

## Server controls

```bash
curl -fsS http://127.0.0.1:8004/health
curl -fsS http://127.0.0.1:8004/v1/models
cd ~/Documents/vllm/dgx_spark/deployments/flint_nvfp4
./04-start-server.sh
```

Spark Control at <http://127.0.0.1:7861> also manages Flint. For GenOffice on
another computer, forward the port and use the same localhost base URL:

```bash
ssh -L 8004:127.0.0.1:8004 YOUR_SPARK_USER@YOUR_SPARK_HOST
```

The SSH command also works in macOS Terminal and Windows PowerShell with the
OpenSSH client installed. Keep the tunnel running while using GenOffice.
`127.0.0.1` always refers to the computer running GenOffice, so a remote client
needs this tunnel or a reachable server URL. Use the same recent GenOffice
version on each OS so its custom-endpoint profile fields are available.
