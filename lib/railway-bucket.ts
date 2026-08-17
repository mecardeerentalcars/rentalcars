import { AwsClient } from "aws4fetch";

export class BucketConfigurationError extends Error {
  constructor() {
    super(
      "Railway vehicle-image bucket is not configured. Add the bucket credential references to the rentalcars service variables.",
    );
    this.name = "BucketConfigurationError";
  }
}

export class BucketRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BucketRequestError";
    this.status = status;
  }
}

type BucketConfig = {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string;
  forcePathStyle: boolean;
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
  const forcePathStyle = env("VEHICLE_IMAGES_FORCE_PATH_STYLE") === "true";

  if (!bucket || !accessKeyId || !secretAccessKey) throw new BucketConfigurationError();
  return { bucket, accessKeyId, secretAccessKey, region, endpoint, forcePathStyle };
}

function encodedKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function objectUrl(bucketConfig: BucketConfig, key: string) {
  const endpoint = new URL(bucketConfig.endpoint);
  const basePath = endpoint.pathname.replace(/\/$/, "");
  const keyPath = encodedKey(key);

  if (bucketConfig.forcePathStyle) {
    endpoint.pathname = `${basePath}/${encodeURIComponent(bucketConfig.bucket)}/${keyPath}`;
  } else {
    // Railway buckets normally use the S3 virtual-hosted form. Example:
    // https://<bucket>.<endpoint-host>/vehicles/<id>/primary
    endpoint.hostname = `${bucketConfig.bucket}.${endpoint.hostname}`;
    endpoint.pathname = `${basePath}/${keyPath}`;
  }

  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
}

function client(bucketConfig: BucketConfig) {
  return new AwsClient({
    accessKeyId: bucketConfig.accessKeyId,
    secretAccessKey: bucketConfig.secretAccessKey,
    service: "s3",
    region: bucketConfig.region,
    // Keep failures fast in the mobile app. The UI can retry explicitly.
    retries: 2,
    initRetryMs: 75,
  });
}

async function checkedResponse(response: Response, operation: string) {
  if (response.ok) return response;
  let detail = "";
  try {
    detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 350);
  } catch {
    // Ignore body-read failures; status/statusText are still useful.
  }
  const suffix = detail ? ` ${detail}` : "";
  throw new BucketRequestError(
    response.status,
    `${operation} failed (${response.status} ${response.statusText || "S3 error"}).${suffix}`,
  );
}

export function vehicleImageKey(vehicleId: string) {
  return `vehicles/${vehicleId}/primary`;
}

function toRequestBody(bytes: Uint8Array): ArrayBuffer {
  // Copy into a fresh ArrayBuffer so Vinext/Workers DOM typings accept it as BodyInit.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function putVehicleImage(vehicleId: string, body: Uint8Array, contentType: string) {
  const bucketConfig = config();
  const aws = client(bucketConfig);
  const url = objectUrl(bucketConfig, vehicleImageKey(vehicleId));

  const response = await aws.fetch(url, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
    body: toRequestBody(body),
  });

  await checkedResponse(response, "Vehicle image upload");
}

export async function getVehicleImage(vehicleId: string) {
  const bucketConfig = config();
  const aws = client(bucketConfig);
  const url = objectUrl(bucketConfig, vehicleImageKey(vehicleId));
  const response = await aws.fetch(url, { method: "GET" });

  await checkedResponse(response, "Vehicle image download");

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "image/webp",
    etag: response.headers.get("etag") ?? undefined,
  };
}
