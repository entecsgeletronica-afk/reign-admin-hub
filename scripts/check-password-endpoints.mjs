#!/usr/bin/env node
/**
 * Auditoria de segurança: lista todas as chamadas relacionadas a senha
 * (supabase.auth.*) e endpoints customizados que possam permitir
 * enumeração de usuários/senhas.
 *
 * Saída:
 *   - Tabela de ocorrências (arquivo:linha — método — trecho)
 *   - Resumo por método
 *   - Heurísticas de risco (endpoints customizados sob src/routes/api/**)
 *
 * Exit code:
 *   0  → nenhum endpoint customizado de enumeração detectado
 *   1  → encontrou endpoint suspeito (caller deve revisar)
 *
 * Uso:
 *   node scripts/check-password-endpoints.mjs
 *   node scripts/check-password-endpoints.mjs --json
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const SCAN_DIRS = ["src", "supabase/functions", "scripts"];
const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  ".output",
  ".vinxi",
  ".tanstack",
  ".cache",
  "build",
]);
const FILE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

// Métodos do supabase.auth que tocam credenciais/recovery.
// Cada padrão captura a forma `supabase.auth.<método>` (com ou sem cliente
// renomeado: também captura `.auth.<método>` para clientes admin/server).
const PASSWORD_AUTH_METHODS = [
  "signInWithPassword",
  "signUp",
  "updateUser", // pode atualizar password
  "resetPasswordForEmail",
  "verifyOtp",
  "exchangeCodeForSession",
  "reauthenticate",
  "admin.createUser",
  "admin.updateUserById",
  "admin.deleteUser",
  "admin.listUsers",
  "admin.getUserById",
  "admin.generateLink",
  "admin.inviteUserByEmail",
];

// Heurísticas para endpoints customizados que possam permitir enumeração.
const ENUMERATION_HINTS = [
  /\/api\/.*\b(check[-_]?email|email[-_]?exists|user[-_]?exists|reset[-_]?password|forgot[-_]?password|password[-_]?reset|lookup[-_]?user)\b/i,
  /createServerFn[\s\S]{0,200}\b(check[-_]?email|email[-_]?exists|user[-_]?exists|lookup[-_]?user)\b/i,
];

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");

/** Recursively list files under a directory. */
function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (FILE_EXT.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Build a regex that matches `.auth.<method>(` with optional whitespace. */
function methodRegex(method) {
  // Escape dots in method (e.g. "admin.createUser").
  const escaped = method.replace(/\./g, "\\.");
  return new RegExp(`\\.auth\\.${escaped}\\s*\\(`, "g");
}

const matches = []; // { file, line, col, method, snippet }
const enumerationFindings = []; // { file, line, snippet, pattern }

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join("/");
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const lines = src.split("\n");

  // 1) Auth-method usage scan.
  for (const method of PASSWORD_AUTH_METHODS) {
    const re = methodRegex(method);
    let m;
    while ((m = re.exec(src)) !== null) {
      // Compute line/col from offset.
      const before = src.slice(0, m.index);
      const line = before.split("\n").length;
      const col = m.index - before.lastIndexOf("\n");
      const snippet = (lines[line - 1] ?? "").trim().slice(0, 200);
      matches.push({ file: rel, line, col, method, snippet });
    }
  }

  // 2) Enumeration-endpoint heuristic scan (path + content).
  for (const pattern of ENUMERATION_HINTS) {
    if (pattern.test(rel) || pattern.test(src)) {
      // Find the first matching line for context.
      let lineNo = 1;
      for (const [idx, l] of lines.entries()) {
        if (pattern.test(l)) {
          lineNo = idx + 1;
          break;
        }
      }
      enumerationFindings.push({
        file: rel,
        line: lineNo,
        snippet: (lines[lineNo - 1] ?? "").trim().slice(0, 200),
        pattern: pattern.toString(),
      });
    }
  }
}

// Group + summary.
const byMethod = new Map();
for (const m of matches) {
  byMethod.set(m.method, (byMethod.get(m.method) ?? 0) + 1);
}

if (asJson) {
  console.log(
    JSON.stringify(
      {
        scannedFiles: files.length,
        scannedDirs: SCAN_DIRS,
        totalAuthCalls: matches.length,
        byMethod: Object.fromEntries(byMethod),
        matches,
        enumerationFindings,
      },
      null,
      2,
    ),
  );
} else {
  const c = {
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  };

  console.log(c.bold("\n🔐 Auditoria — chamadas supabase.auth relacionadas a senha\n"));
  console.log(c.dim(`Diretórios: ${SCAN_DIRS.join(", ")}`));
  console.log(c.dim(`Arquivos varridos: ${files.length}`));
  console.log(c.dim(`Ocorrências encontradas: ${matches.length}\n`));

  if (matches.length === 0) {
    console.log(c.yellow("Nenhuma chamada de auth encontrada."));
  } else {
    // Agrupado por método.
    console.log(c.bold("Resumo por método:"));
    for (const [method, count] of [...byMethod.entries()].sort()) {
      console.log(`  ${c.cyan(method.padEnd(28))} ${String(count).padStart(3)}`);
    }
    console.log();

    console.log(c.bold("Detalhe (arquivo:linha → método → trecho):"));
    for (const m of matches) {
      const loc = `${m.file}:${m.line}`;
      console.log(`  ${c.green(loc.padEnd(56))} ${c.cyan(m.method.padEnd(28))} ${c.dim(m.snippet)}`);
    }
    console.log();
  }

  console.log(c.bold("🚨 Endpoints customizados de enumeração:"));
  if (enumerationFindings.length === 0) {
    console.log("  " + c.green("Nenhum endpoint suspeito detectado. ✅"));
  } else {
    for (const f of enumerationFindings) {
      console.log(`  ${c.red(`${f.file}:${f.line}`)}  ${c.dim(f.snippet)}`);
      console.log(`    ${c.dim(`pattern: ${f.pattern}`)}`);
    }
  }
  console.log();
}

process.exit(enumerationFindings.length > 0 ? 1 : 0);
