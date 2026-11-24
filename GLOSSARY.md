# T3 Code Fork: Projects & Folders

Domain vocabulary for this fork's orchestration sidebar and server features, layered cleanly on top of upstream `pingdotgg/t3code`.

## Language

**Project**:
A top-level orchestrator conversation in the sidebar's `Projects` section that automatically runs in `/orchestrate` mode, carries an optional durable goal, and owns a tree of delegated sub-agents. Clicking a Project opens its orchestrator chat; its chevron expands its sub-agent tree.
_Avoid_: Folder, Repository, Captain, Workspace

**Folder**:
A sidebar container in the lower `Folders` section—either a Git workspace directory (what upstream T3 Code internally stores as `ProjectId` / `ProjectRow`) or a user-created grouping folder for organizing normal threads.
_Avoid_: Project (in UI copy)

**Project Folder**:
A user-created visual grouping container inside the top `Projects` section used to organize multiple Projects together (for example, `Clients` or `Internal`).
_Avoid_: Repository, Workspace

**Thread Folder**:
A user-created visual grouping container inside the lower `Folders` section used to organize normal threads independently of their underlying Git repository.
_Avoid_: Project, Worktree

**Workspace Repository**:
The underlying Git directory or local filesystem root attached to a thread for code execution and worktrees (represented internally by upstream `ProjectId` and `workspaceRoot`).
_Avoid_: Sidebar Folder, Orchestrator Project

**Normal Thread**:
A standalone conversation without orchestrator-project status, displayed under `Folders` rather than under `Projects`.
_Avoid_: Session, Sub-Agent

**Sub-Agent**:
A delegated task (`delegate_task`) or provider-native child thread spawned under a Project orchestrator or under another Sub-Agent, rendered recursively inside its owning Project's dropdown tree.
_Avoid_: Worker Thread, Top-Level Thread
