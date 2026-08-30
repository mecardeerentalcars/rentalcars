import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
fs.mkdirSync(publicDir, { recursive: true });

const rawVersion =
  process.env.RAILWAY_DEPLOYMENT_ID ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.RAILWAY_GIT_COMMIT ||
  process.env.SOURCE_VERSION ||
  process.env.COMMIT_SHA ||
  `build-${Date.now()}`;

const version = String(rawVersion)
  .trim()
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .slice(0, 96) || `build-${Date.now()}`;

const generatedAt = new Date().toISOString();

const sw = `const VERSION = ${JSON.stringify(version)};
const CACHE_PREFIX = "mecardee-shell-";
const CACHE = \`mecardee-shell-deploy-\${VERSION}\`;
const SHELL = ["/manifest.webmanifest", "/icons/mecardee-192.png", "/icons/mecardee-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (response.ok) await cache.put(url, response);
      } catch (error) {
        void error;
        // Installation must still succeed if an optional shell icon is temporarily unavailable.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const legacyUpgrade = keys.some((key) => /^mecardee-shell-v\\d+$/.test(key));

    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map((key) => caches.delete(key)),
    );

    await self.clients.claim();

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      client.postMessage({ type: "MECARDEE_VERSION_READY", version: VERSION });
    }

    // One-time rescue for the old v2 service worker/client which has no update listener.
    // Future deployments are handled by the update-aware client and therefore wait until
    // the user is no longer inside a form/dialog before refreshing.
    if (legacyUpgrade) {
      for (const client of windows) {
        try {
          const url = new URL(client.url);
          if (url.origin !== self.location.origin || url.searchParams.has("mecardee_v")) continue;
          url.searchParams.set("mecardee_v", VERSION);
          await client.navigate(url.href);
        } catch (error) {
          void error;
          // A later navigation will still be network-fresh.
        }
      }
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const acceptHeader = event.request.headers.get("accept") || "";
  const acceptsHtml = acceptHeader.indexOf("text/html") !== -1;
  if (event.request.mode === "navigate" || acceptsHtml) {
    // Never serve HTML/index from Cache Storage. Always ask the deployment for the page.
    event.respondWith(fetch(new Request(event.request, { cache: "no-store" })));
    return;
  }

  if (url.pathname === "/sw.js" || url.pathname === "/app-version.json") {
    event.respondWith(fetch(new Request(event.request, { cache: "no-store" })));
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      const response = await fetch(new Request(event.request, { cache: "reload" }));
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    })());
  }
});
`;

fs.writeFileSync(
  path.join(publicDir, "app-version.json"),
  `${JSON.stringify({ version, generatedAt })}\n`,
  "utf8",
);
fs.writeFileSync(path.join(publicDir, "sw.js"), sw, "utf8");

console.log(`Mecardee PWA version generated: ${version}`);
