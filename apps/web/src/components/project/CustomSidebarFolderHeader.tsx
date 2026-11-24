import type { ContextMenuSource, SidebarGroup } from "@t3tools/contracts";
import { useGT } from "gt-react";
import { CheckIcon, ChevronDownIcon, FolderIcon, XIcon } from "lucide-react";
import { useState, type DragEvent, type KeyboardEvent } from "react";

import { cn } from "~/lib/utils";
import { contextMenuSourceOf } from "../../contextMenuSource";
import { Button } from "../ui/button";

export const PROJECT_DRAG_MIME = "application/x-t3-project-thread";
export const NORMAL_THREAD_DRAG_MIME = "application/x-t3-normal-thread";

export function InlineNewFolderRow({
  placeholder,
  onCommit,
  onCancel,
}: {
  readonly placeholder: string;
  readonly onCommit: (name: string) => void;
  readonly onCancel: () => void;
}) {
  const gt = useGT();
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      onCancel();
      return;
    }
    onCommit(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      data-testid="inline-new-folder-row"
      className="flex h-8 items-center gap-1.5 rounded-(--control-radius) bg-sidebar-row-hover/60 px-2"
    >
      <FolderIcon aria-hidden className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
      <input
        type="text"
        autoFocus
        value={name}
        aria-label={gt("Folder name")}
        placeholder={placeholder}
        onChange={(event) => setName(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        className="min-w-0 flex-1 bg-transparent text-xs text-sidebar-foreground placeholder:text-sidebar-muted-foreground/70 outline-none"
      />
      <Button
        size="icon-micro"
        variant="ghost-muted"
        aria-label={gt("Create folder")}
        onClick={submit}
      >
        <CheckIcon className="size-3" />
      </Button>
      <Button
        size="icon-micro"
        variant="ghost-muted"
        aria-label={gt("Cancel")}
        onClick={onCancel}
      >
        <XIcon className="size-3" />
      </Button>
    </div>
  );
}

export function CustomSidebarFolderHeader({
  group,
  collapsed,
  itemCount,
  isRenaming,
  acceptDragMime,
  onToggle,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onContextMenu,
  onDropThreadKey,
}: {
  readonly group: SidebarGroup;
  readonly collapsed: boolean;
  readonly itemCount: number;
  readonly isRenaming: boolean;
  readonly acceptDragMime: string;
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
}) {
  const gt = useGT();
  const [draftName, setDraftName] = useState(group.name);
  const [wasRenaming, setWasRenaming] = useState(isRenaming);
  const [isDragOver, setIsDragOver] = useState(false);

  if (isRenaming && !wasRenaming) {
    setWasRenaming(true);
    setDraftName(group.name);
  } else if (!isRenaming && wasRenaming) {
    setWasRenaming(false);
  }

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes(acceptDragMime)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    if (isDragOver) setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes(acceptDragMime)) return;
    event.preventDefault();
    setIsDragOver(false);
    const threadKey = event.dataTransfer.getData(acceptDragMime);
    if (threadKey) onDropThreadKey(threadKey, group.id);
  };

  if (isRenaming) {
    const commit = () => {
      const trimmed = draftName.trim();
      if (trimmed.length === 0 || trimmed === group.name) {
        onCancelRename();
        return;
      }
      onCommitRename(group.id, trimmed);
    };
    return (
      <div
        data-testid={`custom-folder-header-${group.id}`}
        className="flex h-7 items-center gap-1.5 rounded-(--control-radius) bg-sidebar-row-hover/60 px-2"
      >
        <FolderIcon aria-hidden className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
        <input
          type="text"
          autoFocus
          value={draftName}
          aria-label={gt("Rename folder")}
          onChange={(event) => setDraftName(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancelRename();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-sidebar-foreground outline-none"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid={`custom-folder-header-${group.id}`}
      data-custom-folder-scope={group.scope}
      aria-expanded={!collapsed}
      onClick={() => onToggle(group.id)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onStartRename(group);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(group, { x: event.clientX, y: event.clientY }, contextMenuSourceOf(event));
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex h-7 w-full cursor-pointer items-center gap-2 rounded-(--control-radius) px-2 text-left text-xs font-medium text-sidebar-muted-foreground outline-none transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        isDragOver && "bg-primary/10 text-sidebar-foreground ring-1 ring-inset ring-primary/60",
      )}
    >
      <FolderIcon aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{group.name}</span>
      {collapsed && itemCount > 0 ? (
        <span className="shrink-0 text-2xs tabular-nums text-sidebar-muted-foreground">
          {itemCount}
        </span>
      ) : null}
      <ChevronDownIcon
        aria-hidden
        className={cn("size-3 shrink-0 transition-transform", collapsed && "-rotate-90")}
      />
    </button>
  );
}
