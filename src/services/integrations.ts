import { supabase, supabaseAny } from "@/integrations/supabase/client";

export type AppLanguage = "pt" | "en" | "es";

export interface IntegrationsSettings {
  language: AppLanguage;
  perfectpay_token: string;
}

export interface WebhookEvent {
  id: string;
  received_at: string;
  status: "ok" | "invalid";
  reason: string | null;
  payload: unknown;
}

const LS = {
  settings: "rdc.admin.integrations",
  lastPayload: "rdc.admin.integrations.lastPayload",
  invalid: "rdc.admin.integrations.invalid",
};

const DEFAULT_SETTINGS: IntegrationsSettings = {
  language: "pt",
  perfectpay_token: "",
};

import { safeStorage } from "@/lib/safe-storage";

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = safeStorage.getItem(key);
    return raw ? ({ ...(fallback as object), ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS<T>(key: string, value: T) {
  try {
    safeStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* no-op */
  }
}

// ---------- Settings ----------
const KV_KEY = "perfectpay_token";

export async function getIntegrationsSettings(): Promise<IntegrationsSettings> {
  if (supabase) {
    const { data } = await supabaseAny
      .from("app_settings_kv")
      .select("value_json")
      .eq("key", KV_KEY)
      .maybeSingle();
    if (data) {
      const raw = (data as { value_json: unknown }).value_json;
      const token =
        typeof raw === "string"
          ? raw
          : raw && typeof raw === "object" && "token" in raw
            ? String((raw as { token?: unknown }).token ?? "")
            : "";
      return { ...DEFAULT_SETTINGS, perfectpay_token: token };
    }
  }
  return readLS(LS.settings, DEFAULT_SETTINGS);
}

export async function saveIntegrationsSettings(value: Partial<IntegrationsSettings>): Promise<void> {
  const current = await getIntegrationsSettings();
  const next = { ...current, ...value };
  writeLS(LS.settings, next);
  if (supabase) {
    await supabaseAny.from("app_settings_kv").upsert(
      {
        key: KV_KEY,
        value_json: next.perfectpay_token,
        description: "PerfectPay public token (webhook signature)",
      },
      { onConflict: "key" },
    );
  }
}

// ---------- Webhook URL ----------
export function getWebhookUrl(): string {
  if (typeof window === "undefined") return "/api/public/perfectpay/webhook";
  return `${window.location.origin}/api/public/perfectpay/webhook`;
}

// ---------- Webhook events ----------
export async function listInvalidWebhooks(): Promise<WebhookEvent[]> {
  if (supabase) {
    const { data } = await supabaseAny
      .from("webhook_events")
      .select("id, received_at, status, reason, payload")
      .eq("status", "invalid")
      .order("received_at", { ascending: false })
      .limit(20);
    if (data) {
      return data.map((d: any) => ({
        id: d.id,
        received_at: d.received_at,
        status: d.status as WebhookEvent["status"],
        reason: d.reason,
        payload: d.payload,
      }));
    }
  }
  return readLS<WebhookEvent[]>(LS.invalid, []);
}

export async function getLastWebhookPayload(): Promise<unknown | null> {
  if (supabase) {
    const { data } = await supabaseAny
      .from("webhook_events")
      .select("payload")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data.payload;
  }
  try {
    const raw = safeStorage.getItem(LS.lastPayload);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------- Test helpers (frontend only — simulates the call) ----------
export interface TestResult {
  status: number;
  ok: boolean;
  message: string;
}

// Payload no formato oficial PerfectPay (sale_status_enum numérico, plan.code, etc.)
// https://help.perfectpay.com.br/article/597-integracao-via-webhook-com-a-perfect-pay
const SAMPLE_PAYLOAD = {
  code: "PPCPMTB-TEST-" + Date.now(),
  sale_amount: 49.9,
  currency_enum: 1, // 1 = BRL
  sale_status_enum: 2, // 2 = approved
  sale_status_detail: "approved",
  date_created: new Date().toISOString(),
  date_approved: new Date().toISOString(),
  product: { code: "PROD_TESTE", name: "Produto Teste", external_reference: null },
  plan: { code: "TEST_PLAN", name: "Plano Teste", quantity: 1 },
  customer: {
    customer_type_enum: 1,
    full_name: "Cliente Teste",
    email: "[email protected]",
    identification_type: "CPF",
    identification_number: "00000000000",
    phone_area_code: "11",
    phone_number: "999999999",
  },
  webhook_owner: "TEST",
};

export async function sendTestWebhook(token: string): Promise<TestResult> {
  writeLS(LS.lastPayload, SAMPLE_PAYLOAD);
  const url = getWebhookUrl();
  const body = { ...SAMPLE_PAYLOAD, token: token || undefined };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: { error?: string; message?: string; ok?: boolean } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    const message = parsed?.error
      ? parsed.error
      : parsed?.message
        ? parsed.message
        : res.ok
          ? "Webhook recebido e validado com sucesso."
          : text || `Erro HTTP ${res.status}`;
    return { status: res.status, ok: res.ok, message };
  } catch (e) {
    return {
      status: 0,
      ok: false,
      message: `Falha de rede: ${(e as Error).message}`,
    };
  }
}

export async function resendLastPayload(token: string): Promise<TestResult> {
  const last = await getLastWebhookPayload();
  if (!last) {
    return { status: 0, ok: false, message: "Nenhum payload anterior encontrado." };
  }
  // Re-send the captured payload, overriding the token to the current one
  const url = getWebhookUrl();
  const body = { ...(last as object), token: token || undefined };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return {
      status: res.status,
      ok: res.ok,
      message: res.ok ? "Payload reenviado com sucesso." : text || `Erro HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      status: 0,
      ok: false,
      message: `Falha de rede: ${(e as Error).message}`,
    };
  }
}

// ---------- All webhook events (audit) ----------
export interface WebhookEventFull extends WebhookEvent {
  provider: string;
  event_type: string | null;
  external_event_id: string | null;
  processed: boolean;
  error_message: string | null;
}

export interface WebhookEventsFilter {
  status?: "ok" | "invalid" | "all";
  provider?: string;
  limit?: number;
}

export async function listWebhookEvents(
  filter: WebhookEventsFilter = {},
): Promise<WebhookEventFull[]> {
  if (!supabase) return [];
  let q = supabaseAny
    .from("webhook_events")
    .select(
      "id, received_at, status, reason, payload, provider, event_type, external_event_id, processed, error_message",
    )
    .order("received_at", { ascending: false })
    .limit(filter.limit ?? 100);
  if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
  if (filter.provider) q = q.eq("provider", filter.provider);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WebhookEventFull[];
}

// ---------- Webhook integrations registry ----------
export interface WebhookIntegration {
  id: string;
  name: string;
  provider: string;
  endpoint_url: string;
  active: boolean;
  signing_secret: string | null;
  last_received_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listWebhookIntegrations(): Promise<WebhookIntegration[]> {
  if (!supabase) return [];
  const { data, error } = await supabaseAny
    .from("webhook_integrations")
    .select(
      "id, name, provider, endpoint_url, active, signing_secret, last_received_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WebhookIntegration[];
}

export async function toggleWebhookIntegration(id: string, active: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabaseAny
    .from("webhook_integrations")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}
