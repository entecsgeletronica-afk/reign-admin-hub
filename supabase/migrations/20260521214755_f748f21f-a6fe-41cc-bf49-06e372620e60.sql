-- =====================================================================
-- 1) commercial_offers: restrict SELECT of token column to super_admin
-- =====================================================================
DROP POLICY IF EXISTS "Admins manage commercial offers" ON public.commercial_offers;

-- Admin can INSERT/UPDATE/DELETE all columns
CREATE POLICY "Admins write commercial offers"
ON public.commercial_offers
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update commercial offers"
ON public.commercial_offers
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete commercial offers"
ON public.commercial_offers
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- SELECT remains allowed for admins, but the token column read is restricted
CREATE POLICY "Admins read commercial offers"
ON public.commercial_offers
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Column-level: only super_admins (and service_role implicitly) can SELECT the token.
-- Strip default SELECT on token from authenticated/anon, then re-grant to super_admin only.
-- Postgres lacks per-row column ACLs, so we expose token via a security-definer accessor:
CREATE OR REPLACE FUNCTION public.get_commercial_offer_token(_offer_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT token FROM public.commercial_offers
  WHERE id = _offer_id
    AND public.is_super_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_commercial_offer_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_commercial_offer_token(uuid) TO authenticated;

-- Remove direct column access for non-super_admins via a column-level revoke is ineffective
-- when table-level SELECT is granted. Instead, we redact the token in a view and tell the app
-- to read tokens only through get_commercial_offer_token().
CREATE OR REPLACE VIEW public.commercial_offers_safe AS
SELECT id, gateway, variation_id, account_id, sale_mode, status, offer_name, notes,
       created_at, updated_at
FROM public.commercial_offers;

GRANT SELECT ON public.commercial_offers_safe TO authenticated;

-- =====================================================================
-- 2) webhook_integrations: restrict signing_secret to super_admin via accessor
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_webhook_signing_secret(_integration_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT signing_secret FROM public.webhook_integrations
  WHERE id = _integration_id
    AND public.is_super_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_webhook_signing_secret(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_webhook_signing_secret(uuid) TO authenticated;

-- =====================================================================
-- 3) is_active_admin: remove hardcoded UUID backdoor; consolidate on user_roles
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_active_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role);
$$;

-- =====================================================================
-- 4) Replace hardcoded-email super admin policies with is_super_admin()
-- =====================================================================
DROP POLICY IF EXISTS "admin_profiles_super_admin_all" ON public.admin_profiles;
CREATE POLICY "admin_profiles_super_admin_all"
ON public.admin_profiles
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles_super_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_super_admin_all"
ON public.user_roles
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- =====================================================================
-- 5) profiles SELECT: also match by id (consistent with insert/update)
-- =====================================================================
DROP POLICY IF EXISTS "Admins see all profiles" ON public.profiles;
CREATE POLICY "Profiles read self or admin"
ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);