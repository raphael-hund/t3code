# 0002: Server-Injected Orchestrator & Sub-Agent Instructions and Cross-Folder Local Delegation

---
status: accepted
date: 2026-11-24
---

Upstream `pingdotgg/t3code` rejects local `delegate_task` calls that target a different `projectId` than the parent thread and injects a blanket `"Start no subagents unless your task says to"` instruction to children while relying on user-typed slash commands for `/orchestrate`. We lift the local cross-folder restriction in `OrchestratorMcpService` (validating the target workspace exists and resolving worktree base commits against the target repository) and inject server-authored Project Orchestrator (`/orchestrate` + durable Project goal) and Project Sub-Agent (root goal + nested sub-agent permission) sections across all provider adapters.

## Considered Options

- **Prepend `/orchestrate` only in the frontend composer on message 1.** Rejected because slash commands only trigger natively on Claude, disappear on `freshContext` restarts or compaction, and never propagate project goals or nested-delegation rules to sub-agents.
- **Build an external watcher/hook layer like `firstmate`.** Rejected because T3 Code's server already owns event-sourced sub-agent lineage, worktree setup, and completion wakeups; adding an external watcher would duplicate the control plane.

## Consequences

- A Project works identically across Claude, Codex, Antigravity, Cursor, and OpenCode, surviving compaction and `freshContext` restarts without losing `/orchestrate` behavior or its goal.
- A Project started with any folder (or no folder) can freely delegate isolated worktree sub-agents into any local repository on the environment, and sub-agents can recursively spawn their own sub-agents.
- Upstream `OrchestrationV2AppThreadLineage` (`parentThreadId`, `rootThreadId`) powers the sidebar dropdown tree natively once `ShellStream` retains active plus the 5 newest completed sub-agents per Project parent.
