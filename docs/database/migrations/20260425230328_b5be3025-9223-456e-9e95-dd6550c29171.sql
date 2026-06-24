DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.security_audit_logs;
CREATE POLICY "Authenticated can insert own audit logs"
  ON public.security_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
