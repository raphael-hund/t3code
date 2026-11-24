import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { ContextMenuSource, ScopedThreadRef, SidebarGroup } from "@t3tools/contracts";
import { msg, T, useGT, useMessages } from "gt-react";
import { ChevronDownIcon, FolderPlusIcon, PlusIcon } from "lucide-react";
import { useState, type DragEvent, type KeyboardEvent } from "react";

import { cn } from "~/lib/utils";
import { contextMenuSourceOf } from "../../contextMenuSource";
import type { ProjectFaviconProject } from "../ProjectFavicon";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  CustomSidebarFolderHeader,
  InlineNewFolderRow,
  PROJECT_DRAG_MIME,
} from "./CustomSidebarFolderHeader";
import { ProjectAvatar } from "./ProjectAvatar";
import type {
  CustomFolderBucket,
  ProjectRollupStatus,
  ProjectTreeEntry,
} from "./projectSidebar.logic";
import { ProjectSubagentTree } from "./ProjectSubagentTree";

const ROLLUP_DOT_CLASS: Record<Exclude<ProjectRollupStatus, null>, string> = {
  attention: "bg-warning",
  failed: "bg-error",
  working: "bg-info",
  unread: "bg-success",
};

const ROLLUP_DOT_LABEL: Record<Exclude<ProjectRollupStatus, null>, string> = {
  attention: msg(", needs you", { $context: "project status, read after its name" }),
  failed: msg(", failed", { $context: "project status, read after its name" }),
  working: msg(", working", { $context: "project status, read after its name" }),
  unread: msg(", done", { $context: "project status, read after its name" }),
};

function ProjectSidebarRow({
  entry,
  workspaceProject,
  isRouteActive,
  activeSplitSubagentId,
  isExpanded,
  isRenaming,
  renamingTitle,
  collapsedNodeKeys,
  expandedOlderParentKeys,
  onSelectProject,
  onToggleExpand,
  onContextMenu,
  onRenameTitleChange,
  onCommitRename,
  onCancelRename,
  onToggleNode,
  onShowOlder,
  onSelectSubagent,
  indented,
}: {
  readonly entry: ProjectTreeEntry<EnvironmentThreadShell>;
  readonly workspaceProject: ProjectFaviconProject | null;
  readonly isRouteActive: boolean;
  readonly activeSplitSubagentId: string | null;
  readonly isExpanded: boolean;
  readonly isRenaming: boolean;
  readonly renamingTitle: string;
  readonly collapsedNodeKeys: ReadonlySet<string>;
  readonly expandedOlderParentKeys: ReadonlySet<string>;
  readonly onSelectProject: (ref: ScopedThreadRef) => void;
  readonly onToggleExpand: (projectKey: string) => void;
  readonly onContextMenu: (
    project: EnvironmentThreadShell,
    position: { x: number; y: number },
    source: ContextMenuSource,
  ) => void;
  readonly onRenameTitleChange: (title: string) => void;
  readonly onCommitRename: (ref: ScopedThreadRef, title: string) => void;
  readonly onCancelRename: () => void;
  readonly onToggleNode: (nodeKey: string) => void;
  readonly onShowOlder: (parentKey: string) => void;
  readonly onSelectSubagent: (
    projectRef: ScopedThreadRef,
    subagent: EnvironmentThreadShell,
  ) => void;
  readonly indented?: boolean;
}) {
  const gt = useGT();
  const messages = useMessages();
  const projectRef = scopeThreadRef(entry.project.environmentId, entry.project.id);
  const hasDescendants = entry.totalDescendantCount > 0;
  const rollupStatus = entry.rollupStatus;

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommitRename(projectRef, renamingTitle);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancelRename();
    }
  };

  return (
    <li className="list-none">
      <div
        data-testid="sidebar-project-row"
        data-project-key={entry.projectKey}
        draggable={!isRenaming}
        onDragStart={(event) => {
          event.dataTransfer.setData(PROJECT_DRAG_MIME, entry.projectKey);
          event.dataTransfer.effectAllowed = "move";
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu(
            entry.project,
            { x: event.clientX, y: event.clientY },
            contextMenuSourceOf(event),
          );
        }}
        className={cn(
          "group/project-row flex h-8 w-full items-center gap-1.5 rounded-(--control-radius) pr-1.5 transition-colors",
          indented ? "pl-4" : "pl-2",
          isRouteActive
            ? "bg-sidebar-row-active text-sidebar-foreground light:ring-1 light:ring-inset light:ring-sidebar-border/70"
            : "text-sidebar-foreground/90 hover:bg-sidebar-row-hover hover:text-sidebar-foreground",
        )}
      >
        {isRenaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ProjectAvatar
              avatar={entry.project.orchestratorProject?.avatar}
              title={entry.project.title}
              workspaceProject={workspaceProject}
              className="size-5 shrink-0"
            />
            <input
              type="text"
              autoFocus
              value={renamingTitle}
              aria-label={gt("Project title")}
              onChange={(event) => onRenameTitleChange(event.currentTarget.value)}
              onBlur={() => onCommitRename(projectRef, renamingTitle)}
              onKeyDown={handleRenameKeyDown}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-sidebar-foreground outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            aria-current={isRouteActive ? "page" : undefined}
            onClick={() => onSelectProject(projectRef)}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none focus-visible:underline"
          >
            <ProjectAvatar
              avatar={entry.project.orchestratorProject?.avatar}
              title={entry.project.title}
              workspaceProject={workspaceProject}
              className="size-5 shrink-0"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {entry.project.title}
            </span>
          </button>
        )}

        {!isExpanded && rollupStatus !== null ? (
          <span
            data-testid="project-rollup-dot"
            data-rollup-status={rollupStatus}
            className={cn("size-1.5 shrink-0 rounded-full", ROLLUP_DOT_CLASS[rollupStatus])}
          >
            <span className="sr-only">{messages(ROLLUP_DOT_LABEL[rollupStatus])}</span>
          </span>
        ) : null}

        {!isExpanded && entry.activeCount > 0 ? (
          <span
            data-testid="project-active-count"
            className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-sidebar-accent px-1 text-3xs font-medium tabular-nums text-sidebar-muted-foreground"
          >
            {entry.activeCount}
          </span>
        ) : null}

        {hasDescendants ? (
          <button
            type="button"
            data-testid="project-expand-toggle"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? gt("Collapse sub-agents") : gt("Expand sub-agents")}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand(entry.projectKey);
            }}
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <ChevronDownIcon
              aria-hidden
              className={cn("size-3.5 transition-transform", !isExpanded && "-rotate-90")}
            />
          </button>
        ) : null}
      </div>

      {hasDescendants && isExpanded ? (
        <div className="mt-0.5 mb-1">
          <ProjectSubagentTree
            projectRef={projectRef}
            parentKey={entry.projectKey}
            visibleNodes={entry.children}
            allNodes={entry.allChildren}
            hiddenCompletedCount={entry.hiddenCompletedCount}
            depth={0}
            activeSplitSubagentId={isRouteActive ? activeSplitSubagentId : null}
            collapsedNodeKeys={collapsedNodeKeys}
            expandedOlderParentKeys={expandedOlderParentKeys}
            onToggleNode={onToggleNode}
            onShowOlder={onShowOlder}
            onSelectSubagent={onSelectSubagent}
          />
        </div>
      ) : null}
    </li>
  );
}

export function ProjectsSidebarSection({
  projectFolders,
  ungroupedProjects,
  projectByKey,
  routeRowThreadKey,
  activeSplitSubagentId,
  renamingThreadKey,
  renamingTitle,
  renamingGroupId,
  creatingProjectFolder,
  onStartCreateProjectFolder,
  onCommitCreateProjectFolder,
  onCancelCreateProjectFolder,
  onOpenNewProject,
  onSelectProject,
  onSelectSubagent,
  onProjectContextMenu,
  onRenameTitleChange,
  onCommitRename,
  onCancelRename,
  onFolderContextMenu,
  onStartRenameFolder,
  onCommitRenameFolder,
  onCancelRenameFolder,
  onMoveProjectToFolder,
}: {
  readonly projectFolders: readonly CustomFolderBucket<ProjectTreeEntry<EnvironmentThreadShell>>[];
  readonly ungroupedProjects: readonly ProjectTreeEntry<EnvironmentThreadShell>[];
  readonly projectByKey: ReadonlyMap<string, ProjectFaviconProject>;
  readonly routeRowThreadKey: string | null;
  readonly activeSplitSubagentId: string | null;
  readonly renamingThreadKey: string | null;
  readonly renamingTitle: string;
  readonly renamingGroupId: string | null;
  readonly creatingProjectFolder: boolean;
  readonly onStartCreateProjectFolder: () => void;
  readonly onCommitCreateProjectFolder: (name: string) => void;
  readonly onCancelCreateProjectFolder: () => void;
  readonly onOpenNewProject: () => void;
  readonly onSelectProject: (ref: ScopedThreadRef) => void;
  readonly onSelectSubagent: (
    projectRef: ScopedThreadRef,
    subagent: EnvironmentThreadShell,
  ) => void;
  readonly onProjectContextMenu: (
    project: EnvironmentThreadShell,
    position: { x: number; y: number },
    source: ContextMenuSource,
  ) => void;
  readonly onRenameTitleChange: (title: string) => void;
  readonly onCommitRename: (ref: ScopedThreadRef, title: string) => void;
  readonly onCancelRename: () => void;
  readonly onFolderContextMenu: (
    group: SidebarGroup,
    position: { x: number; y: number },
    source: ContextMenuSource,
  ) => void;
  readonly onStartRenameFolder: (group: SidebarGroup) => void;
  readonly onCommitRenameFolder: (groupId: string, nextName: string) => void;
  readonly onCancelRenameFolder: () => void;
  readonly onMoveProjectToFolder: (projectKey: string, folderId: string | null) => void;
}) {
  const gt = useGT();
  const [expandedProjectKeys, setExpandedProjectKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [collapsedNodeKeys, setCollapsedNodeKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [expandedOlderParentKeys, setExpandedOlderParentKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [isUngroupedDragOver, setIsUngroupedDragOver] = useState(false);

  const toggleProjectExpanded = (projectKey: string) => {
    setExpandedProjectKeys((prev) => {
      const next = new Set(prev);
      if (next.has(projectKey)) next.delete(projectKey);
      else next.add(projectKey);
      return next;
    });
  };

  const toggleFolderCollapsed = (folderId: string) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const toggleNodeCollapsed = (nodeKey: string) => {
    setCollapsedNodeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  };

  const showOlderForParent = (parentKey: string) => {
    setExpandedOlderParentKeys((prev) => {
      if (prev.has(parentKey)) return prev;
      const next = new Set(prev);
      next.add(parentKey);
      return next;
    });
  };

  const handleUngroupedDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(PROJECT_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!isUngroupedDragOver) setIsUngroupedDragOver(true);
  };

  const handleUngroupedDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(PROJECT_DRAG_MIME)) return;
    event.preventDefault();
    setIsUngroupedDragOver(false);
    const projectKey = event.dataTransfer.getData(PROJECT_DRAG_MIME);
    if (projectKey) onMoveProjectToFolder(projectKey, null);
  };

  const renderProjectEntry = (
    entry: ProjectTreeEntry<EnvironmentThreadShell>,
    indented = false,
  ) => (
    <ProjectSidebarRow
      key={entry.projectKey}
      entry={entry}
      workspaceProject={
        projectByKey.get(`${entry.project.environmentId}:${entry.project.projectId}`) ?? null
      }
      isRouteActive={routeRowThreadKey === entry.projectKey}
      activeSplitSubagentId={activeSplitSubagentId}
      isExpanded={expandedProjectKeys.has(entry.projectKey)}
      isRenaming={renamingThreadKey === entry.projectKey}
      renamingTitle={renamingThreadKey === entry.projectKey ? renamingTitle : ""}
      collapsedNodeKeys={collapsedNodeKeys}
      expandedOlderParentKeys={expandedOlderParentKeys}
      onSelectProject={onSelectProject}
      onToggleExpand={toggleProjectExpanded}
      onContextMenu={onProjectContextMenu}
      onRenameTitleChange={onRenameTitleChange}
      onCommitRename={onCommitRename}
      onCancelRename={onCancelRename}
      onToggleNode={toggleNodeCollapsed}
      onShowOlder={showOlderForParent}
      onSelectSubagent={onSelectSubagent}
      indented={indented}
    />
  );

  const hasAnyProjectsOrFolders =
    projectFolders.length > 0 || ungroupedProjects.length > 0 || creatingProjectFolder;

  return (
    <section
      data-testid="sidebar-projects-section"
      aria-label={gt("Projects")}
      className="mb-2 flex flex-col gap-0.5"
    >
      <div className="flex h-7 items-center justify-between px-2">
        <span className="text-xs font-medium text-sidebar-muted-foreground">
          <T>Projects</T>
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label={gt("Add project folder")}
                  onClick={onStartCreateProjectFolder}
                />
              }
            >
              <FolderPlusIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup side="top">
              <T>Add project folder</T>
            </TooltipPopup>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label={gt("New project")}
                  onClick={onOpenNewProject}
                />
              }
            >
              <PlusIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup side="top">
              <T>New project</T>
            </TooltipPopup>
          </Tooltip>
        </div>
      </div>

      {creatingProjectFolder ? (
        <InlineNewFolderRow
          placeholder={gt("Project folder name…")}
          onCommit={onCommitCreateProjectFolder}
          onCancel={onCancelCreateProjectFolder}
        />
      ) : null}

      {projectFolders.map(({ group, items }) => {
        const collapsed = collapsedFolderIds.has(group.id);
        return (
          <div key={group.id} data-testid={`sidebar-project-folder-group-${group.id}`}>
            <CustomSidebarFolderHeader
              group={group}
              collapsed={collapsed}
              itemCount={items.length}
              isRenaming={renamingGroupId === group.id}
              acceptDragMime={PROJECT_DRAG_MIME}
              onToggle={toggleFolderCollapsed}
              onStartRename={onStartRenameFolder}
              onCommitRename={onCommitRenameFolder}
              onCancelRename={onCancelRenameFolder}
              onContextMenu={onFolderContextMenu}
              onDropThreadKey={onMoveProjectToFolder}
            />
            {!collapsed && items.length > 0 ? (
              <ul className="flex flex-col gap-px">{items.map((e) => renderProjectEntry(e, true))}</ul>
            ) : null}
          </div>
        );
      })}

      {ungroupedProjects.length > 0 || projectFolders.length > 0 ? (
        <div
          onDragOver={handleUngroupedDragOver}
          onDragLeave={() => setIsUngroupedDragOver(false)}
          onDrop={handleUngroupedDrop}
          className={cn(
            "rounded-md transition-colors",
            isUngroupedDragOver && "bg-primary/5 ring-1 ring-inset ring-primary/40",
          )}
        >
          {ungroupedProjects.length > 0 ? (
            <ul className="flex flex-col gap-px">
              {ungroupedProjects.map((entry) => renderProjectEntry(entry, false))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!hasAnyProjectsOrFolders ? (
        <p className="px-2 py-1 text-2xs text-sidebar-muted-foreground/70">
          <T>Create a project to coordinate sub-agents.</T>
        </p>
      ) : null}
    </section>
  );
}
