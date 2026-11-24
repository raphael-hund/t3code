import type { ContextMenuItem, SidebarGroup } from "@t3tools/contracts";
import { msg } from "gt-react";

import { m, type MessageResolver } from "../../i18n/messages";

export type ProjectActionMenuId =
  | "edit-project"
  | "move-to-folder"
  | "move-to-folder:none"
  | `move-to-folder:${string}`
  | "demote-to-thread"
  | "rename"
  | "settle"
  | "unsettle"
  | "archive"
  | "delete";

export type CustomFolderActionMenuId = "rename-folder" | "delete-folder";

export function buildProjectActionMenuItems(
  options: {
    readonly canOperate: boolean;
    readonly currentFolderId: string | null;
    readonly projectFolders: readonly SidebarGroup[];
    readonly isSettled: boolean;
    readonly supportsSettlement: boolean;
    readonly isRunning: boolean;
  },
  resolve: MessageResolver = m,
): ReadonlyArray<ContextMenuItem<ProjectActionMenuId>> {
  const showMoveSubmenu = options.projectFolders.length > 0 || options.currentFolderId !== null;
  const items: Array<ContextMenuItem<ProjectActionMenuId>> = [
    {
      id: "edit-project",
      label: resolve(msg("Edit project…")),
      icon: "pencil",
    },
    ...(showMoveSubmenu
      ? [
          {
            id: "move-to-folder" as const,
            label: resolve(msg("Move to folder…")),
            icon: "folder",
            children: [
              ...options.projectFolders.map((folder) => ({
                id: `move-to-folder:${folder.id}` as const,
                label: folder.name,
                checked: options.currentFolderId === folder.id,
              })),
              {
                id: "move-to-folder:none" as const,
                label: resolve(msg("No folder")),
                checked: options.currentFolderId === null,
                separatorBefore: options.projectFolders.length > 0,
              },
            ],
          },
        ]
      : []),
    {
      id: "demote-to-thread",
      label: resolve(msg("Demote to normal thread")),
      icon: "arrow-down-left",
    },
    {
      id: "rename",
      label: resolve(msg("Rename")),
      icon: "pencil",
      separatorBefore: true,
    },
    ...(options.supportsSettlement
      ? [
          options.isSettled
            ? {
                id: "unsettle" as const,
                label: resolve(msg("Un-settle thread")),
                icon: "circle-check",
              }
            : {
                id: "settle" as const,
                label: resolve(msg("Settle thread")),
                icon: "circle-check",
              },
        ]
      : []),
    {
      id: "archive",
      label: resolve(msg("Archive thread")),
      icon: "archive",
      disabled: options.isRunning,
      separatorBefore: true,
    },
    {
      id: "delete",
      label: resolve(msg("Delete", { $context: "verb, delete the thread" })),
      destructive: true,
      icon: "trash",
    },
  ];

  if (options.canOperate) return items;
  return items.map((item) => ({
    ...item,
    disabled: true,
    ...(item.children
      ? { children: item.children.map((child) => ({ ...child, disabled: true })) }
      : {}),
  }));
}

export function buildCustomFolderActionMenuItems(
  options: { readonly canEdit: boolean },
  resolve: MessageResolver = m,
): ReadonlyArray<ContextMenuItem<CustomFolderActionMenuId>> {
  return [
    {
      id: "rename-folder",
      label: resolve(msg("Rename folder")),
      icon: "pencil",
      disabled: !options.canEdit,
    },
    {
      id: "delete-folder",
      label: resolve(msg("Delete folder")),
      icon: "trash",
      destructive: true,
      disabled: !options.canEdit,
    },
  ];
}
