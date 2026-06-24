-- Remove a policy permissiva atual (USING true para qualquer authenticated)
DROP POLICY IF EXISTS "Authenticated users can view protected settings" ON public.protected_settings;

-- Cria policy restrita: apenas super admins podem ler
CREATE POLICY "Super admins can view protected settings"
ON public.protected_settings
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));