// MECARDEE_ROLE_GUARD_V8_9_55
import { requireReadAccess, requireWriteAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
import { eq } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { vehicles } from "@/db/schema";
import {
  BucketConfigurationError,
  BucketRequestError,
  getVehicleImage,
  putVehicleImage,
} from "@/lib/railway-bucket";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

function imagePath(vehicleId: string) {
  return `/api/vehicles/${vehicleId}/image?v=${Date.now()}`;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const __mecardeeAuth = await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ ok: false, error: "Select an image first." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ ok: false, error: "Only JPG, PNG and WebP images are supported." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) return Response.json({ ok: false, error: "Vehicle image is too large after compression. Please choose another photo." }, { status: 400 });

    const exists = await withRequestDb(async (db) => {
      const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, id)).limit(1);
      return Boolean(vehicle);
    });
    if (!exists) return Response.json({ ok: false, error: "Vehicle not found." }, { status: 404 });

    await putVehicleImage(id, new Uint8Array(await file.arrayBuffer()), file.type);
    const path = imagePath(id);
    await withRequestDb(async (db) => {
      await db.update(vehicles).set({ imageUrl: path, updatedAt: new Date() }).where(eq(vehicles.id, id));
    });

    return Response.json({ ok: true, imageUrl: path });
  } catch (error) {
    if (error instanceof BucketConfigurationError || error instanceof DatabaseConfigurationError) {
      return Response.json({ ok: false, error: error.message }, { status: 503 });
    }
    if (error instanceof BucketRequestError) {
      console.error("Railway bucket rejected vehicle image upload", error);
      return Response.json({ ok: false, error: error.message }, { status: 502 });
    }
    console.error("Could not upload vehicle image", error);
    const message = process.env.NODE_ENV === "development" && error instanceof Error
      ? `Could not upload vehicle image. ${error.message}`
      : "Could not upload vehicle image.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const __mecardeeAuth = await requireReadAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const { id } = await context.params;
    const image = await getVehicleImage(id);
    const responseBytes = Uint8Array.from(image.bytes);

    return new Response(responseBytes.buffer, {
      headers: {
        "content-type": image.contentType,
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        ...(image.etag ? { etag: image.etag } : {}),
      },
    });
  } catch (error) {
    if (error instanceof BucketConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    if (error instanceof BucketRequestError) {
      if (error.status === 404) return Response.json({ ok: false, error: "Vehicle image not found." }, { status: 404 });
      console.error("Railway bucket rejected vehicle image download", error);
      return Response.json({ ok: false, error: error.message }, { status: 502 });
    }
    console.error("Could not serve vehicle image", error);
    return Response.json({ ok: false, error: "Could not serve vehicle image." }, { status: 500 });
  }
}
