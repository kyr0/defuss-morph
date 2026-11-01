// @vitest-environment node
// The dev server's static handler (scripts/serve.mjs) on a real socket over a throwaway directory.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain ESM script without type declarations
import { createStaticServer } from "./serve.mjs";

let root: string;
let server: import("node:http").Server;
let base: string;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "defuss-morph-serve-"));
  mkdirSync(join(root, "site"));
  writeFileSync(join(root, "site", "index.html"), "<p>hi</p>");
  // a path that exists but cannot be read as a file: open() succeeds, read() fails with EISDIR
  mkdirSync(join(root, "broken", "index.html"), { recursive: true });
  server = createStaticServer(root);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  rmSync(root, { recursive: true, force: true });
});

describe("scripts/serve.mjs", () => {
  it("serves a directory's index.html uncached and redirects / and slash-less directories", async () => {
    const page = await fetch(`${base}/site/`);
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(await page.text()).toBe("<p>hi</p>");
    expect((await fetch(`${base}/`, { redirect: "manual" })).headers.get("location")).toBe("/docs/");
    expect((await fetch(`${base}/site`, { redirect: "manual" })).headers.get("location")).toBe("/site/");
  });

  it("refuses paths outside the root and answers missing files with 404", async () => {
    expect((await fetch(`${base}/..%2fetc%2fpasswd`)).status).toBe(403);
    expect((await fetch(`${base}/nope.html`)).status).toBe(404);
  });

  // regression: an unhandled read-stream error used to end the server process
  it("keeps serving after a file fails to read", async () => {
    await fetch(`${base}/broken/`).then((r) => r.text()).catch(() => "connection cut");
    expect((await fetch(`${base}/site/`)).status).toBe(200);
  });
});
