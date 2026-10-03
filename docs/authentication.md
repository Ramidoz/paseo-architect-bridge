# Owner-authenticated ChatGPT connection

Each installer supplies their own OpenAI tunnel and OAuth provider. These
steps describe the tested Auth0/Google path, not a shared hosted service.

1. Create an OpenAI Platform tunnel scoped to your ChatGPT workspace. Obtain
   its tunnel ID and a **Restricted, Tunnels Read + Use** runtime API key.
2. In Auth0 create an API with RS256 signing and audience equal to the canonical
   tunnel resource, `https://api.openai.com/v1/mcp/tunnel_YOURID`. Add the
   `paseo:read` permission. Deny machine-to-machine access if not needed.
3. Create a regular web OAuth application. Enable Google for it (domain-level
   connection support may be needed for a third-party client). Use your own
   Google OAuth credentials for production rather than development keys.
4. Log in with your intended Google account and copy its complete stable Auth0
   user ID. Set `PASEO_OAUTH_SUBJECT` to that exact ID, not an email wildcard.
5. Add ChatGPT's **exact** displayed callback URL to Auth0. The tested stable
   callback is `https://chatgpt.com/connector_platform_oauth_redirect` when
   authorization responses identify the issuer; use the URL shown in your
   setup rather than assuming it is identical for all configurations.
6. Permit user-delegated API access for this client with `paseo:read`. Set the
   private bridge config's issuer (HTTPS root ending in `/`), audience, subject,
   tunnel ID and runtime key. Client secret is not needed by the bridge.
7. Start the service, then create your private ChatGPT MCP app/plugin using
   the existing tunnel, selecting OAuth and your registered client ID/secret.
   The tested token authentication method is `client_secret_post`. Discovery
   should find your issuer, authorization/token endpoints and read scope.
8. Ensure the resource field is the **canonical API audience** above, even if
   discovery displays an internal gateway hostname. Do not disable audience
   validation to work around a mismatch.
9. Connect your Google account and approve the read scope. Confirm exactly
   five read-only tools. Test connection status and session listing in a chat.

The resource server validates signature, issuer, audience, expiration, issued
time, exact allowed subject and scope for each request. A second Google user
can authenticate with Auth0 but cannot read this bridge's project data. The
OAuth client secret belongs only in the OAuth/ChatGPT configuration. Keep the
runtime key and local config private. Metadata is anonymous; MCP is not.

References:
- https://developers.openai.com/plugins/build/auth
- https://github.com/openai/tunnel-client/blob/master/docs/end-user-guide.md
- https://github.com/openai/tunnel-client/blob/master/docs/connectors.md
- https://auth0.com/docs/authenticate/identity-providers/promote-connections-to-domain-level
