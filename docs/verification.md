# Verification — October 3, 2026

Version 0.3.1 was installed from its public GitHub tag on headless x86_64 Linux
with Node 22.22.1. The same integration was also exercised on macOS with Node
25.8.1. No operator identities, keys, host addresses, project data or screenshots
are published with this evidence.

- All nine automated tests passed on Linux and macOS: event normalization,
  safe configuration, service rendering, token validation and stateless MCP.
- A valid synthetic owner token initialized MCP, discovered and called a
  read-only fixture tool. Wrong subject, issuer, audience, scope, signature,
  expired/missing claims and malformed bearer tokens were rejected.
- The distributable archive installed in a fresh directory and its CLI ran.
- The packaged bridge read a real Paseo 0.10.3 daemon with Claude and Codex
  sessions on both platforms.
- The macOS LaunchAgent definition passed native plist validation. Actual
  launchd start/stop was not exercised for this release.
- Linux installed and enabled the systemd user service, with linger enabled
  independently so it can run before login. A separate owner-configured boot
  unit starts the existing Paseo daemon from its persistent configuration.
- Restarting the Linux bridge service restored readiness and OAuth discovery.
  Its process belongs to the user service rather than an SSH login session.
- Normal ChatGPT completed authenticated status/session calls through the
  Linux tunnel while the old Mac tunnel was stopped. The observed daemon URL
  was the Linux machine's local loopback daemon, with no ingestion errors.
- Anonymous live MCP requests returned 401. Listener and operator health
  addresses remained loopback-only. Configuration/database files were 0600.
- Existing SQLite events and timeline cursors were retained using an online
  backup. The database remained private and is not part of the release.
- Repository and archive scans excluded operator-specific identifiers, runtime
  keys, local absolute paths, event databases and private project contents.

Boot configuration is enabled; a full machine reboot was not performed while
coding sessions were active. A second real Google identity was not used; wrong
subject rejection is covered by cryptographic authorization tests. GitHub CI
is supplied as a template and was not activated by the publishing credential.
