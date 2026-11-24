import { useDroppable } from "@dnd-kit/core";
import type { ContextMenuSource, SidebarGroup } from "@t3tools/contracts";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { CustomSidebarFolderHeader, NORMAL_THREAD_DRAG_MIME } from "./CustomSidebarFolderHeader";

export const THREAD_FOLDER_DROP_PREFIX = "sidebar-thread-folder:";

export function threadFolderDropId(groupId: string): string {
  return `${THREAD_FOLDER_DROP_PREFIX}${groupId}`;
}

export function CustomThreadFolderGroup({
  group,
  collapsed,
  itemCount,
  isRenaming,
  onToggle,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onContextMenu,
  onDropThreadKey,
  children,
}: {
  readonly group: SidebarGroup;
  readonly collapsed: boolean;
  readonly itemCount: number;
  readonly isRenaming: boolean;
  readonly onToggle: (groupId: string) => void;
  readonly onStartRename: (group: SidebarGroup) => void;
  readonly onCommitRename: (groupId: string, nextName: string) => void;
  readonly onCancelRename: () => void;
  readonly onContextMenu: (
    group: SidebarGroup,
    position: { x: number; y: number },
    source: ContextMenuSource,
  ) => void;
  readonly onDropThreadKey: (threadKey: string, groupId: string) => void;
  readonly children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: threadFolderDropId(group.id) });

  return (
    <li
      ref={setNodeRef}
      data-testid={`sidebar-thread-folder-group-${group.id}`}
      className={cn(
        "list-none rounded-md transition-colors",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/60",
      )}
    >
      <CustomSidebarFolderHeader
        group={group}
        collapsed={collapsed}
        itemCount={itemCount}
        isRenaming={isRenaming}
        acceptDragMime={NORMAL_THREAD_DRAG_MIME}
        onToggle={onToggle}
        onStartRename={onStartRename}
        onCommitRename={onCommitRename}
        onCancelRename={onCancelRename}
        onContextMenu={onContextMenu}
        onDropThreadKey={onDropThreadKey}
      />
      {!collapsed && itemCount > 0 ? <ul className="flex flex-col gap-px">{children}</ul> : null}
    </li>
  );
}
