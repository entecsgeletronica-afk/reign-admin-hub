#!/usr/bin/env node
/**
 * Static checks for grid → editor navigation.
 *
 * Validates that every Link / navigate / preloadRoute reference to the editor
 * uses the canonical path "/pintar/$slug/$page" with both `slug` and `page`
 * params, and that all `to="..."` targets across routes resolve to a known
 * route in the route tree.
 *
 * Usage:  node scripts/check-grid-navigation.mjs
 * Exits with code 1 on any failure.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const KNOWN_ROUTES = new Set([
  "/",
  "/admin",
  "/admin/login",
  "/admin/areas",
  "/admin/biblioteca/cursos",
  "/admin/biblioteca/desenhos",
  "/admin/biblioteca/downloads",
  "/admin/branding",
  "/admin/catalogo",
  "/admin/cores",
  "/admin/dashboard",
  "/admin/idiomas",
  "/admin/ofertas",
  "/admin/produtos/$productId/aulas",
  "/admin/qa-capas",
  "/admin/relatorios",
  "/admin/telas-login",
  "/admin/templates",
  "/admin/usuarios",
  "/admin/usuarios/$userId",
  "/admin/ver-como-usuario",
  "/admin/webhooks",
  "/buscar",
  "/favoritos",
  "/login",
  "/perfil",
  "/perfil/compras",
  "/perfil/explorar",
  "/produto/$slug",
  "/pintar/$slug/$page",
  // Allow relative + special targets used by TanStack Router
  "..",
  ".",
]);

const GRID_FILES = [
  "src/routes/index.tsx",
  "src/routes/produto.$slug.tsx",
  "src/routes/pintar.$slug.$page.tsx",
  "src/routes/buscar.tsx",
  "src/routes/favoritos.tsx",
  "src/routes/perfil.index.tsx",
  "src/routes/perfil.compras.tsx",
  "src/routes/perfil.explorar.tsx",
  "src/components/app/ProductCard.tsx",
];

function readAllRouteFiles() {
  const out = [];
  function walk(d) {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && !name.endsWith(".gen.ts")) {
        out.push({ path: full, content: readFileSync(full, "utf8") });
      }
    }
  }
  walk(join(ROOT, "src/routes"));
  return out;
}

const failures = [];
function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ✗ ${name}`);
    console.log(`    → ${err.message}`);
  }
}

console.log("\n→ grid-navigation checks\n");

check("never interpolates editor path as template string", () => {
  const offenders = [];
  for (const file of GRID_FILES) {
    const full = join(ROOT, file);
    if (!existsSync(full)) continue;
    const content = readFileSync(full, "utf8");
    const interp = content.match(/`\/(?:pintar|produto)\/\$\{[^`]+`/g);
    if (interp) offenders.push(`${file}: ${interp.join(", ")}`);
  }
  assert.deepEqual(offenders, [], "Use to=\"/pintar/$slug/$page\" with params, not template strings");
});

check("every editor navigation passes both slug and page params", () => {
  const offenders = [];
  for (const file of GRID_FILES) {
    const full = join(ROOT, file);
    if (!existsSync(full)) continue;
    const content = readFileSync(full, "utf8");
    const regex = /["']\/pintar\/\$slug\/\$page["']/g;
    let match;
    while ((match = regex.exec(content))) {
      const start = match.index;
      // Skip the route definition itself: createFileRoute("/pintar/$slug/$page")
      const before = content.slice(Math.max(0, start - 30), start);
      if (/createFileRoute\(\s*$/.test(before)) continue;
      const window = content.slice(start, start + 400);
      const hasSlug = /params\s*[:=]\s*[\s\S]{0,5}\{[\s\S]*?\bslug\b/.test(window);
      const hasPage = /params\s*[:=]\s*[\s\S]{0,5}\{[\s\S]*?\bpage\b/.test(window);
      if (!hasSlug || !hasPage) {
        offenders.push(`${file}@${start}: missing slug/page params`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

check("all to=\"...\" paths in routes resolve to a known route", () => {
  const offenders = [];
  const files = readAllRouteFiles();
  const regex = /\bto\s*[:=]\s*["'](\/[^"']*|\.{1,2})["']/g;
  for (const { path, content } of files) {
    let m;
    while ((m = regex.exec(content))) {
      const target = m[1];
      const clean = target.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
      if (!KNOWN_ROUTES.has(clean)) {
        offenders.push(`${path.replace(ROOT + "/", "")}: unknown route "${target}"`);
      }
    }
  }
  assert.deepEqual(offenders, [], "All Link/navigate/preloadRoute targets must exist in the route tree");
});

check("editor route file exists and exports the canonical path", () => {
  const file = join(ROOT, "src/routes/pintar.$slug.$page.tsx");
  assert.ok(existsSync(file), "pintar.$slug.$page.tsx must exist");
  const content = readFileSync(file, "utf8");
  assert.match(content, /createFileRoute\(["']\/pintar\/\$slug\/\$page["']\)/);
});

check("preloadRoute calls for editor pass slug + page", () => {
  const offenders = [];
  for (const file of GRID_FILES) {
    const full = join(ROOT, file);
    if (!existsSync(full)) continue;
    const content = readFileSync(full, "utf8");
    const regex = /preloadRoute\s*\(\s*\{[\s\S]{0,300}?\}\s*\)/g;
    let m;
    while ((m = regex.exec(content))) {
      const block = m[0];
      if (block.includes("/pintar/$slug/$page")) {
        if (!/\bslug\b/.test(block) || !/\bpage\b/.test(block)) {
          offenders.push(`${file}: preloadRoute missing slug/page`);
        }
      }
    }
  }
  assert.deepEqual(offenders, []);
});

console.log("");
if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} check(s) failed\n`);
  process.exit(1);
}
console.log(`✓ all grid-navigation checks passed\n`);
