CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL DEFAULT 'access_granted',
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  user_id uuid,
  offer_id uuid,
  variation_id uuid,
  external_order_id text,
  product_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  area_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status_created
  ON public.email_outbox (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_outbox_recipient
  ON public.email_outbox (recipient_email);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email outbox"
  ON public.email_outbox
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_email_outbox_updated_at ON public.email_outbox;
CREATE TRIGGER trg_email_outbox_updated_at
  BEFORE UPDATE ON public.email_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();