# Guia de Remix — passo a passo

Quando você fizer remix deste projeto na Lovable, siga estes passos para ter
uma instância 100% funcional com **um novo Supabase próprio**.

## 1. Conecte um novo Supabase

Na Lovable, abra o painel do Supabase no canto superior direito e:

1. Crie um novo projeto Supabase (ou conecte um existente vazio).
2. Confirme que `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
   apareceram em `.env`.
3. Só abra o Preview depois disso. Se o remix mostrar **Lovable proxy error
   (500)**, normalmente é porque o projeto remixado ainda está sem Supabase
   próprio/conectado ou sem essas variáveis no `.env`.

## 2. Restaure o schema completo

Você tem **duas opções equivalentes** — escolha uma.

### Opção A — script único (mais rápido)

1. Abra o **SQL Editor** no painel do Supabase.
2. Copie o conteúdo de [`database/backup-sql.sql`](./database/backup-sql.sql).
3. Cole e clique em **Run**. Isso aplica todas as 48 migrations em ordem.

### Opção B — migrations versionadas (mais auditável)

1. Aplique uma a uma os arquivos de [`database/migrations/`](./database/migrations/),
   em ordem alfabética (já estão prefixadas por timestamp).
2. Útil se você quer auditar cada mudança ou cortar fora alguma feature.

> Ambas as opções produzem **exatamente o mesmo banco final**. O
> `backup-sql.sql` é apenas a concatenação ordenada de tudo em
> `migrations/`.

## 3. Crie os Storage buckets

Veja [`database/storage_buckets.md`](./database/storage_buckets.md). A maioria
dos buckets já é criada via migration; confirme no painel **Storage** que
todos estão lá:

- `branding`, `story-covers`, `story-pages-lineart`,
  `story-pages-preview`, `story-pages-samples`, `avatars`,
  `email-assets`, `user-artworks`, `catalog-covers`, `ebook-files`.

## 4. Configure secrets / env

Veja [`database/secrets.md`](./database/secrets.md). Defina no novo Supabase:

- `LOVABLE_API_KEY` (se for usar Lovable AI Gateway)
- `STORY_SYNC_SERVICE_KEY` (chave interna para sync de páginas)
- `SUPABASE_SERVICE_ROLE_KEY` (já vem)
- Demais secrets são auto-populados.

## 5. Crie o primeiro admin

1. Abra `/admin/login` na sua instância.
2. O sistema oferece **"Criar primeiro administrador"** se nenhum admin
   existir.
3. Preencha nome/email/senha — vira `owner` automaticamente.

> Em **Authentication → Providers → Email**, desligue **Confirm email**
> para entrar sem precisar verificar caixa de entrada.

## 6. Configure o webhook do PerfectPay (opcional)

Se for processar pagamentos:

1. Em PerfectPay → Webhooks, aponte para:
   `https://SEU-PROJETO.lovable.app/api/public/perfectpay/webhook`
2. Configure o token em **Admin → Webhooks** do app.

## 7. Customize sua marca

Em **Admin → Branding** e **Admin → Áreas**, ajuste cores, logo, copy.

## 8. Emails (recuperação de senha & compra aprovada)

✅ **Não precisa configurar nada** — o Supabase já dispara emails nativos
automaticamente:

- **Recuperação de senha**: já funciona via tela de login (`/login` e
  `/admin/login`). O usuário clica em "Esqueci minha senha", digita o
  email e recebe o link.
- **Cadastro de novo usuário**: quando o webhook do PerfectPay aprova
  uma compra, o usuário é criado e recebe email com login.

### Limites do email nativo

- Supabase manda até **4 emails/hora** no plano free (suficiente para
  testes).
- Remetente padrão: `noreply@mail.supabase.io` (não personalizável).

### Quando quiser personalizar (produção real)

1. **Customize templates** em **Supabase Dashboard → Authentication →
   Email Templates**: edite HTML dos emails de "Reset Password",
   "Confirm Signup", "Magic Link" com sua marca.
2. **Use SMTP próprio** (sem limite + remetente personalizado): em
   **Supabase Dashboard → Project Settings → Auth → SMTP Settings**,
   cole credenciais de qualquer provedor (Gmail, Resend, Brevo,
   SendGrid, Mailgun). Nada muda no código — Supabase passa a usar
   seu SMTP automaticamente.

> 💡 Para começar, deixe nativo. Quando passar de 4 emails/hora, ative
> SMTP customizado em 2 minutos no painel.

---

## Pronto 🎉

Sua instância está espelhando 100% deste projeto base. Todos os recursos
(catálogo, áreas de membros, ofertas, planos, ebooks, cursos, desenhos,
templates de email, dashboard) já funcionam.
