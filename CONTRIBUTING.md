# Contributing

Use Node 22.13+ and `npm ci`, then `npm test` and `npm run build`. The included workflow template exercises
Linux/macOS on Node 22/24 when enabled. Do not introduce write/dispatch tools or bypass
authentication. Test authorization failures as well as successful requests.

Keep environment-specific identifiers, credentials, events and screenshots
out of examples/tests. Fixtures must be synthetic. Changes to the pinned
Paseo SDK/internal checkout adapter need a real daemon compatibility check.

Please describe the concrete behavior changed, test evidence, and limits.
Report vulnerabilities privately rather than exposing project data in issues.
