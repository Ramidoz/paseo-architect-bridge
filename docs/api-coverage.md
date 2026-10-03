# Paseo API coverage

Generated from the pinned SDK 0.10.3. 174 JSON-callable methods are exposed by a fixed allowlist; this is API coverage, not a claim that every operation was exercised live. Positional SDK arguments become named parameters in MCP. Use paseo_api for schemas before calls.

| Operation | Scope | Parameters |
|---|---|---|
| abortRequest | control |  |
| addProject | control | cwd, requestId? |
| appendAgentTimelineItem | control | agentId, item |
| applyAgentConfig | control | agentId, config |
| applyPluginUpdates | admin | proposals |
| archiveAgent | control | agentId |
| archivePaseoWorktree | control | input, requestId? |
| archiveWorkspace | control | workspaceId, requestId? |
| audioPlayed | control | id |
| buildAgentForkContext | read | agentId, options? |
| cancelAgent | control | agentId |
| cancelDictationStream | control | dictationId |
| captureTerminal | read | terminalId, options?, requestId? |
| checkoutCommit | control | cwd, input, requestId? |
| checkoutDiscardChanges | control | cwd, input |
| checkoutForgeGetCheckDetails | control | input, requestId? |
| checkoutForgeSetAutoMerge | control | cwd, input, requestId? |
| checkoutGithubGetCheckDetails | admin | input, requestId? |
| checkoutGithubSetAutoMerge | admin | cwd, input, requestId? |
| checkoutMerge | control | cwd, input, requestId? |
| checkoutMergeFromBase | control | cwd, input, requestId? |
| checkoutPrCreate | control | cwd, input, requestId? |
| checkoutPrMerge | control | cwd, input, requestId? |
| checkoutPrStatus | control | cwd, requestId? |
| checkoutPull | control | cwd, requestId? |
| checkoutPush | control | cwd, requestId? |
| checkoutRefresh | control | cwd, requestId? |
| checkoutSwitchBranch | control | cwd, branch, requestId? |
| clearAgentAttention | control | agentId |
| clearWorkspaceAttention | control | workspaceId |
| cloneGithubProject | admin | input, requestId? |
| closeItems | control | input, requestId? |
| collectDiagnostics | admin | requestId? |
| connectHub | admin | hubUrl, token, permissions?, requestId? |
| createAgent | control | options |
| createFileEntry | control | input |
| createPaseoWorktree | control | input, requestId? |
| createProjectDirectory | control | input, requestId? |
| createTerminal | control | cwd, name?, requestId?, options? |
| createWorkspace | control | input, requestId? |
| deleteAgent | control | agentId |
| deleteFileEntry | control | input |
| deleteWorkspaceLabel | control | options |
| detachAgent | control | agentId |
| disablePlugin | admin | pluginId |
| disconnectHub | admin | force?, requestId? |
| duplicateFileEntry | control | input |
| enablePlugin | admin | pluginId |
| fetchAgent | read | options |
| fetchAgentHistory | read | options? |
| fetchAgents | read | options? |
| fetchAgentTimeline | read | agentId, options? |
| fetchProviderSubagentTimeline | read | parentAgentId, subagentId, options? |
| fetchRecentProviderSessions | read | options? |
| fetchWorkspaces | read | options? |
| fetchWorkspaceSetupStatus | read | workspaceId, requestId? |
| finishDictationStream | control | dictationId, finalSeq |
| getAgentSkillsStatus | admin |  |
| getBranchSuggestions | read | options, requestId? |
| getCheckoutDiff | read | cwd, compare, requestId? |
| getCheckoutStatus | read | cwd, options? |
| getCommitFileDiff | read | cwd, sha, path, requestId? |
| getDaemonConfig | admin | requestId? |
| getDaemonPairingOffer | admin | options? |
| getDaemonStatus | read | options? |
| getDirectorySuggestions | read | options, requestId? |
| getHubStatus | admin | requestId? |
| getPaseoWorktreeList | read | input, requestId? |
| getPluginCatalog | admin |  |
| getPluginLogs | admin | pluginId |
| getPluginSourceStatus | admin | pluginId? |
| getProjectIcon | read | projectId, requestId? |
| getProviderDiagnostic | read | provider, options? |
| getProvidersSnapshot | read | options? |
| importAgent | control | input |
| importLegacyAgentSkillsSelection | admin | selection |
| inspectDirectoryPlugin | admin | path |
| inspectWorkspaceLabelDelete | read | options |
| inspectWorkspaceRecovery | read | workspaceId, requestId? |
| installDirectoryPlugin | admin | path, id? |
| installPluginSource | admin | input |
| invokePluginRpc | admin | pluginId, method, input |
| killTerminal | control | terminalId, requestId? |
| listAgentTimelinePrompts | read | agentId, options? |
| listAvailableProviders | read | options? |
| listCheckoutCommits | read | cwd, requestId? |
| listCommands | read | options |
| listDirectory | read | cwd, path, requestId? |
| listPlugins | admin |  |
| listProjects | read | options? |
| listProviderFeatures | read | draftConfig, options? |
| listProviderModels | read | provider, options? |
| listProviderModes | read | provider, options? |
| listProviderSubagents | read | parentAgentId, options? |
| listProviderUsage | read | options? |
| listTerminals | read | cwd?, requestId?, options? |
| listWorkspaceLabels | read | options? |
| listWorkspaceScripts | read | workspaceId, requestId? |
| markWorkspaceUnread | control | workspaceId, requestId? |
| measureLatency | read | params? |
| openProject | control | cwd, requestId? |
| patchDaemonConfig | admin | config, requestId? |
| ping | read | params? |
| previewPluginUpdates | admin | input? |
| pullRequestTimeline | control | input, requestId? |
| readFile | read | cwd, path, requestId?, maxBytes? |
| readProjectConfig | admin | repoRoot, requestId? |
| reconcileAgentSkills | admin |  |
| refreshAgent | control | agentId, requestId? |
| refreshProvidersSnapshot | control | options? |
| reloadDaemonConfig | admin | requestId? |
| reloadPlugin | admin | pluginId |
| removePlugin | admin | pluginId |
| removeProject | control | projectId, requestId? |
| renameBranch | control | input |
| renameFileEntry | control | input |
| renameProject | control | projectId, customName, requestId? |
| renameTerminal | control | input |
| requestDownloadToken | admin | cwd, path, requestId? |
| requestProjectIcon | read | cwd, requestId? |
| respondToPermission | control | agentId, requestId, response |
| respondToPermissionAndWait | control | agentId, requestId, response, timeout? |
| restartServer | admin | reason?, requestId?, options? |
| restoreWorkspace | control | workspaceId, requestId? |
| resumeAgent | control | handle, overrides? |
| rewindAgent | control | agentId, messageId, mode |
| runWorkspaceSetup | control | workspaceId, requestId? |
| saveAgentSkillsSelection | admin | selection, confirmedRemovals? |
| scheduleCreate | control | options |
| scheduleDelete | control | options |
| scheduleInspect | control | options |
| scheduleList | control | requestId? |
| scheduleLogs | control | options |
| schedulePause | control | options |
| scheduleResume | control | options |
| scheduleRunOnce | control | options |
| scheduleUpdate | control | options |
| searchAgentTimeline | read | { agentId, query, cursor, } |
| searchForge | read | options, requestId? |
| searchGitHub | admin | options, requestId? |
| searchGithubRepositories | admin | input, requestId? |
| sendAgentMessage | control | agentId, text, options? |
| sendDictationStreamChunk | control | dictationId, seq, audio, format |
| sendMessage | control | agentId, text, options? |
| sendTerminalInput | control | terminalId, message |
| sendVoiceAudioChunk | control | audio, format, isLast? |
| setAgentFeature | control | agentId, featureId, value |
| setAgentMode | control | agentId, modeId |
| setAgentModel | control | agentId, modelId |
| setAgentThinkingOption | control | agentId, thinkingOptionId |
| setProjectIcon | control | projectId, source, requestId? |
| setVoiceMode | control | enabled, agentId? |
| setWorkspaceLabel | control | options |
| setWorkspacePinned | control | workspaceId, pinned, requestId? |
| setWorkspaceTitle | control | workspaceId, title, requestId? |
| shutdownServer | admin | options? |
| startDictationStream | control | dictationId, format |
| startWorkspaceScript | control | workspaceId, scriptName, requestId? |
| startWorkspaceScriptWithStatus | control | workspaceId, scriptName, requestId? |
| stashList | control | cwd, options?, requestId? |
| stashPop | control | cwd, stashIndex, requestId? |
| stashSave | control | cwd, options?, requestId? |
| stopWorkspaceScript | control | workspaceId, scriptName, requestId? |
| uninstallAgentSkills | admin |  |
| updateAgent | control | agentId, updates |
| updateDaemon | admin | requestId? |
| updateHubPermissions | admin | input, requestId? |
| updatePluginSources | admin | pluginId? |
| updateWorkspaceLabel | control | options |
| uploadFile | control | input |
| validateBranch | read | options, requestId? |
| waitForFinish | read | agentId, timeout? |
| writeFile | control | input |
| writeProjectConfig | admin | input |

## Not represented as synchronous calls

- connect: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- close: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- ensureConnected: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- getConnectionState: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- subscribeConnectionStatus: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- getLastLivenessRttMs: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- subscribe: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- subscribeRawMessages: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- on: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- on: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- onAgentAttentionRequired: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- sendHeartbeat: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- registerPushToken: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- unregisterPushToken: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- registerBrowserHost: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- observeEvents: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- observeAgents: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- observeWorkspaces: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- fetchAgents: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- fetchWorkspaces: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- observeWorkspaceLabels: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- observeTimeline: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- subscribeAgentTimeline: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- observeCheckoutDiff: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- observeFile: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- subscribeFile: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- sendBrowserAutomationExecuteResponse: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- waitForAgentUpsert: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- observeTerminals: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- observeTerminal: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- subscribeTerminal: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- onTerminalStreamEvent: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- waitForTerminalStreamEvent: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- getLastServerInfoMessage: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.
- setReconnectEnabled: Transport, native UI, callback or persistent subscription; use bounded timeline/terminal/event reads instead.

Persistent native audio/browser transports are not a ChatGPT voice/browser UI. Their JSON-callable controls are available, but native callbacks/subscriptions need a streaming adapter. Provider capabilities and daemon feature flags still determine whether an operation is supported. No architecture or cross-chat coordination policy lives in this catalog.
