import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { resolveThreadActivityTimestamp } from "@t3tools/client-runtime/state/thread-sort";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { msg, useGT, useMessages } from "gt-react";
import {
  ChevronDownIcon,
  CircleAlertIcon,
  MessageCircleQuestionIcon,
  ShieldQuestionIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";
import type { MessageResolver } from "../../i18n/messages";
import { useNowMinute } from "../../hooks/useNowMinute";
import { formatRelativeTime } from "../../timestampFormat";
import { useUiStateStore } from "../../uiStateStore";
import {
  hasUnseenCompletion,
  resolveSidebarRowStatus,
  resolveThreadLastVisitedAt,
} from "../Sidebar.logic";
import type { ProjectSubagentNode } from "./projectSidebar.logic";

function compactRelativeTime(timestamp: string, nowMs: number, resolve: MessageResolver): string {
  const parts = formatRelativeTime(timestamp, nowMs, resolve);
  if (parts === null) return "";
  return parts.suffix === null ? resolve(msg("now", { $context: "relative time" })) : parts.value;
}

function SubagentRelativeTime({ timestamp }: { readonly timestamp: string | null }) {
  const nowMinute = useNowMinute();
  const messages = useMessages();
  if (timestamp === null) return null;
  return (
    <span className="shrink-0 text-2xs tabular-nums text-sidebar-muted-foreground">
      {compactRelativeTime(timestamp, Date.parse(`${nowMinute}:00.000Z`), messages)}
    </span>
  );
}

function SubagentTrailingIndicator({
  thread,
  lastVisitedAt,
}: {
  readonly thread: EnvironmentThreadShell;
  readonly lastVisitedAt: string | undefined;
}) {
  const gt = useGT();
  const status = resolveSidebarRowStatus({ ...thread, lastVisitedAt });
  const isUnread = status === "ready" && hasUnseenCompletion({ ...thread, lastVisitedAt });

  if (status === "approval") {
    return (
      <ShieldQuestionIcon
        aria-label={gt("Approval", { $context: "thread status: needs approval" })}
        className="size-3 shrink-0 text-warning-foreground"
      />
    );
  }
  if (status === "input") {
    return (
      <MessageCircleQuestionIcon
        aria-label={gt("Input", { $context: "thread status: needs user input" })}
        className="size-3 shrink-0 text-indigo-600 dark:text-indigo-300"
      />
    );
  }
  if (status === "request" || status === "limited") {
    return (
      <CircleAlertIcon
        aria-label={
          status === "limited"
            ? gt("Limited", { $context: "thread status: usage limited" })
            : gt("Request", { $context: "thread status: guest request" })
        }
        className="size-3 shrink-0 text-warning-foreground"
      />
    );
  }
  if (status === "failed") {
    return (
      <span
        role="img"
        aria-label={gt("Failed", { $context: "thread status" })}
        className="size-1.5 shrink-0 rounded-full bg-error"
      />
    );
  }
  if (
    status === "working" ||
    status === "preparing" ||
    (status === "waiting" && thread.runtime?.status === "running")
  ) {
    return (
      <span
        role="img"
        aria-label={gt("Working", { $context: "thread status" })}
        className="size-1.5 shrink-0 rounded-full bg-info"
      />
    );
  }
  if (isUnread) {
    return (
      <span
        role="img"
        aria-label={gt("Done", { $context: "thread status" })}
        className="size-1.5 shrink-0 rounded-full bg-success"
      />
    );
  }
  return <SubagentRelativeTime timestamp={resolveThreadActivityTimestamp(thread)} />;
}

export function ProjectSubagentTree({
  projectRef,
  parentKey,
  visibleNodes,
  allNodes,
  hiddenCompletedCount,
  depth,
  activeSplitSubagentId,
  collapsedNodeKeys,
  expandedOlderParentKeys,
  onToggleNode,
  onShowOlder,
  onSelectSubagent,
}: {
  readonly projectRef: ScopedThreadRef;
  readonly parentKey: string;
  readonly visibleNodes: readonly ProjectSubagentNode<EnvironmentThreadShell>[];
  readonly allNodes: readonly ProjectSubagentNode<EnvironmentThreadShell>[];
  readonly hiddenCompletedCount: number;
  readonly depth: number;
  readonly activeSplitSubagentId: string | null;
  readonly collapsedNodeKeys: ReadonlySet<string>;
  readonly expandedOlderParentKeys: ReadonlySet<string>;
  readonly onToggleNode: (nodeKey: string) => void;
  readonly onShowOlder: (parentKey: string) => void;
  readonly onSelectSubagent: (
    projectRef: ScopedThreadRef,
    subagent: EnvironmentThreadShell,
  ) => void;
}) {
  const gt = useGT();
  const localLastVisitedAtById = useUiStateStore((state) => state.threadLastVisitedAtById);
  const showAll = expandedOlderParentKeys.has(parentKey);
  const renderedNodes = showAll ? allNodes : visibleNodes;
  const remainingHidden = showAll ? 0 : hiddenCompletedCount;
  const indentPx = 22 + Math.min(depth, 4) * 14;

  return (
    <ul className="flex flex-col gap-px" role="group">
      {renderedNodes.map((node) => {
        const hasChildren = node.allChildren.length > 0;
        const isExpanded = hasChildren && !collapsedNodeKeys.has(node.threadKey);
        const isActive = activeSplitSubagentId === node.thread.id;
        const lastVisitedAt = resolveThreadLastVisitedAt(
          node.thread.lastVisitedAt,
          localLastVisitedAtById[
            scopedThreadKey(scopeThreadRef(node.thread.environmentId, node.thread.id))
          ],
        );

        return (
          <li key={node.threadKey} className="list-none">
            <div
              data-testid="sidebar-subagent-row"
              data-subagent-id={node.thread.id}
              data-subagent-depth={depth}
              className={cn(
                "group/subagent-row flex h-7 w-full items-center gap-1 rounded-md pr-2 text-xs transition-colors",
                isActive
                  ? "bg-sidebar-row-active text-sidebar-foreground"
                  : "text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground",
              )}
              style={{ paddingLeft: `${indentPx}px` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  data-testid="subagent-expand-toggle"
                  aria-expanded={isExpanded}
                  aria-label={
                    isExpanded
                      ? gt("Collapse nested sub-agents")
                      : gt("Expand nested sub-agents")
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleNode(node.threadKey);
                  }}
                  className="inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-sidebar-muted-foreground hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <ChevronDownIcon
                    aria-hidden
                    className={cn(
                      "size-3 transition-transform",
                      !isExpanded && "-rotate-90",
                    )}
                  />
                </button>
              ) : (
                <span aria-hidden className="size-4 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelectSubagent(projectRef, node.thread)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none focus-visible:underline"
              >
                <span className="min-w-0 flex-1 truncate">{node.thread.title}</span>
                <SubagentTrailingIndicator thread={node.thread} lastVisitedAt={lastVisitedAt} />
              </button>
            </div>
            {hasChildren && isExpanded ? (
              <ProjectSubagentTree
                projectRef={projectRef}
                parentKey={node.threadKey}
                visibleNodes={node.children}
                allNodes={node.allChildren}
                hiddenCompletedCount={node.hiddenCompletedCount}
                depth={depth + 1}
                activeSplitSubagentId={activeSplitSubagentId}
                collapsedNodeKeys={collapsedNodeKeys}
                expandedOlderParentKeys={expandedOlderParentKeys}
                onToggleNode={onToggleNode}
                onShowOlder={onShowOlder}
                onSelectSubagent={onSelectSubagent}
              />
            ) : null}
          </li>
        );
      })}
      {remainingHidden > 0 ? (
        <li className="list-none">
          <button
            type="button"
            data-testid="project-show-older"
            onClick={() => onShowOlder(parentKey)}
            className="flex h-6 w-full cursor-pointer items-center gap-1 rounded-md pr-2 text-left text-2xs text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            style={{ paddingLeft: `${indentPx + 20}px` }}
          >
            {gt("Show {count} older", { count: remainingHidden })}
          </button>
        </li>
      ) : null}
    </ul>
  );
}
