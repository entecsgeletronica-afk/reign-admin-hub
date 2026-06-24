# Secrets / Variáveis de ambiente

## Auto-populadas pela Lovable (não precisa configurar)

Estas vêm automaticamente quando o Supabase é conectado:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key)
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL` (server-side)
- `SUPABASE_SERVICE_ROLE_KEY` (server-side, **nunca exponha no front**)
- `SUPABASE_DB_URL`

## Configurar manualmente (Supabase → Settings → Functions → Secrets)

| Secret | Obrigatório | Uso |
|---|---|---|
| `LOVABLE_API_KEY` | Opcional | Lovable AI Gateway (geração de capas, etc.) |
| `STORY_SYNC_SERVICE_KEY` | Opcional | Token interno para `scripts/sync-story-pages.mjs` (sync de páginas) |

## Webhook PerfectPay

O token do webhook NÃO é um secret — é configurado por área de membro
em **Admin → Webhooks** e fica em `webhook_integrations.token`.

## Regras de segurança

- ❌ Nunca commite `.env` com valores reais.
- ❌ Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- ✅ Use `Deno.env.get('NOME')` em edge functions.
- ✅ Use `import.meta.env.VITE_*` no frontend (apenas variáveis seguras).
