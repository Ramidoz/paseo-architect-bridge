# Paseo API Bridge

Expose Paseo features to ChatGPT and other MCP clients. Runs on **Linux or macOS**.
An independent integration for [Paseo](https://github.com/getpaseo/paseo), not a
replacement daemon or an official Paseo/OpenAI product.

The installation default remains **read-only**. Owners can opt into separate
control and administration scopes. Each person brings their own daemon, tunnel
and OAuth identity. Open-source code does not share anyone's projects.
Project instructions own architecture, orchestration and cross-chat context;
this plugin supplies raw operations, schemas and results.

```text
ChatGPT → OpenAI outbound tunnel → OAuth-protected bridge → local Paseo daemon
                                      ↓
                              private SQLite events
```

Put everything on a headless Linux machine to use ChatGPT from a phone or
browser with your Mac turned off. Alternatively run the bridge on your Mac,
using a local daemon or a private SSH forward to a remote daemon.

## What you can ask

- “List my current Claude and Codex sessions.”
- “What changed in this project since the last update?”
- “Review the changes, explain architectural impact, and suggest the next task.”

The original five evidence tools remain: `paseo_status`, `paseo_agents`,
`paseo_updates`, `paseo_context`, `paseo_diff`. Updates include provider,
project/repository, session/command,
outcome, file status, bounded diffs or statistics, reported tests/errors and
timestamps where the provider supplies them. The included technical skill explains tool use; it does not assign an architect
role or maintain project policy.

## Raw API tools

`paseo_api` discovers 174 allowlisted JSON-callable SDK operations and gives each
operation's named parameters and schemas. Call `paseo_read_request`,
`paseo_control_request` or `paseo_admin_request` with those parameters.
`paseo_result` retrieves saved request results and bounded pages of large output.
See [API coverage](docs/api-coverage.md) for every mapped operation and exclusion.

Scopes:

- `paseo:read`: inspection, timelines, providers, workspaces, terminal captures
  and repository/file reads.
- `paseo:control`: sessions/tasks/permissions, terminals, file/Git changes,
  workspaces, scripts and schedules. These can execute real code and alter work.
- `paseo:admin`: daemon configuration, plugins/skills, hub/pairing access,
  diagnostics, restart, shutdown and updates. These can expose sensitive
  configuration or affect daemon security and availability.

To enable additional groups, set `PASEO_ACCESS=read,control,admin` in private
configuration **and** add matching OAuth permissions to the API/client. Read
tokens never authorize a control/admin call. Local stdio honors the configured
access groups without OAuth; its host is trusted.

Every mutation requires an `idempotencyKey`. Replaying a key with identical
parameters returns its recorded state without execution; different parameters
are rejected. Pending/indeterminate results must be inspected, not blindly
reissued with a new key. These records persist across process restarts.
An RPC acknowledgement is not agent task completion. Read the session/timeline
or terminal afterwards. All arguments/results may contain private information
and remain in the owner-only database; no retention is automatic.

Example after inspecting the createAgent schema:

```json
{
  "operation": "createAgent",
  "parameters": {"options": {"provider": "codex", "cwd": "/your/project", "title": "Your task"}},
  "idempotencyKey": "your-unique-create-request-001"
}
```

Native persistent callback/subscription transports are documented as exclusions.
Audio/browser-related JSON operations do not create a native audio/browser UI.
The daemon/provider may report unsupported capabilities; the bridge returns
the actual outcome. This release maps APIs, not a universal verified guarantee
for every operation.

## Install

Requires Node.js **22.13+**, npm, an existing Paseo daemon (verified against
0.10.3), and `unzip` for the optional tunnel download helper. The bridge has no
model/API inference cost of its own. ChatGPT, OAuth and tunnel providers have
their own eligibility and pricing; this package does not provision accounts.

```sh
git clone https://github.com/Ramidoz/paseo-architect-bridge.git
cd paseo-architect-bridge
npm ci
npm test
npm run build
npm run tunnel
mkdir -p ~/.config/paseo-architect
cp bridge.env.example ~/.config/paseo-architect/bridge.env
chmod 600 ~/.config/paseo-architect/bridge.env
```

Edit that private configuration with **your own** identifiers and runtime key.
Never commit it. Follow [OAuth and ChatGPT setup](docs/authentication.md) before
starting. The official tunnel binary is downloaded from OpenAI's GitHub
release and checked against a pinned SHA-256 digest; it is not redistributed
inside this project's package.

For Paseo on the same machine use `ws://127.0.0.1:6767/ws`. For a remote daemon,
use a private forward (and keep it alive) or a correctly authenticated `wss://`
endpoint. Plain `ws://` outside loopback is rejected by the service CLI.

```sh
node cli/index.mjs probe --config ~/.config/paseo-architect/bridge.env
node cli/index.mjs run --config ~/.config/paseo-architect/bridge.env \
  --tunnel-bin ~/.local/bin/tunnel-client
```

`probe` reads the daemon without starting a tunnel. `run` supervises the bridge
and tunnel together; if either exits, both stop so the OS can restart them.
The bridge listens on loopback 18767; operator health/UI on loopback 18768.
Do not publish these ports. Stop an old runtime before starting another for
the same tunnel. No Mac/SSH hop is needed when the daemon and bridge share Linux.

### Start automatically on Linux

```sh
node cli/index.mjs install --config ~/.config/paseo-architect/bridge.env \
  --tunnel-bin ~/.local/bin/tunnel-client --start
systemctl --user status paseo-architect-bridge.service
# Administrator step: start at boot even before you log in
sudo loginctl enable-linger "$USER"
```

The user service restarts on failure. Your Paseo daemon also needs its own
boot service. Read [operations and migration](docs/operations.md).

### Start automatically on macOS

```sh
node cli/index.mjs install --config ~/.config/paseo-architect/bridge.env \
  --tunnel-bin ~/.local/bin/tunnel-client --start
launchctl print gui/$(id -u)/com.paseo.architect-bridge
```

This installs a per-user LaunchAgent. It starts after login and restarts on
failure; the Mac must remain awake. It does not turn a sleeping/off Mac into a
server or automatically manage your SSH forward. See operations for restart,
logs and uninstall. Add `--dry-run` to review a service definition without
installing it; omit `--start` to install without starting now.

### Local desktop MCP without a cloud tunnel

Use `mcp.json` / `.mcp.json`, or launch `node server/dist/bridge.mjs` as a stdio
MCP server in your trusted desktop host. Set `PASEO_URL` as needed. Stdio does
not require OAuth; never put an unauthenticated web proxy in front of it.
Plugin hosts can load `plugin.json` and `skills/paseo-tools/SKILL.md`.

## Limits and privacy

- Only Paseo-managed sessions and shared repository state are captured. This
  is not a universal monitor of unrelated CLI processes.
- Shared checkout changes have **unknown CLI attribution**. Agent edit events
  give provider evidence but cannot prove exclusive file ownership.
- First connection reads the latest 100 timeline entries per session. Cursors
  catch up incrementally and gaps are reported; it is not a full historical
  import. Very old lifecycle revisions can be missed.
- File snapshots cover uncommitted diffs; ignored files and commit-only
  transitions are not fully captured. Tests are agent-reported, not rerun.
- Polling defaults to 30 seconds. Tools pull updates; no automatic unsolicited
  chat notifications or scheduled architect agent is included.
- SQLite uses owner-only file permissions and persists across restarts. Data
  is not automatically pruned. Secret redaction is best effort; review sensitive
  projects before connecting them to ChatGPT.
- OAuth pins a linked service identity, **not a specific ChatGPT account**.

The checkout API uses a pinned internal Paseo adapter. Reverify it when
upgrading the SDK. See [security](SECURITY.md) and [contributing](CONTRIBUTING.md).

## Packaging

`npm pack` creates a portable package with source, bundled server, skill,
documentation and dependency notices. Runtime credentials, captured events,
node_modules and machine-specific service files are excluded by the package
allowlist. GitHub source/releases are independent of npm registry publication.
The integration code is MIT; dependencies retain their licenses.
A GitHub Actions test template is included at `docs/ci/verify.yml`. To enable
it, copy it to `.github/workflows/verify.yml` using a GitHub credential with
workflow permission.
