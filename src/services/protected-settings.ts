// Configurações institucionais protegidas (rodapé do sidebar, links oficiais
// das ferramentas, créditos da comunidade). Apenas Super Admin pode editar.
// Qualquer usuário autenticado/anônimo pode LER (RLS permite SELECT a todos).
import { supabase, supabaseAny } from "@/integrations/supabase/client";

export type ProtectedSettingKey =
  | "sidebar_footer_enabled"
  | "sidebar_footer_text"
  | "sidebar_footer_copyright"
  | "community_url"
  | "community_label"
  | "perfectpay_referral_url"
  | "tool_url_replic"
  | "tool_url_funnelx"
  | "tool_url_hostvsl"
  | "tool_url_adsniper";

export interface ProtectedSetting {
  id: string;
  key: ProtectedSettingKey | string;
  value: string | null;
  is_protected: boolean;
  editable_by_role: string;
  description: string | null;
  updated_at: string;
}

// Defaults usados como fallback caso a leitura do banco falhe ou ainda não
// tenha sido populada. Mantemos os valores institucionais aqui para que o
// sidebar nunca apareça quebrado.
export const PROTECTED_DEFAULTS: Record<ProtectedSettingKey, string> = {
  sidebar_footer_enabled: "true",
  sidebar_footer_text: "Feito com amor em Salvador",
  sidebar_footer_copyright: "© APP COLORIR",
  community_url: "https://www.appcolorir.com.br",
  community_label: "www.appcolorir.com.br",
  perfectpay_referral_url: "https://app.perfectpay.com.br/refer/REFPPU15CH55ZP",
  tool_url_replic: "https://replic.com.br",
  tool_url_funnelx: "https://funnelx.com.br/",
  tool_url_hostvsl: "https://www.hostvsl.com.br",
  tool_url_adsniper: "https://www.adsniper.com.br/",
};

export async function fetchProtectedSettings(): Promise<
  Record<string, string>
> {
  if (!supabase) return { ...PROTECTED_DEFAULTS };
  const { data, error } = await supabaseAny
    .from("protected_settings")
    .select("key, value");
  if (error) {
    console.warn("[protected_settings] fetch error:", error.message);
    return { ...PROTECTED_DEFAULTS };
  }
  const map: Record<string, string> = { ...PROTECTED_DEFAULTS };
  for (const row of (data ?? []) as { key: string; value: string | null }[]) {
    if (row.value != null) map[row.key] = row.value;
  }
  return map;
}

export async function logSecurityAttempt(args: {
  action: string;
  resource?: string | null;
  status?: "blocked" | "allowed";
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!supabase) return;
  try {
    const { data: sessionData } = await supabase.auth.getUser();
    const user = sessionData?.user ?? null;
    await supabaseAny.from("security_audit_logs").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action: args.action,
      resource: args.resource ?? null,
      status: args.status ?? "blocked",
      reason: args.reason ?? null,
      metadata: args.metadata ?? {},
    });
  } catch (err) {
    console.warn("[security_audit_logs] insert failed:", err);
  }
}
