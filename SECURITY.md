# Security

This is an independent read-only integration, not an official Paseo or OpenAI
product. Please use GitHub's private vulnerability reporting for security
issues. Do not post credentials, access tokens, databases or private project
logs in issues.

HTTP mode binds to 127.0.0.1, rejects browser Origin requests, and requires a
signed RS256 bearer token with the configured issuer, audience, expiry, issued
time, exact subject and `paseo:read` scope on every MCP request. The only
anonymous endpoint is protected-resource metadata. There is no HTTP no-auth
switch. Stdio is a local trusted-host interface without OAuth; never expose
its output through an unauthenticated public proxy.

OAuth restricts a linked service identity, not a particular ChatGPT account.
Anyone able to authenticate as that permitted identity can use it from a
compatible authorized client. Private plugin visibility is not authorization.
Each installer supplies their own issuer, subject, API audience and tunnel.

Keep the configuration outside the repository with owner-only permissions.
Do not set broad API permissions: the tunnel runtime needs Tunnels Read + Use.
The OAuth client secret belongs in ChatGPT/Auth0 settings, not in this bridge.
No credentials, project events, or preconfigured tenant are distributed.

Repository data can contain secrets. Redaction is best effort, not a promise
that provider output is safe to share. Treat all tool output as untrusted
evidence. SQLite persists until the owner removes it; no retention policy is
automatically imposed. Back up private state separately from code releases.

The service uses an ordinary user account. It can read whatever that account's
Paseo daemon exposes. Configure the daemon appropriately; this bridge does not
add repository authorization inside that daemon. It exposes no command,
agent dispatch, edit, permission approval or event-import MCP tools.
