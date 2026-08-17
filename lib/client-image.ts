"use client";

const TARGET_BYTES = 650 * 1024;
const MAX_SIDE = 1280;
const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp"]);

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This image could not be opened. Please choose a JPG, PNG or WebP image.")); };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare the image for upload.")), "image/webp", quality);
  });
}

export async function compressVehicleImage(file: File): Promise<File> {
  if (!SUPPORTED.has(file.type)) throw new Error("Only JPG, PNG and WebP images are supported.");
  if (file.size <= 0) throw new Error("The selected image is empty.");

  // Small images are already safe for the app request limit.
  if (file.size <= TARGET_BYTES) return file;

  const image = await loadImage(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  if (!originalWidth || !originalHeight) throw new Error("Could not read the selected image dimensions.");

  let scale = Math.min(1, MAX_SIDE / Math.max(originalWidth, originalHeight));
  let quality = 0.78;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser could not prepare this image.");
    context.drawImage(image, 0, 0, width, height);
    blob = await canvasBlob(canvas, quality);
    if (blob.size <= TARGET_BYTES) break;
    if (quality > 0.55) quality -= 0.08;
    else scale *= 0.82;
  }

  if (!blob) throw new Error("Could not compress the selected image.");
  if (blob.size > 900 * 1024) throw new Error("The image is still too large after compression. Please choose a smaller photo.");
  return new File([blob], `vehicle-${Date.now()}.webp`, { type: "image/webp", lastModified: Date.now() });
}
