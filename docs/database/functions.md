# Funções SQL e Triggers

Todas restauradas automaticamente via `backup-sql.sql`.

## Funções (schema `public`)

### `has_role(_user_id uuid, _role app_role) → boolean`
Security definer. Verifica se o usuário tem uma role na tabela
`user_roles`. Usada em quase todas as RLS policies.

### `is_super_admin(_user_id uuid) → boolean`
Security definer. Atalho para `has_role(uid, 'super_admin')`.

### `user_has_product_access(_user_id uuid, _product_id uuid) → boolean`
Security definer. Retorna true se:
1. Existe entitlement ativo (não expirado) em `user_product_entitlements`, OU
2. O produto é `is_locked = false` (público), OU
3. O usuário é admin.

### `update_updated_at_column() → trigger`
Atualiza `NEW.updated_at = now()` antes de qualquer UPDATE.
Anexada como `BEFORE UPDATE` em todas as tabelas com `updated_at`.

### `handle_new_user_profile() → trigger`
Trigger `AFTER INSERT ON auth.users`. Cria automaticamente uma linha
em `public.profiles` com `display_name` e `purchase_email`.

### `handle_seed_admin() → trigger`
Trigger `AFTER INSERT ON auth.users`. Se o email do novo usuário bater
com `app_settings_kv.seed_admin_email`, concede role `admin`.

### `handle_seed_super_admin() → trigger`
Trigger `AFTER INSERT ON auth.users`. Se o email for
`ericvinicius1@hotmail.com`, concede role `super_admin`. **Edite este
valor** ao remixar para outro owner.

### `enforce_single_primary_member_area() → trigger`
Trigger `BEFORE INSERT/UPDATE ON member_area_variations`. Garante que
cada `account_id` tenha no máximo uma área marcada `is_primary = true`.

## Padrão para novas funções

```sql
CREATE OR REPLACE FUNCTION public.minha_funcao(_arg uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ...
$$;
```

> **Sempre** inclua `SET search_path = public` em funções
> security-definer. Sem isso, há risco de injeção via search_path.
