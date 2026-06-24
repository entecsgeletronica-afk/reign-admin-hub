// PerfectPay webhook receiver — fluxo oficial conforme documentação
// https://help.perfectpay.com.br/article/597-integracao-via-webhook-com-a-perfect-pay
//
// Mapeia o payload real da PerfectPay (sale_status_enum numérico, plan.code,
// product.code, customer.full_name/email/phone, currency_enum) e libera os
// produtos vinculados a uma `commercial_offers` cuja `commercial_offer_codes`
// case com plan.code OU product.code.
//
// Mantém compatibilidade com `plan_product_grants` legado e `required_plan_codes`.
//
// IMPORTANT: keep this under /api/public/* so it's not behind auth on
// published sites.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface PerfectPayCustomer {
  full_name?: string | null;
  email?: string | null;
  identification_number?: string | null;
  identification_type?: string | null;
  phone_area_code?: string | null;
  phone_number?: string | null;
  customer_type_enum?: number | null;
}

interface PerfectPayProduct {
  code?: string | null;
  name?: string | null;
  external_reference?: string | null;
}

interface PerfectPayPlan {
  code?: string | null;
  name?: string | null;
  quantity?: number | null;
}

interface PerfectPaySubscription {
  code?: string | null;
  status?: string | null;
  next_charge_date?: string | null;
}

interface PerfectPayPayload {
  token?: string | null;
  // Numeric per docs (0..16). We accept string too for resilience.
  sale_status_enum?: number | string | null;
  sale_status?: string | null;
  sale_status_detail?: string | null;
  code?: string | null; // sale id (PPCPMTB58MNF4E)
  sale_amount?: number | null;
  currency_enum?: number | null;
  installments?: number | null;
  date_created?: string | null;
  date_approved?: string | null;
  customer?: PerfectPayCustomer | null;
  product?: PerfectPayProduct | null;
  plan?: PerfectPayPlan | null;
  subscription?: PerfectPaySubscription | null;
  webhook_owner?: string | null;
  // Legacy / compat fields
  payment?: { amount?: number | null; currency?: string | null } | null;
  event_id?: string | null;
  [key: string]: unknown;
}

// sale_status_enum values per official docs
const SALE_STATUS: Record<number, string> = {
  0: "none",
  1: "pending",
  2: "approved",
  3: "in_process",
  4: "in_mediation",
  5: "rejected",
  6: "cancelled",
  7: "refunded",
  8: "authorized",
  9: "charged_back",
  10: "completed",
  11: "checkout_error",
  12: "precheckout",
  13: "expired",
  16: "in_review",
};

const APPROVED_STATUSES = new Set(["approved", "completed", "authorized"]);
const REVOKE_STATUSES = new Set([
  "refunded",
  "chargeback",
  "charged_back",
  "canceled",
  "cancelled",
  "expired",
  "rejected",
]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Normalize sale_status_enum (number per docs) into a stable string. */
function normalizeStatus(payload: PerfectPayPayload): string {
  const raw = payload.sale_status_enum;
  if (typeof raw === "number" && SALE_STATUS[raw]) return SALE_STATUS[raw];
  if (typeof raw === "string" && raw.trim()) {
    // PerfectPay can also send the string form in some test calls
    const lower = raw.toLowerCase().trim();
    if (Object.values(SALE_STATUS).includes(lower)) return lower;
    // numeric string
    const asNum = Number(raw);
    if (!Number.isNaN(asNum) && SALE_STATUS[asNum]) return SALE_STATUS[asNum];
  }
  if (typeof payload.sale_status === "string" && payload.sale_status.trim()) {
    return payload.sale_status.toLowerCase().trim();
  }
  return "unknown";
}

function normalizeCurrency(payload: PerfectPayPayload): string {
  if (payload.currency_enum === 1) return "BRL";
  if (payload.payment?.currency) return payload.payment.currency;
  return "BRL";
}

function normalizeAmountCents(payload: PerfectPayPayload): number {
  const value =
    typeof payload.sale_amount === "number"
      ? payload.sale_amount
      : typeof payload.payment?.amount === "number"
        ? payload.payment.amount
        : 0;
  return Math.round(value * 100);
}

async function getStoredToken(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("app_settings_kv")
    .select("value_json")
    .eq("key", "perfectpay_token")
    .maybeSingle();
  if (!data) return null;
  const raw = (data as { value_json: unknown }).value_json;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "token" in raw) {
    const t = (raw as { token?: unknown }).token;
    return typeof t === "string" ? t : null;
  }
  return null;
}

async function logEvent(args: {
  payload: unknown;
  status: "ok" | "invalid";
  reason?: string | null;
  externalId?: string | null;
  eventType?: string | null;
  errorMessage?: string | null;
}) {
  await supabaseAdmin.from("webhook_events").insert({
    provider: "perfectpay",
    payload: args.payload as never,
    status: args.status,
    reason: args.reason ?? null,
    external_event_id: args.externalId ?? null,
    event_type: args.eventType ?? null,
    processed: args.status === "ok",
    error_message: args.errorMessage ?? null,
  } as never);
}

async function isDuplicateEvent(externalId: string | null, status: string): Promise<boolean> {
  if (!externalId) return false;
  // We consider the same sale code + same status as duplicate. PerfectPay can
  // legitimately re-send (approved -> refunded), so we key idempotency by
  // (external_event_id, event_type).
  const { data } = await supabaseAdmin
    .from("webhook_events")
    .select("id")
    .eq("provider", "perfectpay")
    .eq("external_event_id", externalId)
    .eq("event_type", status)
    .eq("status", "ok")
    .eq("processed", true)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

interface CreatedUserResult {
  userId: string;
  /** Senha em texto plano gerada APENAS quando o usuário é novo. Null se já existia. */
  generatedPassword: string | null;
}

function generateFriendlyPassword(): string {
  // 10 chars: letras + números, sem caracteres ambíguos. Fácil de digitar/colar.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const buf = new Uint8Array(10);
  crypto.getRandomValues(buf);
  for (let i = 0; i < buf.length; i++) {
    out += chars[buf[i] % chars.length];
  }
  return out;
}

async function findOrCreateUserByEmail(
  email: string,
  fullName: string | null,
  phone: string | null,
): Promise<CreatedUserResult | null> {
  // Try to find existing user via auth admin listUsers
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const found = existing?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (found) {
    // touch profile
    await supabaseAdmin
      .from("profiles")
      .update({
        ...(fullName ? { display_name: fullName } : {}),
        ...(phone ? { phone } : {}),
        purchase_email: email,
      } as never)
      .eq("user_id", found.id);
    return { userId: found.id, generatedPassword: null };
  }

  const newPassword = generateFriendlyPassword();
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: newPassword,
    email_confirm: true,
    user_metadata: {
      source: "perfectpay_webhook",
      ...(fullName ? { display_name: fullName } : {}),
    },
  });
  if (error || !created.user) return null;

  // best-effort profile update with phone
  if (phone || fullName) {
    await supabaseAdmin
      .from("profiles")
      .update({
        ...(fullName ? { display_name: fullName } : {}),
        ...(phone ? { phone } : {}),
        purchase_email: email,
      } as never)
      .eq("user_id", created.user.id);
  }
  return { userId: created.user.id, generatedPassword: newPassword };
}

interface ResolvedOffer {
  offer_id: string;
  variation_id: string;
  products: Array<{
    product_id: string;
    access_duration_type: string;
    access_duration_days: number | null;
  }>;
}

/**
 * Find every commercial offer whose codes table contains either the plan code
 * or the product code from the webhook. Returns the products to release for
 * each matched offer (the same code may live in multiple offers).
 */
async function resolveOffersByCodes(
  candidateCodes: string[],
): Promise<ResolvedOffer[]> {
  if (candidateCodes.length === 0) return [];

  const { data: codeRows, error: codeErr } = await supabaseAdmin
    .from("commercial_offer_codes")
    .select("offer_id, code")
    .in("code", candidateCodes);
  if (codeErr || !codeRows || codeRows.length === 0) return [];

  const offerIds = Array.from(
    new Set((codeRows as Array<{ offer_id: string }>).map((r) => r.offer_id)),
  );

  const { data: offers, error: offerErr } = await supabaseAdmin
    .from("commercial_offers")
    .select("id, variation_id, status")
    .in("id", offerIds)
    .eq("status", "active");
  if (offerErr || !offers || offers.length === 0) return [];

  const { data: offerProducts, error: prodErr } = await supabaseAdmin
    .from("commercial_offer_products")
    .select("offer_id, product_id, access_duration_type, access_duration_days")
    .in("offer_id", offerIds);
  if (prodErr) return [];

  return (offers as Array<{ id: string; variation_id: string }>).map((o) => ({
    offer_id: o.id,
    variation_id: o.variation_id,
    products: ((offerProducts ?? []) as Array<{
      offer_id: string;
      product_id: string;
      access_duration_type: string;
      access_duration_days: number | null;
    }>)
      .filter((p) => p.offer_id === o.id)
      .map((p) => ({
        product_id: p.product_id,
        access_duration_type: p.access_duration_type,
        access_duration_days: p.access_duration_days,
      })),
  }));
}

/**
 * Legacy fallback: also resolve products via plan_product_grants (plan id)
 * and catalog_products.required_plan_codes (plan code). This keeps existing
 * configurations working while accounts migrate to commercial offers.
 */
async function resolveLegacyProductIds(
  planId: string | null,
  planCode: string | null,
): Promise<string[]> {
  const productIds = new Set<string>();
  if (planId) {
    const { data: grants } = await supabaseAdmin
      .from("plan_product_grants")
      .select("product_id")
      .eq("plan_id", planId);
    (grants ?? []).forEach((g) =>
      productIds.add((g as { product_id: string }).product_id),
    );
  }
  if (planCode) {
    const { data: byCode } = await supabaseAdmin
      .from("catalog_products")
      .select("id")
      .contains("required_plan_codes", [planCode] as never);
    (byCode ?? []).forEach((p) => productIds.add((p as { id: string }).id));
  }
  return Array.from(productIds);
}

function expiryFromDuration(
  type: string,
  days: number | null,
  subscriptionPeriodEnd: string | null,
): string | null {
  if (type === "lifetime" || type === "custom") return null;
  if (type === "days" && days && days > 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
  }
  if (type === "subscription_active") {
    // Mirror the subscription expiry — null means "until further notice"
    return subscriptionPeriodEnd ?? null;
  }
  return null;
}

// ---------- Outbox enqueue ----------
async function buildAreaUrl(
  variationId: string | null,
  request: Request,
): Promise<string> {
  const origin = (() => {
    try {
      return new URL(request.url).origin;
    } catch {
      return "";
    }
  })();
  if (!variationId) return origin || "/";

  const { data: domain } = await supabaseAdmin
    .from("member_area_domains")
    .select("full_domain, status")
    .eq("member_area_id", variationId)
    .eq("is_primary", true)
    .maybeSingle();
  const fd = (domain as { full_domain?: string; status?: string } | null)?.full_domain;
  if (fd) return `https://${fd}`;
  return origin ? `${origin}/?variation=${variationId}` : `/?variation=${variationId}`;
}

async function enqueueAccessGrantedEmail(args: {
  recipientEmail: string;
  recipientName: string | null;
  userId: string;
  offerId: string | null;
  variationId: string | null;
  externalOrderId: string | null;
  productIds: string[];
  /** Senha gerada (apenas para usuário NOVO). Quando null, o e-mail só inclui o login. */
  generatedPassword: string | null;
  request: Request;
}): Promise<void> {
  if (args.productIds.length === 0) return;

  // Look up product titles for the email body
  const { data: products } = await supabaseAdmin
    .from("catalog_products")
    .select("id, title")
    .in("id", args.productIds);
  const productList =
    (products ?? []) as Array<{ id: string; title: string }>;
  const productTitles = productList.map((p) => p.title);

  const areaUrl = await buildAreaUrl(args.variationId, args.request);

  // Lê o e-mail principal salvo pelo admin (Templates → Endereço de contato e resposta).
  // Esse endereço é o "remetente visível / contato / reply-to" responsável por
  // todos os disparos transacionais (compra aprovada e recuperação de senha).
  const { data: appSettings } = await supabaseAdmin
    .from("app_settings")
    .select("sender_name, sender_email")
    .maybeSingle();
  const senderName =
    ((appSettings as { sender_name?: string | null } | null)?.sender_name ?? "").trim() ||
    "Equipe de Suporte";
  const senderEmail =
    ((appSettings as { sender_email?: string | null } | null)?.sender_email ?? "").trim() ||
    null;

  const safeName = args.recipientName?.trim() || "Olá";
  const productLi = productTitles.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  const subject = "Sua compra foi aprovada — acesso liberado";

  const credentialsHtml = args.generatedPassword
    ? `
    <div style="margin:24px 0;padding:18px 20px;background:#f6f7f9;border:1px solid #e5e7eb;border-radius:12px;">
      <p style="color:#111;font-size:14px;font-weight:600;margin:0 0 10px;">🔑 Seus dados de acesso</p>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 6px;">
        <strong>Login:</strong> ${escapeHtml(args.recipientEmail)}
      </p>
      <p style="color:#444;font-size:14px;line-height:1.6;margin:0;">
        <strong>Senha:</strong> <code style="background:#fff;padding:2px 8px;border:1px solid #e5e7eb;border-radius:6px;font-family:monospace;font-size:13px;">${escapeHtml(args.generatedPassword)}</code>
      </p>
      <p style="color:#666;font-size:12px;line-height:1.5;margin:10px 0 0;">
        Recomendamos alterar a senha após o primeiro acesso.
      </p>
    </div>`
    : `
    <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px;">
      Você já tem cadastro conosco. Use o login <strong>${escapeHtml(args.recipientEmail)}</strong> e sua senha habitual para acessar.
    </p>`;

  const signatureHtml = senderEmail
    ? `
    <p style="color:#888;font-size:12px;line-height:1.6;margin:24px 0 0;">
      Em caso de dúvidas, responda este e-mail ou escreva para
      <a href="mailto:${escapeHtml(senderEmail)}" style="color:#111;text-decoration:underline;">${escapeHtml(senderEmail)}</a>.
    </p>
    <p style="color:#888;font-size:12px;line-height:1.6;margin:6px 0 0;">
      — ${escapeHtml(senderName)}
    </p>`
    : `
    <p style="color:#888;font-size:12px;line-height:1.6;margin:24px 0 0;">
      Em caso de dúvidas, entre em contato com o suporte.
    </p>`;

  const bodyHtml = `
<!doctype html>
<html><body style="font-family: Arial, Helvetica, sans-serif; background:#ffffff; margin:0; padding:24px;">
  <div style="max-width:560px;margin:0 auto;border:1px solid #eaeaea;border-radius:16px;padding:32px;background:#ffffff;">
    <h1 style="font-size:22px;color:#111;margin:0 0 16px;">${escapeHtml(safeName)}, sua compra foi aprovada! 🎉</h1>
    <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px;">
      O conteúdo já está liberado na sua área de membros.
    </p>
    ${credentialsHtml}
    <p style="margin:24px 0;">
      <a href="${escapeHtml(areaUrl)}" style="background:#111;color:#fff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:600;display:inline-block;">
        Acessar área de membros
      </a>
    </p>
    <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 8px;"><strong>Produtos liberados:</strong></p>
    <ul style="color:#444;font-size:14px;line-height:1.6;padding-left:20px;margin:0 0 24px;">
      ${productLi}
    </ul>
    ${signatureHtml}
  </div>
</body></html>`.trim();

  const credentialsText = args.generatedPassword
    ? `Seus dados de acesso:\n  Login: ${args.recipientEmail}\n  Senha: ${args.generatedPassword}\n(Recomendamos alterar a senha após o primeiro acesso.)\n\n`
    : `Use o login ${args.recipientEmail} e sua senha habitual para acessar.\n\n`;

  const signatureText = senderEmail
    ? `\n\nEm caso de dúvidas, responda este e-mail ou escreva para ${senderEmail}.\n— ${senderName}`
    : `\n\nEm caso de dúvidas, entre em contato com o suporte.`;

  const bodyText =
    `${safeName}, sua compra foi aprovada!\n\n` +
    credentialsText +
    `Acesse a área de membros: ${areaUrl}\n\n` +
    `Produtos liberados:\n${productTitles.map((t) => `- ${t}`).join("\n")}` +
    signatureText;

  await supabaseAdmin.from("email_outbox").insert({
    template_key: "access_granted",
    recipient_email: args.recipientEmail,
    recipient_name: args.recipientName,
    subject,
    body_html: bodyHtml,
    body_text: bodyText,
    status: "pending",
    user_id: args.userId,
    offer_id: args.offerId,
    variation_id: args.variationId,
    external_order_id: args.externalOrderId,
    product_ids: args.productIds as never,
    area_url: areaUrl,
    metadata: {
      provider: "perfectpay",
      sender_name: senderName,
      sender_email: senderEmail,
      reply_to: senderEmail,
      includes_credentials: Boolean(args.generatedPassword),
    } as never,
  } as never);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function grantEntitlements(args: {
  userId: string;
  products: Array<{
    product_id: string;
    access_duration_type: string;
    access_duration_days: number | null;
  }>;
  externalSaleId: string | null;
  subscriptionPeriodEnd: string | null;
}): Promise<number> {
  if (args.products.length === 0) return 0;
  const rows = args.products.map((p) => ({
    user_id: args.userId,
    product_id: p.product_id,
    source_type: "purchase",
    status: "active",
    granted_at: new Date().toISOString(),
    expires_at: expiryFromDuration(
      p.access_duration_type,
      p.access_duration_days,
      args.subscriptionPeriodEnd,
    ),
    external_purchase_id: args.externalSaleId,
  }));
  const { error } = await supabaseAdmin
    .from("user_product_entitlements")
    .upsert(rows as never, {
      onConflict: "user_id,product_id",
      ignoreDuplicates: false,
    } as never);
  if (error) {
    console.error("[webhook] grant entitlements failed:", error);
    return 0;
  }
  return rows.length;
}

async function grantLegacyEntitlements(args: {
  userId: string;
  productIds: string[];
  externalSaleId: string | null;
}): Promise<number> {
  if (args.productIds.length === 0) return 0;
  const rows = args.productIds.map((product_id) => ({
    user_id: args.userId,
    product_id,
    source_type: "purchase",
    status: "active",
    granted_at: new Date().toISOString(),
    external_purchase_id: args.externalSaleId,
  }));
  const { error } = await supabaseAdmin
    .from("user_product_entitlements")
    .upsert(rows as never, {
      onConflict: "user_id,product_id",
      ignoreDuplicates: false,
    } as never);
  if (error) return 0;
  return rows.length;
}

async function revokeEntitlements(args: {
  userId: string;
  productIds: string[];
  newStatus: "refunded" | "expired";
  reason: string;
}): Promise<number> {
  if (args.productIds.length === 0) return 0;
  const { error, count } = await supabaseAdmin
    .from("user_product_entitlements")
    .update(
      {
        status: args.newStatus,
        updated_at: new Date().toISOString(),
      } as never,
      { count: "exact" },
    )
    .eq("user_id", args.userId)
    .in("product_id", args.productIds);
  if (error) {
    console.error("[webhook] revoke entitlements failed:", error);
    return 0;
  }
  void args.reason;
  return count ?? 0;
}

async function upsertSubscription(args: {
  userId: string;
  planId: string | null;
  email: string;
  amountCents: number;
  currency: string;
  externalSubId: string | null;
  status: string;
  canceledAt?: string | null;
}) {
  if (!args.externalSubId) return;
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        user_id: args.userId,
        plan_id: args.planId,
        provider: "perfectpay",
        external_subscription_id: args.externalSubId,
        customer_email: args.email,
        amount_cents: args.amountCents,
        currency: args.currency,
        status: args.status,
        started_at: args.status === "active" ? new Date().toISOString() : null,
        canceled_at: args.canceledAt ?? null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "external_subscription_id" } as never,
    );
  if (error) console.error("[webhook] upsert subscription failed:", error);
}

async function recordOrder(args: {
  userId: string;
  planId: string | null;
  externalOrderId: string | null;
  amountCents: number;
  currency: string;
  status: "approved" | "refunded" | "canceled";
  approvedAt?: string | null;
  refundedAt?: string | null;
}) {
  if (!args.externalOrderId) return;
  const { error } = await supabaseAdmin
    .from("user_orders")
    .upsert(
      {
        user_id: args.userId,
        plan_id: args.planId,
        payment_provider: "perfectpay",
        external_order_id: args.externalOrderId,
        order_number: args.externalOrderId,
        amount_cents: args.amountCents,
        currency: args.currency,
        purchase_status: args.status,
        purchased_at: new Date().toISOString(),
        approved_at: args.approvedAt ?? null,
        refunded_at: args.refundedAt ?? null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "external_order_id" } as never,
    );
  if (error) console.error("[webhook] upsert user_orders failed:", error);
}

async function touchIntegrationLastReceived() {
  await supabaseAdmin
    .from("webhook_integrations")
    .update({ last_received_at: new Date().toISOString() } as never)
    .eq("provider", "perfectpay");
}

export const Route = createFileRoute("/api/public/perfectpay/webhook")({
  server: {
    handlers: {
      GET: async () =>
        jsonResponse({
          ok: true,
          message: "PerfectPay webhook endpoint ready.",
          docs: "https://help.perfectpay.com.br/article/597-integracao-via-webhook-com-a-perfect-pay",
        }),
      POST: async ({ request }) => {
        let payload: PerfectPayPayload;
        try {
          payload = (await request.json()) as PerfectPayPayload;
        } catch {
          await logEvent({
            payload: { error: "invalid_json" },
            status: "invalid",
            reason: "JSON inválido no corpo da requisição",
          });
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        await touchIntegrationLastReceived();

        // 1. Token validation (PerfectPay sends `token` field per docs).
        // Always require a configured non-empty token AND a matching value
        // from the request — otherwise reject. Never accept calls when no
        // token is configured, or the webhook becomes an open endpoint that
        // can be used to forge payment events.
        const expectedToken = await getStoredToken();
        if (!expectedToken || payload.token !== expectedToken) {
          await logEvent({
            payload,
            status: "invalid",
            reason: expectedToken
              ? "Token público inválido ou ausente"
              : "Token do webhook não configurado em app_settings_kv.perfectpay_token",
            eventType: typeof payload.sale_status_enum === "number"
              ? SALE_STATUS[payload.sale_status_enum] ?? null
              : null,
          });
          return jsonResponse({ error: "Invalid token" }, 401);
        }

        const status = normalizeStatus(payload);
        const eventType = status;
        // PerfectPay does not send a separate event_id — sale `code` is the
        // unique identifier of the sale; we key idempotency by (code, status).
        const externalId = payload.code ?? payload.event_id ?? null;

        // 2. Idempotência por (sale code + status)
        if (await isDuplicateEvent(externalId, status)) {
          await logEvent({
            payload,
            status: "ok",
            reason: "Evento duplicado ignorado (idempotência)",
            externalId,
            eventType,
          });
          return jsonResponse({ ok: true, duplicate: true });
        }

        const isApproved = APPROVED_STATUSES.has(status);
        const isRevoke = REVOKE_STATUSES.has(status);

        // 3. Eventos não acionáveis (pending, in_process, etc.)
        if (!isApproved && !isRevoke) {
          await logEvent({
            payload,
            status: "ok",
            reason: `Evento ignorado (status: ${status})`,
            externalId,
            eventType,
          });
          return jsonResponse({ ok: true, ignored: true, status });
        }

        // 4. Customer email
        const email = payload.customer?.email?.trim().toLowerCase();
        if (!email) {
          await logEvent({
            payload,
            status: "invalid",
            reason: "E-mail do cliente ausente",
            externalId,
            eventType,
          });
          return jsonResponse({ error: "Customer email required" }, 400);
        }

        const fullName = payload.customer?.full_name?.trim() ?? null;
        const phone =
          payload.customer?.phone_area_code && payload.customer?.phone_number
            ? `(${payload.customer.phone_area_code}) ${payload.customer.phone_number}`
            : payload.customer?.phone_number ?? null;

        const userResult = await findOrCreateUserByEmail(email, fullName, phone);
        if (!userResult) {
          await logEvent({
            payload,
            status: "invalid",
            reason: "Falha ao criar/localizar usuário",
            externalId,
            eventType,
          });
          return jsonResponse({ error: "User creation failed" }, 500);
        }
        const userId = userResult.userId;
        const generatedPassword = userResult.generatedPassword;

        // 5. Match plan by code (legacy)
        const planCode = payload.plan?.code ?? null;
        const productCode = payload.product?.code ?? null;
        let planId: string | null = null;
        if (planCode) {
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("id")
            .eq("code", planCode)
            .maybeSingle();
          planId = (plan as { id: string } | null)?.id ?? null;
        }

        const amountCents = normalizeAmountCents(payload);
        const currency = normalizeCurrency(payload);

        // 6. Resolve commercial offers by candidate codes (plan + product)
        const candidateCodes = [planCode, productCode].filter(
          (c): c is string => typeof c === "string" && c.length > 0,
        );
        const matchedOffers = await resolveOffersByCodes(candidateCodes);

        // 6b. Legacy fallback if no offer matched
        const legacyProductIds = matchedOffers.length === 0
          ? await resolveLegacyProductIds(planId, planCode)
          : [];

        // 7. Registro de venda
        const saleStatus = isApproved ? "approved" : "refunded";
        await supabaseAdmin.from("sales").insert({
          provider: "perfectpay",
          status: saleStatus,
          event_type: eventType,
          external_sale_id: payload.code ?? null,
          customer_email: email,
          user_id: userId,
          plan_id: planId,
          amount_cents: amountCents,
          currency,
          raw_payload: payload as never,
        } as never);

        // 8. Subscription (se houver)
        const subCode = payload.subscription?.code ?? null;
        if (subCode) {
          await upsertSubscription({
            userId,
            planId,
            email,
            amountCents,
            currency,
            externalSubId: subCode,
            status: isApproved ? "active" : "canceled",
            canceledAt: isApproved ? null : new Date().toISOString(),
          });
        }

        // 9. Order
        await recordOrder({
          userId,
          planId,
          externalOrderId: payload.code ?? null,
          amountCents,
          currency,
          status: isApproved
            ? "approved"
            : status === "refunded"
              ? "refunded"
              : "canceled",
          approvedAt: isApproved ? new Date().toISOString() : null,
          refundedAt: !isApproved ? new Date().toISOString() : null,
        });

        // 10. Entitlements
        let granted = 0;
        let revoked = 0;
        const allProductIds = new Set<string>();
        const grantedProductIds = new Set<string>();
        const subscriptionPeriodEnd = payload.subscription?.next_charge_date ?? null;
        let primaryOfferId: string | null = null;
        let primaryVariationId: string | null = null;

        if (isApproved) {
          for (const offer of matchedOffers) {
            const before = grantedProductIds.size;
            granted += await grantEntitlements({
              userId,
              products: offer.products,
              externalSaleId: payload.code ?? null,
              subscriptionPeriodEnd,
            });
            offer.products.forEach((p) => {
              allProductIds.add(p.product_id);
              grantedProductIds.add(p.product_id);
            });
            if (!primaryOfferId && grantedProductIds.size > before) {
              primaryOfferId = offer.offer_id;
              primaryVariationId = offer.variation_id;
            }
          }
          if (legacyProductIds.length > 0) {
            granted += await grantLegacyEntitlements({
              userId,
              productIds: legacyProductIds,
              externalSaleId: payload.code ?? null,
            });
            legacyProductIds.forEach((id) => {
              allProductIds.add(id);
              grantedProductIds.add(id);
            });
          }

          // Enqueue access-granted email (only when at least one product was released)
          if (grantedProductIds.size > 0) {
            try {
              await enqueueAccessGrantedEmail({
                recipientEmail: email,
                recipientName: fullName,
                userId,
                offerId: primaryOfferId,
                variationId: primaryVariationId,
                externalOrderId: payload.code ?? null,
                productIds: Array.from(grantedProductIds),
                generatedPassword,
                request,
              });
            } catch (e) {
              console.error("[webhook] enqueue email failed:", e);
            }
          }
        } else {
          // Collect every product ever bound to the matched offers / legacy
          matchedOffers.forEach((o) =>
            o.products.forEach((p) => allProductIds.add(p.product_id)),
          );
          legacyProductIds.forEach((id) => allProductIds.add(id));
          revoked = await revokeEntitlements({
            userId,
            productIds: Array.from(allProductIds),
            newStatus: status === "refunded" ? "refunded" : "expired",
            reason: status,
          });
        }

        const matchedOfferNames = matchedOffers.length;
        await logEvent({
          payload,
          status: "ok",
          reason: isApproved
            ? `Liberação concluída — ${granted} produto(s) via ${matchedOfferNames} oferta(s)${legacyProductIds.length ? " + grants legados" : ""}`
            : `Acesso revogado (${revoked} produto(s)) — status ${status}`,
          externalId,
          eventType,
        });

        return jsonResponse({
          ok: true,
          user_id: userId,
          plan_id: planId,
          plan_code: planCode,
          product_code: productCode,
          matched_offers: matchedOffers.length,
          granted_products: granted,
          revoked_products: revoked,
          status,
        });
      },
    },
  },
});
