CREATE TABLE IF NOT EXISTS public.access_resend_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  product_id uuid,
  order_id uuid,
  channel text NOT NULL DEFAULT 'email',
  recipient text,
  status text NOT NULL DEFAULT 'queued',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_resend_log_target_user ON public.access_resend_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_access_resend_log_created_at ON public.access_resend_log(created_at DESC);

ALTER TABLE public.access_resend_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view access resend log"
  ON public.access_resend_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert access resend log"
  ON public.access_resend_log
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND admin_user_id = auth.uid());