# Banco de dados — Supabase

## Arquivos

- **`backup-sql.sql`** — backup SQL completo, restaurável de uma vez.
  É a concatenação de todas as migrations em ordem cronológica.
- **`migrations/`** — todas as migrations versionadas (47 no total).
  Cada migration tem timestamp `YYYYMMDDHHMMSS_<uuid>.sql`.
- **`tables.md`** — catálogo de tabelas e propósito de cada uma.
- **`functions.md`** — funções PL/pgSQL e triggers.
- **`storage_buckets.md`** — buckets de Storage e políticas.
- **`secrets.md`** — secrets/variáveis de ambiente.

## Como restaurar do zero

### Em um Supabase novo e vazio

```sql
-- 1. Abra SQL Editor → New query
-- 2. Cole TODO o conteúdo de backup-sql.sql
-- 3. Run
```

Isso cria:

- ✅ Todas as 51 tabelas em `public`
- ✅ Enum `app_role` (`admin`, `moderator`, `user`, `super_admin`)
- ✅ Todas as RLS policies
- ✅ Todas as funções (`has_role`, `is_super_admin`,
  `user_has_product_access`, `update_updated_at_column`,
  `handle_new_user_profile`, `handle_seed_admin`,
  `handle_seed_super_admin`, `enforce_single_primary_member_area`)
- ✅ Triggers de timestamp e seed de admin
- ✅ Storage buckets (`branding`, `catalog-covers`, `ebook-files`, etc.)
- ✅ Seeds zerados de dashboard

### Verificar que deu certo

```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema='public';
-- Esperado: 51

SELECT count(*) FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public';
-- Esperado: 8 funções + (triggers automáticos do Supabase)
```

## Convenções

- **RLS sempre ligada** em tabelas de `public`.
- **Roles ficam em tabela separada** (`user_roles`), nunca em `profiles`.
  Use a função `has_role(uid, role)` (security definer) nas policies.
- **Timestamps**: `created_at` e `updated_at` com trigger
  `update_updated_at_column()`.
- **Multi-área**: tudo escopado por `variation_id`
  (FK → `member_area_variations`).
- **Pagamentos**: `commercial_offers` + `commercial_offer_products` +
  `user_orders` + `user_product_entitlements`.

## Próximas migrations

Sempre crie via **migration tool** da Lovable, nunca rode SQL ad-hoc no
painel do Supabase. Isso garante que `migrations/` e `backup-sql.sql`
permaneçam a fonte da verdade para futuros remixes.

> Após cada nova migration aprovada, atualize `backup-sql.sql`
> rodando: `cat migrations/*.sql > backup-sql.sql` (ordem cronológica
> já é garantida pelo prefixo de timestamp).
