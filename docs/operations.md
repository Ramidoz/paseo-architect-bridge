# Operations

## Linux

```sh
systemctl --user status paseo-architect-bridge.service
journalctl --user -u paseo-architect-bridge.service -n 60
systemctl --user restart paseo-architect-bridge.service
loginctl show-user "$USER" -p Linger
curl -fsS http://127.0.0.1:18768/readyz
```

For headless boot, enable linger and separately ensure the existing Paseo
daemon starts at boot. A user bridge service cannot make a stopped daemon
available. The bridge and tunnel must both have outbound network access.

Uninstall the service (keeps configuration/database/source):

```sh
systemctl --user disable --now paseo-architect-bridge.service
rm ~/.config/systemd/user/paseo-architect-bridge.service
systemctl --user daemon-reload
```

## macOS

```sh
launchctl print gui/$(id -u)/com.paseo.architect-bridge
launchctl kickstart -k gui/$(id -u)/com.paseo.architect-bridge
tail -n 60 ~/.local/state/paseo-architect/service.log
curl -fsS http://127.0.0.1:18768/readyz
```

To update an already loaded LaunchAgent, boot it out before reinstalling:

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.paseo.architect-bridge.plist
# Run install --start again
```

To uninstall, boot it out and remove that plist; private state remains.
LaunchAgents start after login. Keep the Mac awake while serving requests.
The tunnel health UI and bridge remain loopback-only.

## Move from Mac to Linux without changing the ChatGPT connection

1. Install/build this package on Linux. Download its matching tunnel binary.
2. Securely transfer private OAuth/tunnel configuration outside the source
   directory; change `PASEO_URL` to `ws://127.0.0.1:6767/ws`. Verify permissions.
3. Stop bridge polling while taking a consistent SQLite backup, or use SQLite's
   online backup API. Transfer the backup privately if retaining history/cursors.
   Do not copy an actively changing main file without its WAL.
4. Probe the Linux daemon and install the service without starting it. Enable
   linger and verify the daemon's boot configuration.
5. Stop the Mac tunnel runtime. Start the Linux bridge service using the same
   tunnel ID, OAuth issuer, audience and subject. Never operate two competing
   runtimes for one tunnel.
6. Test in normal ChatGPT, confirm current daemon/session information, and
   verify Linux service restart. Only then stop the old Mac bridge/SSH forward.
   Roll back by stopping Linux and restarting the old Mac runtime if needed.

Never transfer the runtime key through a public issue, release, command-line
argument or chat message. Use your authenticated private SSH file transfer.

## Updates and retained data

Back up configuration and SQLite outside the source tree. Install a new
version in a stable directory, build/test, then restart the user service.
The installed definition contains absolute executable paths; if you move the
source or Node executable, reinstall the service. The bridge default database
is `~/.local/share/paseo-architect/events.sqlite` unless `PASEO_DB` is set.
No automatic retention, cost controls or project allowlist beyond the daemon's
own access scope is provided. Do not upload logs without reviewing them.
