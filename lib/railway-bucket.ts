import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export class BucketConfigurationError extends Error {
  constructor() {
    super(
      "Railway vehicle-image bucket is not configured. Add the bucket credential references to the rentalcars service variables.",
    );
    this.name = "BucketConfigurationError";
  }
}

type BucketConfig = {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string;
};

function env(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function config(): BucketConfig {
  const bucket = env("VEHICLE_IMAGES_BUCKET", "BUCKET");
  const accessKeyId = env("VEHICLE_IMAGES_ACCESS_KEY_ID", "ACCESS_KEY_ID");
  const secretAccessKey = env("VEHICLE_IMAGES_SECRET_ACCESS_KEY", "SECRET_ACCESS_KEY");
  const region = env("VEHICLE_IMAGES_REGION", "REGION") ?? "auto";
  const endpoint = env("VEHICLE_IMAGES_ENDPOINT", "ENDPOINT") ?? "https://storage.railway.app";

  if (!bucket || !accessKeyId || !secretAccessKey) throw new BucketConfigurationError();
  return { bucket, accessKeyId, secretAccessKey, region, endpoint };
}

function client(bucketConfig: BucketConfig) {
  return new S3Client({
    region: bucketConfig.region,
    endpoint: bucketConfig.endpoint,
    forcePathStyle: process.env.VEHICLE_IMAGES_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: bucketConfig.accessKeyId,
      secretAccessKey: bucketConfig.secretAccessKey,
    },
  });
}

export function vehicleImageKey(vehicleId: string) {
  return `vehicles/${vehicleId}/primary`;
}

export async function putVehicleImage(vehicleId: string, body: Uint8Array, contentType: string) {
  const bucketConfig = config();
  const s3 = client(bucketConfig);
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketConfig.bucket,
        Key: vehicleImageKey(vehicleId),
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=3600",
      }),
    );
  } finally {
    s3.destroy();
  }
}

export async function getVehicleImage(vehicleId: string) {
  const bucketConfig = config();
  const s3 = client(bucketConfig);
  try {
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: bucketConfig.bucket,
        Key: vehicleImageKey(vehicleId),
      }),
    );

    if (!result.Body) throw new Error("Vehicle image object has no body.");
    const bytes = await result.Body.transformToByteArray();
    return {
      bytes,
      contentType: result.ContentType ?? "image/jpeg",
      etag: result.ETag ?? undefined,
    };
  } finally {
    s3.destroy();
  }
}
