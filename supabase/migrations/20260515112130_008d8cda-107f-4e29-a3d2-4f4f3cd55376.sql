
-- 1) webhook_integrations: hide signing_secret from authenticated/anon
REVOKE SELECT (signing_secret) ON public.webhook_integrations FROM anon, authenticated;
REVOKE UPDATE (signing_secret), INSERT (signing_secret) ON public.webhook_integrations FROM anon, authenticated;

-- 2) commercial_offers: hide token from authenticated/anon
REVOKE SELECT (token) ON public.commercial_offers FROM anon, authenticated;
REVOKE UPDATE (token), INSERT (token) ON public.commercial_offers FROM anon, authenticated;

-- 3) email_outbox: restrict to super_admin only
DROP POLICY IF EXISTS "Admins manage email outbox" ON public.email_outbox;
CREATE POLICY "Super admins manage email outbox"
ON public.email_outbox
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 4) profiles: add INSERT policy scoped to auth.uid() = id
CREATE POLICY "Users insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
