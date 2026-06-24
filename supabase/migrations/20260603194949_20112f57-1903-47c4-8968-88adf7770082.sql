
-- 1) commercial_offers: hide token column from authenticated role (column-level)
REVOKE SELECT (token) ON public.commercial_offers FROM authenticated;
-- service_role retains full access; admins can still read all other columns;
-- super_admins read token via public.get_commercial_offer_token().

-- 2) email_outbox: restrict to super_admin (contains PII + email bodies)
DROP POLICY IF EXISTS "Admins manage email outbox" ON public.email_outbox;
CREATE POLICY "Super admins manage email outbox"
ON public.email_outbox
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 3) user_roles: prevent admin self-escalation by restricting writes to super_admin
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Super admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
