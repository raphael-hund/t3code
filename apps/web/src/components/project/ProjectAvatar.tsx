import type { OrchestratorProjectAvatar } from "@t3tools/contracts";
import { FolderCodeIcon } from "lucide-react";
import { createElement, lazy, Suspense, useState } from "react";

import { cn } from "~/lib/utils";
import { projectIconColorClassName } from "../../projectIconColors";
import { deriveProjectIdentity } from "../../projectIdentity";
import { ProjectFavicon, type ProjectFaviconProject } from "../ProjectFavicon";
import { ProjectMonogram } from "../ProjectMonogram";

const LucideAvatarIcon = lazy(() =>
  import("../../lib/lucideIconByName").then(({ lucideIconByName }) => ({
    default: function LucideAvatarIcon(props: { name: string; className: string }) {
      return createElement(lucideIconByName(props.name) ?? FolderCodeIcon, {
        className: props.className,
      });
    },
  })),
);

function AvatarImage({
  src,
  title,
  className,
}: {
  readonly src: string;
  readonly title: string;
  readonly className?: string | undefined;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) {
    const identity = deriveProjectIdentity(title);
    return (
      <ProjectMonogram
        text={identity.monogram}
        color={identity.color}
        className={cn("size-5 shrink-0 [&_svg]:rounded-[28%]", className)}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      data-slot="project-avatar-image"
      className={cn("size-5 shrink-0 rounded-[28%] object-cover", className)}
      onError={() => setFailedSrc(src)}
    />
  );
}

export function ProjectAvatar({
  avatar,
  title,
  workspaceProject,
  className,
}: {
  readonly avatar: OrchestratorProjectAvatar | null | undefined;
  readonly title: string;
  readonly workspaceProject?: ProjectFaviconProject | null | undefined;
  readonly className?: string | undefined;
}) {
  if (avatar?.kind === "image") {
    return <AvatarImage src={avatar.dataUrl} title={title} className={className} />;
  }

  if (avatar?.kind === "monogram") {
    return (
      <ProjectMonogram
        text={avatar.text}
        color={avatar.color}
        className={cn("size-5 shrink-0 [&_svg]:rounded-[28%]", className)}
      />
    );
  }

  if (avatar?.kind === "emoji") {
    return (
      <span
        aria-hidden="true"
        data-slot="project-avatar-emoji"
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-[28%] bg-sidebar-accent/60 leading-none [container-type:size]",
          className,
        )}
      >
        <span className="text-[length:72cqh] leading-none">{avatar.emoji}</span>
      </span>
    );
  }

  if (avatar?.kind === "lucide") {
    const colorClassName = projectIconColorClassName(avatar.color);
    return (
      <span
        aria-hidden="true"
        data-slot="project-avatar-lucide"
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-[28%] p-0.5",
          colorClassName,
          className,
        )}
        style={{
          backgroundColor: "color-mix(in srgb, currentColor 14%, transparent)",
        }}
      >
        <Suspense fallback={<FolderCodeIcon className="size-full text-inherit" />}>
          <LucideAvatarIcon name={avatar.name} className="size-full text-inherit" />
        </Suspense>
      </span>
    );
  }

  if (workspaceProject) {
    return (
      <ProjectFavicon
        project={workspaceProject}
        className={cn("size-5 shrink-0 rounded-[28%] [&_svg]:rounded-[28%]", className)}
      />
    );
  }

  const identity = deriveProjectIdentity(title || "P");
  return (
    <ProjectMonogram
      text={identity.monogram}
      color={identity.color}
      className={cn("size-5 shrink-0 [&_svg]:rounded-[28%]", className)}
    />
  );
}
