#!/usr/bin/env node
/**
 * Postbuild adapter for Vercel.
 *
 * The TanStack Start build emits:
 *   - dist/client/                 (static assets — JS, CSS, images)
 *   - dist/server/server.js        (Web-Fetch handler with external imports)
 *   - dist/server/assets/          (server-side asset manifest etc.)
 *
 * We bundle dist/server/server.js (with all node_modules inlined) into a
 * self-contained ESM file and ship it as a Vercel Node.js serverless function
 * under .vercel/output/functions/_render.func.
 */
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const distClient = resolve(root, "dist/client");
const distServer = resolve(root, "dist/server");
const serverEntry = resolve(distServer, "server.js");
const outDir = resolve(root, ".vercel/output");
const staticDir = resolve(outDir, "static");
const fnDir = resolve(outDir, "functions/_render.func");

if (!process.env.VERCEL) {
  console.log("[vercel-build] Skipping (not a Vercel build — VERCEL env not set).");
  process.exit(0);
}

if (!existsSync(serverEntry)) {
  console.error("[vercel-build] dist/server/server.js not found. Did `vite build` run?");
  process.exit(1);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 1) Static assets -> .vercel/output/static
await cp(distClient, staticDir, { recursive: true });

// 2) Bundle the server entry (with all node_modules inlined) into the function dir
await mkdir(fnDir, { recursive: true });

await build({
  entryPoints: [serverEntry],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: resolve(fnDir, "server.js"),
  packages: "bundle",
  external: [],
  banner: {
    // CJS-compat shims + defensive polyfills for newer JS APIs that some
    // bundled libs (notably pdfjs-dist) call at module evaluation time.
    js: [
      "import { createRequire as __createRequire } from 'module';",
      "const require = __createRequire(import.meta.url);",
      // Promise.withResolvers — used by pdfjs-dist (Node < 22 may lack it).
      "if (typeof Promise.withResolvers !== 'function') {",
      "  Promise.withResolvers = function () {",
      "    let resolve, reject;",
      "    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });",
      "    return { promise, resolve, reject };",
      "  };",
      "}",
      // URL.parse static — used by pdfjs-dist (Node < 22 may lack it).
      "if (typeof URL.parse !== 'function') {",
      "  URL.parse = function (input, base) {",
      "    try { return base != null ? new URL(input, base) : new URL(input); }",
      "    catch { return null; }",
      "  };",
      "}",
    ].join("\n"),
  },
  logLevel: "warning",
  minify: false,
  sourcemap: false,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

// Copy server-side assets (manifest etc.) referenced at runtime.
const serverAssets = resolve(distServer, "assets");
if (existsSync(serverAssets)) {
  await cp(serverAssets, resolve(fnDir, "assets"), { recursive: true });
}

// Adapter entry: Node serverless function -> Web Fetch handler.
// Polyfills first, then dynamic-import the bundled server so the polyfills
// are in place before any module-evaluation code from pdfjs-dist runs.
const entry = `// Defensive polyfills — must run BEFORE importing ./server.js.
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}
if (typeof URL.parse !== "function") {
  URL.parse = function (input, base) {
    try { return base != null ? new URL(input, base) : new URL(input); }
    catch { return null; }
  };
}

const serverModule = await import("./server.js");
const server = serverModule.default ?? serverModule.server;

export default async function handler(req, res) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    // req.url already includes the query string on Vercel's Node runtime.
    const url = new URL(req.url || "/", \`\${proto}://\${host}\`);

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
      else if (v != null) headers.set(k, String(v));
    }

    const method = (req.method || "GET").toUpperCase();
    let body;
    if (method !== "GET" && method !== "HEAD") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      if (chunks.length) body = Buffer.concat(chunks);
    }

    const request = new Request(url.toString(), { method, headers, body });
    const response = await server.fetch(request);

    res.statusCode = response.status;
    // Preserve multi-value headers (notably set-cookie).
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") return;
      res.setHeader(key, value);
    });
    if (setCookies.length) res.setHeader("set-cookie", setCookies);

    if (!response.body) return res.end();
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    // Log a rich error so Vercel runtime logs show the actual cause instead
    // of the generic FUNCTION_INVOCATION_FAILED page.
    const info = {
      name: err && err.name,
      message: err && err.message,
      stack: err && err.stack,
      cause: err && err.cause,
    };
    console.error("[_render] handler error:", JSON.stringify(info, null, 2));
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
}
`;
await writeFile(resolve(fnDir, "index.mjs"), entry);

await writeFile(
  resolve(fnDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      // Buffer mode — simpler, more compatible with our custom wrapper.
      supportsResponseStreaming: false,
    },
    null,
    2,
  ),
);

await writeFile(
  resolve(fnDir, "package.json"),
  JSON.stringify({ type: "module" }, null, 2),
);

// 3) Top-level config: serve static, fall back to the SSR function.
await writeFile(
  resolve(outDir, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/.*", dest: "/_render" },
      ],
    },
    null,
    2,
  ),
);

console.log("[vercel-build] .vercel/output ready (server.js bundled, nodejs22.x).");
