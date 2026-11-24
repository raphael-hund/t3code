import { thrownErrorMessage } from "@t3tools/client-runtime/errors";
import {
  scopeProjectRef,
  scopedProjectKey,
  scopeThreadRef,
} from "@t3tools/client-runtime/environment";
import type { EnvironmentServerConfig } from "@t3tools/client-runtime/connection";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import {
  DEFAULT_SERVER_SETTINGS,
  type EnvironmentId,
  type ModelSelection,
  type OrchestratorProjectAvatar,
  type OrchestratorProjectConfig,
  ProviderInstanceId,
  type ScopedThreadRef,
  type SidebarGroup,
} from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { resolveNewThreadModelSelection } from "@t3tools/shared/usageLimits";
import { T, useGT } from "gt-react";
import { useState, type FormEvent } from "react";

import { useScratchProject } from "../../hooks/useScratchProject";
import { m } from "../../i18n/messages";
import { newThreadId } from "../../lib/utils";
import { resolveProjectDefaultProviderModelSelection } from "../../providerInstances";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { ProjectAvatarPicker } from "./ProjectAvatarPicker";

const NO_FOLDER_VALUE = "__none__";

export type ProjectConfigDialogState =
  | { readonly mode: "create"; readonly defaultWorkspaceKey?: string | null }
  | { readonly mode: "edit"; readonly project: EnvironmentThreadShell };

function resolveModelSelectionForProject(input: {
  readonly serverConfig: EnvironmentServerConfig | undefined;
  readonly project: EnvironmentProject;
}): { readonly modelSelection: ModelSelection; readonly runtimeMode: "full-access" | "approval-required" } {
  const settings = input.serverConfig?.settings ?? DEFAULT_SERVER_SETTINGS;
  const providers = input.serverConfig?.providers ?? [];
  const projectSettings = resolveProjectSettings(settings, input.project.id, input.project);
  const configuredDefault =
    projectSettings.settings.defaultModelSelection ??
    resolveProjectDefaultProviderModelSelection(providers, settings, input.project.id);
  const resolved = resolveNewThreadModelSelection({
    defaultSelection: configuredDefault,
    fallbackSelection: settings.fallbackModelSelection ?? null,
    providers,
    settings,
    projectId: input.project.id,
    now: Date.now(),
  });
  const modelSelection: ModelSelection = resolved.selection ?? {
    instanceId: ProviderInstanceId.make("codex"),
    model: "gpt-5.4",
  };
  return {
    modelSelection,
    runtimeMode: projectSettings.settings.defaultRuntimeMode,
  };
}

export function ProjectConfigDialog({
  state,
  onOpenChange,
  workspaceProjects,
  projectFolders,
  serverConfigs,
  onCreated,
}: {
  readonly state: ProjectConfigDialogState | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly workspaceProjects: readonly EnvironmentProject[];
  readonly projectFolders: readonly SidebarGroup[];
  readonly serverConfigs: ReadonlyMap<EnvironmentId, EnvironmentServerConfig>;
  readonly onCreated: (threadRef: ScopedThreadRef) => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogPopup className="w-full sm:w-[32rem]">
        {state !== null ? (
          <ProjectConfigDialogBody
            state={state}
            workspaceProjects={workspaceProjects}
            projectFolders={projectFolders}
            serverConfigs={serverConfigs}
            onClose={() => onOpenChange(false)}
            onCreated={onCreated}
          />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}

function ProjectConfigDialogBody({
  state,
  workspaceProjects,
  projectFolders,
  serverConfigs,
  onClose,
  onCreated,
}: {
  readonly state: ProjectConfigDialogState;
  readonly workspaceProjects: readonly EnvironmentProject[];
  readonly projectFolders: readonly SidebarGroup[];
  readonly serverConfigs: ReadonlyMap<EnvironmentId, EnvironmentServerConfig>;
  readonly onClose: () => void;
  readonly onCreated: (threadRef: ScopedThreadRef) => void;
}) {
  const gt = useGT();
  const createThread = useOrchestrationCommand(threadEnvironment.create, { reportFailure: false });
  const updateThreadMetadata = useOrchestrationCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const { scratchEnvironmentId, openScratchProject } = useScratchProject();

  const availableWorkspaces = workspaceProjects.filter((project) => project.archivedAt == null);
  const scratchEnvId = scratchEnvironmentId(availableWorkspaces[0]?.environmentId ?? null);

  const initialWorkspaceKey =
    state.mode === "edit"
      ? scopedProjectKey(scopeProjectRef(state.project.environmentId, state.project.projectId))
      : state.defaultWorkspaceKey &&
          availableWorkspaces.some(
            (project) =>
              scopedProjectKey(scopeProjectRef(project.environmentId, project.id)) ===
              state.defaultWorkspaceKey,
          )
        ? state.defaultWorkspaceKey
        : availableWorkspaces[0]
          ? scopedProjectKey(
              scopeProjectRef(availableWorkspaces[0].environmentId, availableWorkspaces[0].id),
            )
          : NO_FOLDER_VALUE;

  const [title, setTitle] = useState(state.mode === "edit" ? state.project.title : "");
  const [goal, setGoal] = useState(
    state.mode === "edit" ? (state.project.orchestratorProject?.goal ?? "") : "",
  );
  const [avatar, setAvatar] = useState<OrchestratorProjectAvatar | null>(
    state.mode === "edit" ? (state.project.orchestratorProject?.avatar ?? null) : null,
  );
  const [workspaceKey, setWorkspaceKey] = useState<string>(initialWorkspaceKey);
  const [folderId, setFolderId] = useState<string>(
    state.mode === "edit" ? (state.project.sidebarFolderId ?? NO_FOLDER_VALUE) : NO_FOLDER_VALUE,
  );
  const [submitting, setSubmitting] = useState(false);

  const selectedWorkspace =
    workspaceKey === NO_FOLDER_VALUE
      ? null
      : (availableWorkspaces.find(
          (project) => scopedProjectKey(scopeProjectRef(project.environmentId, project.id)) === workspaceKey,
        ) ?? null);

  const workspaceLabel =
    selectedWorkspace !== null
      ? selectedWorkspace.title
      : workspaceKey === NO_FOLDER_VALUE
        ? gt("No folder")
        : gt("Select a folder");

  const selectedFolderName =
    folderId === NO_FOLDER_VALUE
      ? gt("No folder")
      : (projectFolders.find((group) => group.id === folderId)?.name ?? gt("No folder"));

  const canCreateWorkspace = selectedWorkspace !== null || scratchEnvId !== null;
  const trimmedTitle = title.trim();
  const canSubmit =
    !submitting &&
    trimmedTitle.length > 0 &&
    (state.mode === "edit" || canCreateWorkspace);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    const trimmedGoal = goal.trim();
    const resolvedFolderId =
      folderId !== NO_FOLDER_VALUE && projectFolders.some((group) => group.id === folderId)
        ? folderId
        : null;

    if (state.mode === "edit") {
      const existingConfig = state.project.orchestratorProject;
      const nextConfig: OrchestratorProjectConfig = {
        ...(existingConfig?.tasks !== undefined ? { tasks: existingConfig.tasks } : {}),
        ...(existingConfig?.orderKey !== undefined ? { orderKey: existingConfig.orderKey } : {}),
        goal: trimmedGoal.length > 0 ? trimmedGoal : null,
        avatar,
      };
      const result = await updateThreadMetadata({
        environmentId: state.project.environmentId,
        input: {
          threadId: state.project.id,
          title: trimmedTitle,
          orchestratorProject: nextConfig,
          sidebarFolderId: resolvedFolderId,
        },
      });
      setSubmitting(false);
      if (result._tag === "Failure") {
        if (!isAtomCommandInterrupted(result)) {
          const error = squashAtomCommandFailure(result);
          toastManager.add(
            stackedThreadToast({
              type: "error",
              title: gt("Failed to update project"),
              description: thrownErrorMessage(error, m) ?? gt("An error occurred."),
            }),
          );
        }
        return;
      }
      onClose();
      return;
    }

    let targetWorkspace = selectedWorkspace;
    if (targetWorkspace === null) {
      if (scratchEnvId === null) {
        setSubmitting(false);
        return;
      }
      targetWorkspace = await openScratchProject(
        scratchEnvId,
        gt("Could not create project without a folder"),
      );
      if (targetWorkspace === null) {
        setSubmitting(false);
        return;
      }
    }

    const threadId = newThreadId();
    const { modelSelection, runtimeMode } = resolveModelSelectionForProject({
      serverConfig: serverConfigs.get(targetWorkspace.environmentId),
      project: targetWorkspace,
    });

    const orchestratorProject: OrchestratorProjectConfig = {
      ...(trimmedGoal.length > 0 ? { goal: trimmedGoal } : {}),
      ...(avatar !== null ? { avatar } : {}),
    };

    const result = await createThread({
      environmentId: targetWorkspace.environmentId,
      input: {
        threadId,
        projectId: targetWorkspace.id,
        title: trimmedTitle,
        modelSelection,
        runtimeMode,
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        orchestratorProject,
        ...(resolvedFolderId !== null ? { sidebarFolderId: resolvedFolderId } : {}),
      },
    });
    setSubmitting(false);

    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) {
        const error = squashAtomCommandFailure(result);
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: gt("Failed to create project"),
            description: thrownErrorMessage(error, m) ?? gt("An error occurred."),
          }),
        );
      }
      return;
    }

    onClose();
    onCreated(scopeThreadRef(targetWorkspace.environmentId, threadId));
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>
          {state.mode === "create" ? <T>New project</T> : <T>Edit project</T>}
        </DialogTitle>
        <DialogDescription>
          {state.mode === "create" ? (
            <T>
              Create an orchestrator project with its own profile picture, goal, and sub-agents.
            </T>
          ) : (
            <T>Update this project&apos;s title, profile picture, folder, or goal.</T>
          )}
        </DialogDescription>
      </DialogHeader>

      <DialogPanel className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="project-config-title" className="text-sm font-medium">
            <T>Title</T>
          </label>
          <Input
            id="project-config-title"
            autoFocus
            value={title}
            placeholder={gt("e.g. Website Relaunch")}
            onChange={(event) => setTitle(event.currentTarget.value)}
            autoComplete="off"
          />
        </div>

        {state.mode === "create" ? (
          <div className="space-y-1.5">
            <label htmlFor="project-config-workspace" className="text-sm font-medium">
              <T>Workspace folder</T>
            </label>
            <Select
              value={workspaceKey}
              onValueChange={(nextValue) => {
                if (typeof nextValue === "string") setWorkspaceKey(nextValue);
              }}
            >
              <SelectTrigger id="project-config-workspace" aria-label={gt("Workspace folder")}>
                <SelectValue>{workspaceLabel}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {scratchEnvId !== null ? (
                  <SelectItem value={NO_FOLDER_VALUE}>
                    <T>No folder</T>
                  </SelectItem>
                ) : null}
                {availableWorkspaces.map((workspace) => {
                  const key = scopedProjectKey(
                    scopeProjectRef(workspace.environmentId, workspace.id),
                  );
                  return (
                    <SelectItem key={key} value={key}>
                      {workspace.title}
                    </SelectItem>
                  );
                })}
              </SelectPopup>
            </Select>
          </div>
        ) : null}

        {projectFolders.length > 0 ? (
          <div className="space-y-1.5">
            <label htmlFor="project-config-folder" className="text-sm font-medium">
              <T>Project folder</T>
            </label>
            <Select
              value={folderId}
              onValueChange={(nextValue) => {
                if (typeof nextValue === "string") setFolderId(nextValue);
              }}
            >
              <SelectTrigger id="project-config-folder" aria-label={gt("Project folder")}>
                <SelectValue>{selectedFolderName}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value={NO_FOLDER_VALUE}>
                  <T>No folder</T>
                </SelectItem>
                {projectFolders.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="project-config-goal" className="text-sm font-medium">
            <T>Goal &amp; rules</T>
          </label>
          <Textarea
            id="project-config-goal"
            rows={3}
            value={goal}
            placeholder={gt("Optional durable goal and instructions for this project's orchestrator…")}
            onChange={(event) => setGoal(event.currentTarget.value)}
          />
        </div>

        <ProjectAvatarPicker
          value={avatar}
          title={trimmedTitle || gt("Project")}
          workspaceProject={selectedWorkspace}
          onChange={setAvatar}
        />
      </DialogPanel>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          <T>Cancel</T>
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {state.mode === "create" ? <T>Create project</T> : <T>Save changes</T>}
        </Button>
      </DialogFooter>
    </form>
  );
}
