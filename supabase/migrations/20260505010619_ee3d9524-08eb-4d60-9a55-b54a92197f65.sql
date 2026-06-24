
-- 1. protected_settings: remover SELECT amplo
DROP POLICY IF EXISTS "Authenticated can view protected settings" ON public.protected_settings;

-- 2. webhook_integrations.signing_secret: revogar leitura via cliente
REVOKE SELECT (signing_secret) ON public.webhook_integrations FROM anon, authenticated;

-- 3. user_has_product_access: remover bypass de is_locked
CREATE OR REPLACE FUNCTION public.user_has_product_access(_user_id uuid, _product_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_product_entitlements
    WHERE user_id = _user_id
      AND product_id = _product_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  )
  OR public.has_role(_user_id, 'admin'::public.app_role);
$function$;

-- 4. Fixar search_path em funções sem SET search_path
CREATE OR REPLACE FUNCTION public.profiles_sync_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- 5. Revogar EXECUTE de triggers sensíveis (continuam rodando como triggers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_seed_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_seed_super_admin() FROM PUBLIC, anon, authenticated;
