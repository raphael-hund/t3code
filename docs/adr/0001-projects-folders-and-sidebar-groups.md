# 0001: Model Projects as Orchestrator-Mode Threads and Separate Sidebar Folders from Upstream ProjectId

---

status: accepted
date: 2026-11-24
---

Upstream `pingdotgg/t3code` pushes daily commits and uses `Project` / `ProjectId` internally across hundreds of files to mean a 1:1 unique filesystem `workspaceRoot`. Rather than renaming `ProjectId` across the codebase or introducing a parallel top-level aggregate table that would constantly conflict with upstream rebases, we model a UI **Project** as an optional `orchestratorProject` configuration on `OrchestrationV2AppThread` (and `OrchestrationV2ThreadShell`), rename workspace directory UI copy to **Folders** (`Add folder`), and persist custom visual grouping containers (`Project Folder` and `Thread Folder`) as `sidebarGroups` in `ServerSettings` paired with an optional `sidebarFolderId` on each thread.

## Considered Options

- **Rename upstream `Project` to `Workspace` across the monorepo and add a new `orchestrator_projects` SQLite table.** Rejected because upstream commits daily; a wide rename would make every upstream merge painful and requires duplicating thread lifecycle, settlement, search, and sync logic.
- **Keep 1:1 Project = Git Repository.** Rejected because users need multiple independent Projects on the same repository (e.g. two separate initiatives in one customer repo) and free repository selection per Project.
- **Client-only localStorage state.** Rejected because Projects, their durable goals, and sidebar grouping folders must stay synchronized across the macOS Desktop app, Web UI, and VPS server.

## Consequences

- Existing orchestrator threads can be promoted to a Project in one metadata update without migrating transcripts or losing their existing `delegate_task` children.
- Every Project automatically inherits thread durability, search, settlement, checkpoints, and WebSocket shell sync.
- Internal code keeps `ProjectId` for workspace directories while UI copy and new fork modules strictly follow `GLOSSARY.md`.
