import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Mecardee rental dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Mecardee — Rental management, made simple<\/title>/i);
  assert.match(html, /Good morning, Ajmal/i);
  assert.match(html, /Current rentals/i);
  assert.match(html, /KL 35 AB 1234/i);
  assert.match(html, /New rental/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("keeps the frontend product-specific and starter-free", async () => {
  const previewRoot = new URL("../app/_sites-preview/", import.meta.url);
  const [page, layout, packageJson, previewFiles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readdir(previewRoot).catch(() => []),
  ]);

  assert.deepEqual(previewFiles, []);
  assert.match(page, /^"use client";/);
  assert.match(page, /function NewRentalDialog/);
  assert.match(page, /function ReturnDialog/);
  assert.match(page, /function AccountsView/);
  assert.match(layout, /Mecardee — Rental management, made simple/);
  assert.match(layout, /\/og-ai\.png/);
  assert.match(packageJson, /"lucide-react"/);
  assert.doesNotMatch(`${page}\n${layout}\n${packageJson}`, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});
