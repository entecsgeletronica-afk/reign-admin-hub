# Deploy na Vercel — Guia para Alunos (Remix)

Este projeto roda no **Lovable** com Cloudflare Workers (preview). Para
publicar em produção na **Vercel** sem gastar créditos do Lovable, siga
este passo a passo. Tudo já está preparado — você só precisa clicar.

---

## 🚀 Passo 1 — Faça o Remix do projeto

1. No Lovable, clique em **Remix** (canto superior direito).
2. Aguarde o projeto duplicar para sua conta.

---

## 🗄️ Passo 2 — Crie seu Supabase próprio

> Você precisa de um Supabase próprio. **Não use o do professor.**

1. Acesse [supabase.com](https://supabase.com) → **New Project**.
2. Escolha região mais próxima (ex: `South America (São Paulo)`).
3. Defina senha forte para o banco (anote em local seguro).
4. Aguarde ~2 minutos até o projeto ficar verde.

### Restaurar o schema completo

1. No painel Supabase → **SQL Editor** → **New Query**.
2. Abra o arquivo [`docs/database/backup-sql.sql`](./database/backup-sql.sql)
   deste repositório.
3. Copie **TUDO** e cole no SQL Editor.
4. Clique **Run**. Aguarde "Success. No rows returned".

✅ Pronto. Todas as 47 migrations foram aplicadas, incluindo:
- Tabelas: `commercial_offers`, `user_product_entitlements`,
  `webhook_events`, `catalog_products`, `plans`, etc.
- Funções: `has_role`, `user_has_product_access`, `handle_new_user`.
- Storage buckets e suas policies.
- Trigger automático que cria `profiles` ao registrar usuário.

### Pegar suas chaves Supabase

No painel Supabase → **Project Settings → API**, anote:
- `Project URL` → será `VITE_SUPABASE_URL`
- `anon public` → será `VITE_SUPABASE_PUBLISHABLE_KEY`
- `service_role` (clique em "Reveal") → será `SUPABASE_SERVICE_ROLE_KEY`

Em **Project Settings → General**:
- `Reference ID` → será `VITE_SUPABASE_PROJECT_ID`

---

## ⚙️ Passo 3 — Atualize o cliente Supabase no código

Abra `src/integrations/supabase/client.ts` e substitua os valores
hardcoded pelas SUAS chaves:

```ts
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "SUA_ANON_KEY_AQUI";
```

> 💡 Faça isso direto no Lovable (1 mensagem só):
> _"Atualize src/integrations/supabase/client.ts com URL X e anon key Y"_

---

## 🌐 Passo 4 — Deploy na Vercel

### 4.1 — Conecte o GitHub
1. No Lovable → **GitHub** (topo direito) → **Connect to GitHub**.
2. Crie o repositório.

### 4.2 — Importe na Vercel
1. Acesse [vercel.com/new](https://vercel.com/new).
2. **Import Git Repository** → selecione seu repo recém-criado.
3. **Framework Preset**: deixe como `Other` (o `vercel.json` cuida do resto).
4. **Build Command**: `bun run build` (já configurado).
5. **Output Directory**: `.output/public` (já configurado).

### 4.3 — Variáveis de ambiente na Vercel

Em **Project Settings → Environment Variables**, adicione TODAS abaixo
(marcando Production, Preview e Development):

| Nome | Valor | Onde pegar |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase → Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGc...` (anon) | Supabase → Settings → API |
| `VITE_SUPABASE_PROJECT_ID` | `xxx` (ref id) | Supabase → Settings → General |
| `SUPABASE_URL` | mesmo do VITE_SUPABASE_URL | — |
| `SUPABASE_PUBLISHABLE_KEY` | mesmo do anon | — |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` (service_role) | Supabase → Settings → API |

> ⚠️ **NUNCA** coloque `SERVICE_ROLE_KEY` em variáveis começando com
> `VITE_`. Elas vazam para o navegador.

### 4.4 — Deploy
Clique **Deploy**. Em ~2 minutos seu app está no ar em
`https://seu-projeto.vercel.app`.

---

## 👤 Passo 5 — Crie o primeiro admin

1. Acesse `https://seu-projeto.vercel.app/admin/login`.
2. Clique **"Criar primeiro administrador"**.
3. Preencha nome/email/senha. Vira `owner` automaticamente.

> No Supabase → **Authentication → Providers → Email**, desligue
> **Confirm email** para entrar sem verificar inbox (em testes).

---

## 💳 Passo 6 — Webhook PerfectPay

1. No PerfectPay, configure o webhook apontando para:
   ```
   https://seu-projeto.vercel.app/api/public/perfectpay/webhook
   ```
2. No app → **Admin → Webhooks**, copie o token gerado e cole no
   PerfectPay.
3. Pronto. Compras aprovadas liberam automaticamente os produtos
   (cadeado some na área de membros).

---

## 🎨 Passo 7 — Customize sua marca

- **Admin → Branding**: logo, cores primárias.
- **Admin → Áreas**: textos da área de membros.
- **Admin → Catálogo**: cadastre seus produtos/cursos.

---

## ❓ Problemas comuns

**"Failed to load resource: 401"** ao logar
→ Você esqueceu `SUPABASE_PUBLISHABLE_KEY` no Vercel. Adicione e
**Redeploy**.

**Webhook não libera produto**
→ Confira em **Admin → Webhooks** se o token bate com o do PerfectPay.
Veja logs em `webhook_events` no Supabase.

**Email de cadastro não chega**
→ Supabase free manda só 4/hora. Em produção configure SMTP próprio em
**Supabase → Settings → Auth → SMTP**.

**Build falha na Vercel com "Failed to resolve import"**
→ Rode `bun install` localmente, faça commit do `bun.lockb` e push.

---

## ✅ Pronto!

Sua instância está 100% no ar, sem gastar créditos do Lovable para
operação normal. Use o Lovable só quando quiser **adicionar features**
ou **mudar UI**.
