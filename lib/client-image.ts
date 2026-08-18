"use client";

const TARGET_BYTES = 650 * 1024;
const MAX_WIDTH = 1280;
const MIN_WIDTH = 720;
const CARD_ASPECT = 8 / 5; // 1.6:1 — matches Mecardee vehicle cards well on desktop and mobile.
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

function drawAutoFramedVehicleImage(image: HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Your browser could not prepare this image.");

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  // Fill the card with a soft version of the same photo. This avoids ugly black
  // bars for portrait uploads while keeping the whole car visible in front.
  const coverScale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight);
  const coverWidth = sourceWidth * coverScale;
  const coverHeight = sourceHeight * coverScale;
  const coverX = (canvas.width - coverWidth) / 2;
  const coverY = (canvas.height - coverHeight) / 2;
  context.save();
  context.filter = "blur(24px) saturate(0.85) brightness(0.82)";
  context.drawImage(image, coverX - 18, coverY - 18, coverWidth + 36, coverHeight + 36);
  context.restore();
  context.fillStyle = "rgba(15, 23, 42, 0.10)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Put the uncropped photo on top. Portrait and landscape uploads therefore
  // share one consistent card shape without cutting off the vehicle.
  const inset = Math.max(8, Math.round(Math.min(canvas.width, canvas.height) * 0.018));
  const containScale = Math.min((canvas.width - inset * 2) / sourceWidth, (canvas.height - inset * 2) / sourceHeight);
  const drawWidth = sourceWidth * containScale;
  const drawHeight = sourceHeight * containScale;
  context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);

  return canvas;
}

export async function compressVehicleImage(file: File): Promise<File> {
  if (!SUPPORTED.has(file.type)) throw new Error("Only JPG, PNG and WebP images are supported.");
  if (file.size <= 0) throw new Error("The selected image is empty.");

  const image = await loadImage(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  if (!originalWidth || !originalHeight) throw new Error("Could not read the selected image dimensions.");

  const longestSide = Math.max(originalWidth, originalHeight);
  const initialWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longestSide));
  let scale = 1;
  let quality = 0.82;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const width = Math.max(480, Math.round(initialWidth * scale));
    const height = Math.round(width / CARD_ASPECT);
    const canvas = drawAutoFramedVehicleImage(image, width, height);
    blob = await canvasBlob(canvas, quality);
    if (blob.size <= TARGET_BYTES) break;
    if (quality > 0.56) quality -= 0.08;
    else scale *= 0.84;
  }

  if (!blob) throw new Error("Could not compress the selected image.");
  if (blob.size > 900 * 1024) throw new Error("The image is still too large after compression. Please choose a smaller photo.");
  return new File([blob], `vehicle-${Date.now()}.webp`, { type: "image/webp", lastModified: Date.now() });
}
