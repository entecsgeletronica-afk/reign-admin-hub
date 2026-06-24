# PRD — Correções de Deploy Vercel e Hardening de Segurança RLS

Data: 2026-05-03
Stack: TanStack Start + Supabase
Alvo de deploy: Vercel (Node 22 serverless)

## Contexto

Sessão de correção em duas frentes:
1. **Falhas de deploy/runtime na Vercel** após migração do alvo Cloudflare → Vercel.
2. **Vulnerabilidades de RLS** apontadas pelo scanner em tabelas com leitura pública indevida.

---

## Parte 1 — Deploy na Vercel

### Problema
- Build concluía, mas a função SSR caía em runtime com `FUNCTION_INVOCATION_FAILED`, sem stack útil no painel.
- Causa raiz suspeita: dependências modernas (`react-pdf` / `pdfjs-dist`) usando `Promise.withResolvers` e `URL.parse` em runtime Node potencialmente desatualizado, além de avaliação dessas libs durante SSR.

### Objetivos
- SSR estável na Vercel sem 500.
- Logs de runtime acionáveis em caso de falha.
- Bundle SSR menor, sem código client-only desnecessário.

### Decisões
- **Adapter Vercel próprio** em `scripts/vercel-build.mjs`:
  - Empacota `dist/server/server.js` com `esbuild` (`platform: node`, `target: node22`, `format: esm`, `packages: bundle`).
  - Emite função em `.vercel/output/functions/_render.func` com `runtime: nodejs22.x`, `supportsResponseStreaming: false` (modo buffer, mais compatível).
  - Wrapper `req/res` → `Request`/`Response` preservando query string, múltiplos headers (especialmente `set-cookie`) e body.
  - Polyfills defensivos para `Promise.withResolvers` e `URL.parse` injetados antes de qualquer `import` do servidor.
  - `catch` com log estruturado (`name`, `message`, `stack`, `cause`).
- **`vite.config.ts`**: Cloudflare plugin desativado em build (`cloudflare: false`).
- **Client-only para PDF**: `EbookView.tsx` carrega `PdfReader` apenas no cliente, evitando avaliação de `pdfjs-dist` no SSR.
- **`package.json`**: `esbuild` adicionado como dependência; scripts de build ajustados.
- **Roteamento Vercel**: `config.json` com `handle: filesystem` + fallback `/.*` → `/_render`.

### Arquivos modificados
- `scripts/vercel-build.mjs` (criado/atualizado)
- `vite.config.ts`
- `package.json`
- `bun.lockb`
- `src/components/app/EbookView.tsx`
- `src/routeTree.gen.ts` (regenerado)
- `.lovable/plan.md`

### Critérios de aceite
- Deploy Vercel conclui sem erro.
- Rota SSR raiz responde 200.
- Em caso de erro, log `[_render] handler error:` aparece em Functions/Runtime Logs com stack completa.
- Visualização de eBook funciona no cliente sem quebrar SSR.

---

## Parte 2 — Hardening de Segurança RLS

### Problema
Scanner reportou três tabelas com políticas excessivamente permissivas:
- `course_modules` — leitura pública expondo conteúdo de curso.
- `course_lessons` — leitura pública expondo `video_url`, `embed_code`, `pdf_url`.
- `protected_settings` — leitura anônima de configurações institucionais.

### Decisões
- **Conteúdo de curso atrás de entitlement**: usar `public.user_has_product_access(auth.uid(), product_id)` para gating.
- **Settings**: leitura restrita a `authenticated`; frontend usa `PROTECTED_DEFAULTS` como fallback para visitantes anônimos, evitando UI quebrada.
- Avisos de plataforma (search_path em funções, listagem pública de bucket) não abordados nesta sessão — registrados como aceitos por ora.

### Mudanças aplicadas (migração Supabase)
- `course_modules.SELECT`: `TO authenticated USING (user_has_product_access(auth.uid(), product_id))`.
- `course_lessons.SELECT`: admin OU usuário autenticado com acesso ao produto, e somente lições publicadas.
- `protected_settings.SELECT`: `TO authenticated`.
- Findings `course_lessons_unprotected_content` e `protected_settings_public_read` marcados como corrigidos no scanner.

### Arquivos modificados
- `supabase/migrations/20260503172653_86b237de-e703-42e0-a2b5-9e9468025a6b.sql` (novo)
- `src/services/protected-settings.ts` (já contemplava `PROTECTED_DEFAULTS` como fallback)

### Critérios de aceite
- Visitantes anônimos não conseguem `SELECT` em `course_modules`, `course_lessons`, `protected_settings`.
- Usuários autenticados sem entitlement não veem conteúdo de cursos pagos.
- Sidebar e área pública continuam renderizando com defaults institucionais para anônimos.
- Scanner deixa de listar os três findings.

---

## Riscos e Acompanhamento
- **Streaming SSR desativado**: aceito para estabilidade; reavaliar quando o wrapper for considerado maduro.
- **Node 22 na Vercel**: garantir que o projeto Vercel permita `nodejs22.x`.
- **Avisos remanescentes do scanner** (search_path, bucket público): pendentes; abrir tarefa específica se for prioridade.

---

## Próximos passos sugeridos
1. Reativar `supportsResponseStreaming: true` em ambiente de teste após 1–2 semanas estáveis.
2. Endurecer `search_path` das functions e revisar políticas de Storage.
3. Confirmar em `docs/deploy-vercel.md` que as variáveis e o runtime `nodejs22.x` estão documentados.
