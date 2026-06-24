-- Add 'subscription_active' duration support: when set, access lifetime
-- mirrors the subscription state and is revoked on cancel/refund/chargeback.
-- We don't add a CHECK because the column is currently a free text column.
COMMENT ON COLUMN public.commercial_offer_products.access_duration_type IS
  'lifetime | days | custom | subscription_active. When subscription_active, expires_at follows subscriptions.current_period_end and is revoked when subscription becomes inactive.';

-- Index that helps the webhook revoke entitlements tied to a subscription quickly.
CREATE INDEX IF NOT EXISTS idx_user_product_entitlements_user_status
  ON public.user_product_entitlements (user_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_external_subscription_id
  ON public.subscriptions (external_subscription_id);