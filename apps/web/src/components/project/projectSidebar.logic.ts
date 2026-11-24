import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { hasUnseenRunFailure } from "@t3tools/client-runtime/state/thread-settled";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { SidebarGroup } from "@t3tools/contracts";

import {
  firstValidTimestampMs,
  hasUnseenCompletion,
  resolveSidebarRowStatus,
  resolveThreadLastVisitedAt,
} from "../Sidebar.logic";

export const PROJECT_SUBAGENT_COMPLETED_LIMIT = 5;
export const PROJECT_AVATAR_MAX_DATA_URL_LENGTH = 131072;
export const PROJECT_AVATAR_DATA_URL_PATTERN =
  /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/;

export type ProjectRollupStatus = "attention" | "failed" | "working" | "unread" | null;

const LIVE_RUNTIME_STATUSES = new Set(["running", "starting", "preparing", "queued", "waiting"]);

export type ProjectSidebarThread = Pick<
  EnvironmentThreadShell,
  | "id"
  | "environmentId"
  | "projectId"
  | "title"
  | "createdAt"
  | "updatedAt"
  | "archivedAt"
  | "deletedAt"
  | "lineage"
  | "orchestratorProject"
  | "sidebarFolderId"
  | "runtime"
  | "latestRun"
  | "lastVisitedAt"
  | "hasPendingApprovals"
  | "hasPendingUserInput"
  | "pendingSubagentRequest"
  | "pendingGuestMessageCount"
  | "hasActionableProposedPlan"
  | "interactionMode"
  | "blockedOnThreadWait"
  | "pendingBackgroundTasks"
>;

export interface ProjectSubagentNode<TThread extends ProjectSidebarThread> {
  readonly thread: TThread;
  readonly threadKey: string;
  readonly isLive: boolean;
  readonly urgencyRank: number;
  readonly children: readonly ProjectSubagentNode<TThread>[];
  readonly allChildren: readonly ProjectSubagentNode<TThread>[];
  readonly hiddenCompletedCount: number;
}

export interface ProjectTreeEntry<TThread extends ProjectSidebarThread> {
  readonly project: TThread;
  readonly projectKey: string;
  readonly children: readonly ProjectSubagentNode<TThread>[];
  readonly allChildren: readonly ProjectSubagentNode<TThread>[];
  readonly hiddenCompletedCount: number;
  readonly totalDescendantCount: number;
  readonly activeCount: number;
  readonly rollupStatus: ProjectRollupStatus;
}

export interface CustomFolderBucket<TItem> {
  readonly group: SidebarGroup;
  readonly items: readonly TItem[];
}

export interface PartitionedProjectSidebar<TThread extends ProjectSidebarThread> {
  readonly projects: readonly ProjectTreeEntry<TThread>[];
  readonly projectFolders: readonly CustomFolderBucket<ProjectTreeEntry<TThread>>[];
  readonly ungroupedProjects: readonly ProjectTreeEntry<TThread>[];
  /** Exact keys of every Project and every descendant sub-agent so Folders shows zero duplicates. */
  readonly excludedThreadKeys: ReadonlySet<string>;
}

export function isValidProjectAvatarDataUrl(dataUrl: string): boolean {
  return (
    dataUrl.length <= PROJECT_AVATAR_MAX_DATA_URL_LENGTH &&
    PROJECT_AVATAR_DATA_URL_PATTERN.test(dataUrl)
  );
}

export function projectSidebarThreadKey(
  thread: Pick<ProjectSidebarThread, "environmentId" | "id">,
): string {
  return scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
}

export function isProjectThread(
  thread: Pick<ProjectSidebarThread, "archivedAt" | "deletedAt" | "orchestratorProject" | "lineage">,
): boolean {
  return (
    thread.archivedAt === null &&
    thread.deletedAt === null &&
    thread.orchestratorProject != null &&
    thread.lineage.parentThreadId === null
  );
}

function withResolvedLastVisited<TThread extends ProjectSidebarThread>(
  thread: TThread,
  localLastVisitedAtById?: Readonly<Record<string, string>>,
): TThread {
  if (!localLastVisitedAtById) return thread;
  const resolved = resolveThreadLastVisitedAt(
    thread.lastVisitedAt,
    localLastVisitedAtById[projectSidebarThreadKey(thread)],
  );
  if (resolved === (thread.lastVisitedAt ?? undefined)) return thread;
  return { ...thread, lastVisitedAt: resolved ?? null };
}

export function isThreadAttention(thread: ProjectSidebarThread): boolean {
  const status = resolveSidebarRowStatus(thread);
  return (
    status === "input" ||
    status === "approval" ||
    status === "request" ||
    status === "limited"
  );
}

export function isThreadLiveOrAttention(thread: ProjectSidebarThread): boolean {
  if (isThreadAttention(thread)) return true;
  if (thread.runtime !== null && LIVE_RUNTIME_STATUSES.has(thread.runtime.status)) return true;
  const status = resolveSidebarRowStatus(thread);
  return status === "failed";
}

export function subagentUrgencyRank(thread: ProjectSidebarThread): number {
  if (isThreadAttention(thread)) return 0;
  const status = resolveSidebarRowStatus(thread);
  if (status === "failed") return 1;
  if (thread.runtime !== null && LIVE_RUNTIME_STATUSES.has(thread.runtime.status)) return 2;
  if (status === "ready" && hasUnseenCompletion(thread)) return 3;
  return 4;
}

/** Priority: attention > failed > working > unread > null. */
export function computeProjectRollupStatus(
  threads: readonly ProjectSidebarThread[],
): ProjectRollupStatus {
  let hasFailed = false;
  let hasWorking = false;
  let hasUnread = false;

  for (const thread of threads) {
    const status = resolveSidebarRowStatus(thread);
    if (
      status === "input" ||
      status === "approval" ||
      status === "request" ||
      status === "limited"
    ) {
      return "attention";
    }
    if (status === "failed" || hasUnseenRunFailure(thread)) {
      hasFailed = true;
    } else if (
      status === "working" ||
      status === "preparing" ||
      (thread.runtime !== null && LIVE_RUNTIME_STATUSES.has(thread.runtime.status))
    ) {
      hasWorking = true;
    } else if (status === "ready" && hasUnseenCompletion(thread)) {
      hasUnread = true;
    }
  }

  if (hasFailed) return "failed";
  if (hasWorking) return "working";
  if (hasUnread) return "unread";
  return null;
}

function compareSubagentNodes<TThread extends ProjectSidebarThread>(
  left: ProjectSubagentNode<TThread>,
  right: ProjectSubagentNode<TThread>,
): number {
  if (left.urgencyRank !== right.urgencyRank) return left.urgencyRank - right.urgencyRank;
  const leftTime = firstValidTimestampMs(left.thread.updatedAt, left.thread.createdAt);
  const rightTime = firstValidTimestampMs(right.thread.updatedAt, right.thread.createdAt);
  if (leftTime !== rightTime) return rightTime - leftTime;
  return left.thread.id.localeCompare(right.thread.id);
}

function capVisibleChildren<TThread extends ProjectSidebarThread>(
  sorted: readonly ProjectSubagentNode<TThread>[],
  completedLimit: number,
): {
  readonly visible: readonly ProjectSubagentNode<TThread>[];
  readonly hiddenCompletedCount: number;
} {
  const visible: ProjectSubagentNode<TThread>[] = [];
  let completedSeen = 0;
  for (const node of sorted) {
    if (node.isLive) {
      visible.push(node);
      continue;
    }
    if (completedSeen < completedLimit) {
      visible.push(node);
      completedSeen += 1;
    }
  }
  return {
    visible,
    hiddenCompletedCount: Math.max(0, sorted.length - visible.length),
  };
}

function compareProjects<TThread extends ProjectSidebarThread>(
  left: TThread,
  right: TThread,
): number {
  const leftOrder = left.orchestratorProject?.orderKey ?? null;
  const rightOrder = right.orchestratorProject?.orderKey ?? null;
  if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) {
    return leftOrder < rightOrder ? -1 : 1;
  }
  if (leftOrder !== null && rightOrder === null) return -1;
  if (leftOrder === null && rightOrder !== null) return 1;
  const leftTime = firstValidTimestampMs(left.updatedAt, left.createdAt);
  const rightTime = firstValidTimestampMs(right.updatedAt, right.createdAt);
  if (leftTime !== rightTime) return rightTime - leftTime;
  return left.id.localeCompare(right.id);
}

export function sortSidebarGroupsForScope(
  sidebarGroups: readonly SidebarGroup[],
  scope: SidebarGroup["scope"],
): SidebarGroup[] {
  return sidebarGroups
    .filter((group) => group.scope === scope)
    .map((group, index) => ({ group, index }))
    .toSorted((left, right) => {
      const leftOrder = left.group.orderKey ?? null;
      const rightOrder = right.group.orderKey ?? null;
      if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) {
        return leftOrder < rightOrder ? -1 : 1;
      }
      if (leftOrder !== null && rightOrder === null) return -1;
      if (leftOrder === null && rightOrder !== null) return 1;
      return left.index - right.index;
    })
    .map(({ group }) => group);
}

export function partitionProjectSidebar<TThread extends ProjectSidebarThread>(
  threads: readonly TThread[],
  sidebarGroups: readonly SidebarGroup[],
  options?: {
    readonly localLastVisitedAtById?: Readonly<Record<string, string>>;
    readonly completedLimit?: number;
  },
): PartitionedProjectSidebar<TThread> {
  const completedLimit = options?.completedLimit ?? PROJECT_SUBAGENT_COMPLETED_LIMIT;
  const localVisits = options?.localLastVisitedAtById;

  const projectThreads = threads.filter(isProjectThread).toSorted(compareProjects);
  const projectKeySet = new Set(projectThreads.map(projectSidebarThreadKey));
  const excludedThreadKeys = new Set<string>(projectKeySet);

  const descendantsByRootKey = new Map<string, TThread[]>();
  for (const thread of threads) {
    if (thread.archivedAt !== null || thread.deletedAt !== null) continue;
    if (thread.lineage.relationshipToParent !== "subagent") continue;
    const rootKey = scopedThreadKey(
      scopeThreadRef(thread.environmentId, thread.lineage.rootThreadId),
    );
    if (!projectKeySet.has(rootKey)) continue;
    const key = projectSidebarThreadKey(thread);
    if (key === rootKey) continue;
    excludedThreadKeys.add(key);
    const list = descendantsByRootKey.get(rootKey);
    if (list) list.push(thread);
    else descendantsByRootKey.set(rootKey, [thread]);
  }

  const projectEntries: ProjectTreeEntry<TThread>[] = projectThreads.map((project) => {
    const projectKey = projectSidebarThreadKey(project);
    const descendants = descendantsByRootKey.get(projectKey) ?? [];
    const descendantKeySet = new Set(descendants.map(projectSidebarThreadKey));

    const childrenByParentKey = new Map<string, TThread[]>();
    for (const descendant of descendants) {
      const rawParentId = descendant.lineage.parentThreadId;
      const rawParentKey =
        rawParentId === null
          ? projectKey
          : scopedThreadKey(scopeThreadRef(descendant.environmentId, rawParentId));
      // Attach orphaned descendants directly under the Project root if an intermediate parent is gone.
      const parentKey =
        rawParentKey === projectKey || descendantKeySet.has(rawParentKey)
          ? rawParentKey
          : projectKey;
      const siblings = childrenByParentKey.get(parentKey);
      if (siblings) siblings.push(descendant);
      else childrenByParentKey.set(parentKey, [descendant]);
    }

    const visited = new Set<string>([projectKey]);
    const buildNodes = (parentKey: string): readonly ProjectSubagentNode<TThread>[] => {
      const rawChildren = childrenByParentKey.get(parentKey) ?? [];
      const nodes: ProjectSubagentNode<TThread>[] = [];
      for (const child of rawChildren) {
        const childKey = projectSidebarThreadKey(child);
        if (visited.has(childKey)) continue;
        visited.add(childKey);
        const resolvedChild = withResolvedLastVisited(child, localVisits);
        const allGrandchildren = buildNodes(childKey);
        const { visible, hiddenCompletedCount } = capVisibleChildren(
          allGrandchildren,
          completedLimit,
        );
        nodes.push({
          thread: child,
          threadKey: childKey,
          isLive: isThreadLiveOrAttention(resolvedChild),
          urgencyRank: subagentUrgencyRank(resolvedChild),
          children: visible,
          allChildren: allGrandchildren,
          hiddenCompletedCount,
        });
      }
      return nodes.toSorted(compareSubagentNodes);
    };

    const allRootChildren = buildNodes(projectKey);
    const { visible, hiddenCompletedCount } = capVisibleChildren(allRootChildren, completedLimit);

    const familyResolved = [project, ...descendants].map((entry) =>
      withResolvedLastVisited(entry, localVisits),
    );
    const activeCount = familyResolved.filter(isThreadLiveOrAttention).length;
    const rollupStatus = computeProjectRollupStatus(familyResolved);

    return {
      project,
      projectKey,
      children: visible,
      allChildren: allRootChildren,
      hiddenCompletedCount,
      totalDescendantCount: descendants.length,
      activeCount,
      rollupStatus,
    };
  });

  const sortedProjectGroups = sortSidebarGroupsForScope(sidebarGroups, "projects");
  const bucketsByGroupId = new Map<string, ProjectTreeEntry<TThread>[]>(
    sortedProjectGroups.map((group) => [group.id, []]),
  );
  const ungroupedProjects: ProjectTreeEntry<TThread>[] = [];

  for (const entry of projectEntries) {
    const folderId = entry.project.sidebarFolderId;
    const bucket = folderId ? bucketsByGroupId.get(folderId) : undefined;
    if (bucket) bucket.push(entry);
    else ungroupedProjects.push(entry);
  }

  return {
    projects: projectEntries,
    projectFolders: sortedProjectGroups.map((group) => ({
      group,
      items: bucketsByGroupId.get(group.id) ?? [],
    })),
    ungroupedProjects,
    excludedThreadKeys,
  };
}

export function partitionNormalThreadsByCustomFolders<
  TThread extends Pick<EnvironmentThreadShell, "sidebarFolderId">,
>(
  threads: readonly TThread[],
  sidebarGroups: readonly SidebarGroup[],
): {
  readonly threadFolders: readonly CustomFolderBucket<TThread>[];
  readonly ungroupedThreads: readonly TThread[];
} {
  const sortedThreadGroups = sortSidebarGroupsForScope(sidebarGroups, "threads");
  if (sortedThreadGroups.length === 0) {
    return { threadFolders: [], ungroupedThreads: threads };
  }
  const bucketsByGroupId = new Map<string, TThread[]>(
    sortedThreadGroups.map((group) => [group.id, []]),
  );
  const ungroupedThreads: TThread[] = [];
  for (const thread of threads) {
    const bucket = thread.sidebarFolderId ? bucketsByGroupId.get(thread.sidebarFolderId) : undefined;
    if (bucket) bucket.push(thread);
    else ungroupedThreads.push(thread);
  }
  return {
    threadFolders: sortedThreadGroups.map((group) => ({
      group,
      items: bucketsByGroupId.get(group.id) ?? [],
    })),
    ungroupedThreads,
  };
}

export function createSidebarGroupList(
  groups: readonly SidebarGroup[],
  input: { readonly id: string; readonly name: string; readonly scope: SidebarGroup["scope"] },
): SidebarGroup[] | null {
  const name = input.name.trim();
  const id = input.id.trim();
  if (name.length === 0 || id.length === 0) return null;
  if (groups.some((group) => group.id === id)) return null;
  return [...groups, { id, name, scope: input.scope }];
}

export function renameSidebarGroupList(
  groups: readonly SidebarGroup[],
  groupId: string,
  nextName: string,
): SidebarGroup[] | null {
  const trimmed = nextName.trim();
  if (trimmed.length === 0) return null;
  let changed = false;
  const next = groups.map((group) => {
    if (group.id !== groupId) return group;
    if (group.name === trimmed) return group;
    changed = true;
    return { ...group, name: trimmed };
  });
  return changed ? next : null;
}

export function deleteSidebarGroupList(
  groups: readonly SidebarGroup[],
  groupId: string,
): SidebarGroup[] {
  return groups.filter((group) => group.id !== groupId);
}
