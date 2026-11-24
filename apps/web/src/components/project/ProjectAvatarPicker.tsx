import type { OrchestratorProjectAvatar, ProjectIconColor } from "@t3tools/contracts";
import { T, useGT, useMessages } from "gt-react";
import { ImagePlusIcon, Trash2Icon } from "lucide-react";
import { createElement, useRef, useState, type DragEvent } from "react";

import { cn } from "~/lib/utils";
import { lucideIconByName } from "../../lib/lucideIconByName";
import {
  filterProjectIconNames,
  firstEmoji,
  isValidProjectMonogram,
  PROJECT_EMOJIS,
  PROJECT_ICON_COLORS,
  projectIconColorClassName,
} from "../../projectIconOptions";
import { deriveProjectIdentity } from "../../projectIdentity";
import type { ProjectFaviconProject } from "../ProjectFavicon";
import { ProjectMonogram } from "../ProjectMonogram";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { ProjectAvatar } from "./ProjectAvatar";
import { cropImageFileToAvatarDataUrl } from "./projectAvatarImage";

type PickerTab = "image" | "lucide" | "emoji" | "monogram";

const DEFAULT_ICON = "folder-code";

function PickerIcon({ name }: { readonly name: string }) {
  const icon = lucideIconByName(name);
  return icon ? createElement(icon, { className: "size-4" }) : null;
}

function iconLabel(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ProjectAvatarPicker({
  value,
  title,
  workspaceProject,
  onChange,
}: {
  readonly value: OrchestratorProjectAvatar | null;
  readonly title: string;
  readonly workspaceProject?: ProjectFaviconProject | null | undefined;
  readonly onChange: (avatar: OrchestratorProjectAvatar | null) => void;
}) {
  const gt = useGT();
  const m = useMessages();
  const automatic = deriveProjectIdentity(title || "P");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<PickerTab>(value?.kind ?? "image");
  const [color, setColor] = useState<ProjectIconColor>(
    value && value.kind !== "emoji" && value.kind !== "image" ? value.color : automatic.color,
  );
  const [iconName, setIconName] = useState<string>(
    value?.kind === "lucide" ? value.name : DEFAULT_ICON,
  );
  const [letters, setLetters] = useState<string>(
    value?.kind === "monogram" ? value.text : automatic.monogram,
  );
  const [emoji, setEmoji] = useState<string>(value?.kind === "emoji" ? value.emoji : "🚀");
  const [query, setQuery] = useState("");
  const [customEmoji, setCustomEmoji] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  const icons = filterProjectIconNames(query);
  const selectedColorClassName = projectIconColorClassName(color);
  const monogram = letters.normalize("NFKC").trim().toUpperCase();
  const validMonogram = isValidProjectMonogram(monogram);

  const handleImageFile = async (file: File | null | undefined) => {
    if (!file) return;
    setImageError(null);
    const result = await cropImageFileToAvatarDataUrl(file);
    if (!result.ok) {
      setImageError(
        result.reason === "not-image"
          ? gt("Please choose an image file.")
          : result.reason === "too-large"
            ? gt("Image is too large. Try a smaller file.")
            : gt("Could not read this image file."),
      );
      return;
    }
    onChange({ kind: "image", dataUrl: result.dataUrl });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingImage(false);
    const file = event.dataTransfer.files[0];
    void handleImageFile(file);
  };

  const handleColorSelect = (nextColor: ProjectIconColor) => {
    setColor(nextColor);
    if (tab === "lucide") {
      onChange({ kind: "lucide", name: iconName, color: nextColor });
    } else if (tab === "monogram" && validMonogram) {
      onChange({ kind: "monogram", text: monogram, color: nextColor });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProjectAvatar
            avatar={value}
            title={title}
            workspaceProject={workspaceProject}
            className="size-11"
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              <T>Profile picture</T>
            </div>
            <div className="text-xs text-muted-foreground">
              <T>Upload an image or pick an icon, emoji, or monogram.</T>
            </div>
          </div>
        </div>
        {value !== null ? (
          <Button
            size="xs"
            variant="ghost-muted"
            onClick={() => {
              setImageError(null);
              onChange(null);
            }}
          >
            <Trash2Icon className="size-3.5" />
            <T>Remove</T>
          </Button>
        ) : null}
      </div>

      <ToggleGroup
        aria-label={gt("Profile picture type")}
        variant="segmented"
        value={[tab]}
        onValueChange={(next) => {
          const picked = next[0];
          if (
            picked === "image" ||
            picked === "lucide" ||
            picked === "emoji" ||
            picked === "monogram"
          ) {
            setTab(picked);
          }
        }}
      >
        <Toggle value="image">
          <T>Image</T>
        </Toggle>
        <Toggle value="lucide">
          <T>Icons</T>
        </Toggle>
        <Toggle value="emoji">
          <T>Emoji</T>
        </Toggle>
        <Toggle value="monogram">
          <T>Monogram</T>
        </Toggle>
      </ToggleGroup>

      {tab === "image" ? (
        <div className="space-y-2">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingImage(true);
            }}
            onDragLeave={() => setIsDraggingImage(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/25 px-4 py-4 text-center transition-colors",
              isDraggingImage && "border-primary bg-primary/5",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label={gt("Upload profile image")}
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void handleImageFile(file);
              }}
            />
            <ImagePlusIcon aria-hidden className="size-5 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              <T>Drop an image here or choose a file (cropped to a 128×128 square).</T>
            </div>
            <Button size="xs" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <T>Upload profile image</T>
            </Button>
          </div>
          {imageError ? (
            <p role="alert" className="text-xs text-destructive">
              {imageError}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "lucide" || tab === "monogram" ? (
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            <T>Color</T>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={gt("Icon color")}>
            {PROJECT_ICON_COLORS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={m(option.label)}
                aria-pressed={color === option.value}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border border-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  color === option.value && "border-foreground/64",
                )}
                onClick={() => handleColorSelect(option.value)}
              >
                <span className={cn("size-4 rounded-full", option.swatchClassName)} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "lucide" ? (
        <div className="space-y-2">
          <Input
            type="text"
            role="searchbox"
            value={query}
            aria-label={gt("Search Lucide icons")}
            placeholder={gt("Search all Lucide icons")}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <ScrollArea scrollFade className="max-h-40">
            <div className="grid grid-cols-8 gap-1 p-0.5 sm:grid-cols-10">
              {icons.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-label={iconLabel(name)}
                  aria-pressed={value?.kind === "lucide" && iconName === name}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md border border-transparent outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    value?.kind === "lucide" && iconName === name && "border-border bg-accent",
                    selectedColorClassName,
                  )}
                  onClick={() => {
                    setIconName(name);
                    onChange({ kind: "lucide", name, color });
                  }}
                >
                  <PickerIcon name={name} />
                </button>
              ))}
            </div>
          </ScrollArea>
          {icons.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              <T>No icons found.</T>
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "emoji" ? (
        <div className="space-y-2">
          <ScrollArea scrollFade className="max-h-40">
            <div className="grid grid-cols-8 gap-1 p-0.5 sm:grid-cols-10">
              {PROJECT_EMOJIS.map((option) => (
                <button
                  key={option.emoji}
                  type="button"
                  aria-label={m(option.label)}
                  aria-pressed={value?.kind === "emoji" && emoji === option.emoji}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md border border-transparent text-lg outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    value?.kind === "emoji" && emoji === option.emoji && "border-border bg-accent",
                  )}
                  onClick={() => {
                    setEmoji(option.emoji);
                    onChange({ kind: "emoji", emoji: option.emoji });
                  }}
                >
                  {option.emoji}
                </button>
              ))}
            </div>
          </ScrollArea>
          <Input
            value={customEmoji}
            aria-label={gt("Custom emoji")}
            placeholder={gt("Paste an emoji")}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setCustomEmoji(nextValue);
              const nextEmoji = firstEmoji(nextValue);
              if (nextEmoji) {
                setEmoji(nextEmoji);
                onChange({ kind: "emoji", emoji: nextEmoji });
              }
            }}
          />
        </div>
      ) : null}

      {tab === "monogram" ? (
        <div className="flex items-center gap-4 py-1">
          <ProjectMonogram
            text={validMonogram ? monogram : automatic.monogram}
            color={color}
            className="size-10"
          />
          <div className="flex-1 space-y-1.5">
            <label htmlFor="project-avatar-monogram" className="text-xs font-medium">
              <T>Letters</T>
            </label>
            <Input
              id="project-avatar-monogram"
              value={letters}
              onChange={(event) => {
                const raw = event.currentTarget.value;
                setLetters(raw);
                const normalized = raw.normalize("NFKC").trim().toUpperCase();
                if (isValidProjectMonogram(normalized)) {
                  onChange({ kind: "monogram", text: normalized, color });
                }
              }}
              aria-describedby="project-avatar-monogram-hint"
              aria-invalid={!validMonogram}
              autoComplete="off"
            />
            <p id="project-avatar-monogram-hint" className="text-xs text-muted-foreground">
              <T>One or two letters or numbers.</T>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
