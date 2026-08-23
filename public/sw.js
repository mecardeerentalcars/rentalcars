const VERSION = "build-1787460786957";
const CACHE_PREFIX = "mecardee-shell-";
const CACHE = `mecardee-shell-deploy-${VERSION}`;
const SHELL = ["/manifest.webmanifest", "/icons/mecardee-192.png", "/icons/mecardee-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (response.ok) await cache.put(url, response);
      } catch {
        // Installation must still succeed if an optional shell icon is temporarily unavailable.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const legacyUpgrade = keys.some((key) => /^mecardee-shell-v\d+$/.test(key));

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
        } catch {
          // A later navigation will still be network-fresh.
        }
      }
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const acceptsHtml = event.request.headers.get("accept")?.includes("text/html");
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
