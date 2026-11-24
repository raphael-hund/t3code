import { isValidProjectAvatarDataUrl } from "./projectSidebar.logic";

const AVATAR_SIZE = 128;

export type AvatarImageEncodeResult =
  | { readonly ok: true; readonly dataUrl: string }
  | { readonly ok: false; readonly reason: "not-image" | "decode-failed" | "too-large" };

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader returned non-string result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function drawCenterCropped(
  source: CanvasImageSource,
  width: number,
  height: number,
  targetSize: number,
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const side = Math.min(width, height);
  const sx = Math.max(0, (width - side) / 2);
  const sy = Math.max(0, (height - side) / 2);
  ctx.drawImage(source, sx, sy, side, side, 0, 0, targetSize, targetSize);
  return canvas;
}

function encodeCanvasToAvatarDataUrl(canvas: HTMLCanvasElement): string | null {
  const candidates: ReadonlyArray<readonly [string, number | undefined]> = [
    ["image/webp", 0.85],
    ["image/png", undefined],
    ["image/webp", 0.65],
    ["image/jpeg", 0.8],
    ["image/jpeg", 0.6],
  ];
  for (const [mime, quality] of candidates) {
    const dataUrl = quality === undefined ? canvas.toDataURL(mime) : canvas.toDataURL(mime, quality);
    if (isValidProjectAvatarDataUrl(dataUrl)) return dataUrl;
  }
  return null;
}

export async function cropImageFileToAvatarDataUrl(file: File): Promise<AvatarImageEncodeResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "not-image" };
  }

  let objectUrl: string | null = null;
  try {
    let source: CanvasImageSource;
    let width: number;
    let height: number;
    if (typeof URL.createObjectURL === "function") {
      objectUrl = URL.createObjectURL(file);
      const image = await loadImageElement(objectUrl);
      source = image;
      width = image.naturalWidth || image.width;
      height = image.naturalHeight || image.height;
    } else {
      const rawDataUrl = await readFileAsDataUrl(file);
      const image = await loadImageElement(rawDataUrl);
      source = image;
      width = image.naturalWidth || image.width;
      height = image.naturalHeight || image.height;
    }

    if (width <= 0 || height <= 0) {
      return { ok: false, reason: "decode-failed" };
    }

    const canvas = drawCenterCropped(source, width, height, AVATAR_SIZE);
    if (!canvas) {
      return { ok: false, reason: "decode-failed" };
    }

    const dataUrl = encodeCanvasToAvatarDataUrl(canvas);
    if (dataUrl) {
      return { ok: true, dataUrl };
    }

    const smallerCanvas = drawCenterCropped(source, width, height, 64);
    const smallerDataUrl = smallerCanvas ? encodeCanvasToAvatarDataUrl(smallerCanvas) : null;
    if (smallerDataUrl) {
      return { ok: true, dataUrl: smallerDataUrl };
    }

    return { ok: false, reason: "too-large" };
  } catch {
    return { ok: false, reason: "decode-failed" };
  } finally {
    if (objectUrl !== null) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
