# Supabase setup — Reino das Cores Admin

Este projeto **não usa Lovable Cloud**. Toda a base administrativa roda no
seu próprio Supabase, conectado via connector nativo da Lovable.

## 1. Conectar o Supabase na Lovable

No projeto Lovable:

1. Abra **Connectors → Supabase**.
2. Conecte ou crie uma conexão com o seu projeto Supabase.
3. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam
   automaticamente disponíveis no app.

Enquanto o connector não está ligado, o painel mostra um banner de
**modo demonstração** com mocks zerados — a UI continua funcionando.

## 2. Rodar o schema inicial

No painel do Supabase:

1. Abra **SQL Editor → New query**.
2. Cole o conteúdo de [`0001_init.sql`](./0001_init.sql).
3. Clique em **Run**.

Cria:

- `admin_profiles` + função `is_active_admin()` (security definer)
- Tabelas de dashboard (`dashboard_kpis`, `dashboard_series`,
  `subscription_status_summary`, `top_plans_summary`,
  `monthly_recurring_summary`)
- RLS habilitado em tudo, com policies que só liberam acesso para
  admins ativos
- Seeds zerados para `period_key = '30d'`

## 3. Criar o primeiro administrador

Abra `/admin/login` no app. Como ainda não existe nenhum admin no banco,
o app oferece um modo **"Criar primeiro administrador"**: preencha nome,
e-mail e senha — isso faz `auth.signUp` e insere a linha em
`admin_profiles` com role `owner` e `is_active = true`.

> A policy de bootstrap permite **apenas o primeiro insert**. Depois
> disso, novos admins só podem ser criados por administradores ativos.

Para o admin de teste do PRD, use:

- **email**: `ericvinicius1987@gmail.com`
- **senha**: `12345678`

> Ative **Confirm email = OFF** em **Auth → Providers → Email** para
> entrar imediatamente sem precisar abrir o e-mail de confirmação.

## 4. Próximos passos

As rotas `/admin/usuarios`, `/admin/relatorios`, `/admin/branding`,
`/admin/templates`, `/admin/qa-capas`, `/admin/idiomas`,
`/admin/webhooks`, `/admin/ver-como-usuario` já estão estruturadas como
stubs prontos para receber implementação nas próximas fases.
