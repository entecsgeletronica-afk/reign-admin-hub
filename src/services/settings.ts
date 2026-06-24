import { supabase, supabaseAny } from "@/integrations/supabase/client";

export interface BrandingSettings {
  id?: string;
  app_name: string;
  logo_alt: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  support_email: string | null;
}

export interface EmailSettings {
  sender_name: string;
  sender_email: string;
}

export interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  body_html: string;
  enabled: boolean;
  variables: unknown;
  updated_at: string;
}

const DEFAULT_BRANDING: BrandingSettings = {
  app_name: "Reino das Cores",
  logo_alt: "Reino das Cores",
  logo_url: null,
  favicon_url: null,
  primary_color: null,
  secondary_color: null,
  accent_color: null,
  support_email: null,
};

const DEFAULT_EMAIL: EmailSettings = {
  sender_name: "Reino das Cores",
  sender_email: "",
};

// ---------- Branding ----------
export async function getBranding(): Promise<BrandingSettings> {
  if (!supabase) return DEFAULT_BRANDING;
  const { data } = await supabaseAny
    .from("branding_settings")
    .select(
      "id, app_name, logo_alt, logo_url, favicon_url, primary_color, secondary_color, accent_color, support_email",
    )
    .maybeSingle();
  if (data) return { ...DEFAULT_BRANDING, ...data } as BrandingSettings;
  return DEFAULT_BRANDING;
}

export async function saveBranding(value: BrandingSettings): Promise<void> {
  if (!supabase) return;
  const payload: Record<string, unknown> = {
    app_name: value.app_name,
    logo_alt: value.logo_alt,
    logo_url: value.logo_url,
    favicon_url: value.favicon_url,
    primary_color: value.primary_color,
    secondary_color: value.secondary_color,
    accent_color: value.accent_color,
    support_email: value.support_email,
  };
  if (value.id) {
    const { error } = await supabaseAny
      .from("branding_settings")
      .update(payload)
      .eq("id", value.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAny.from("branding_settings").insert(payload);
    if (error) throw error;
  }
}

// ---------- Email sender (app_settings) ----------
export async function getEmailSettings(): Promise<EmailSettings & { id?: string }> {
  if (!supabase) return DEFAULT_EMAIL;
  const { data } = await supabaseAny
    .from("app_settings")
    .select("id, sender_name, sender_email")
    .maybeSingle();
  if (data) {
    return {
      id: data.id,
      sender_name: data.sender_name ?? DEFAULT_EMAIL.sender_name,
      sender_email: data.sender_email ?? DEFAULT_EMAIL.sender_email,
    };
  }
  return DEFAULT_EMAIL;
}

export async function saveEmailSettings(value: EmailSettings & { id?: string }): Promise<void> {
  if (!supabase) return;
  const payload = { sender_name: value.sender_name, sender_email: value.sender_email };
  if (value.id) {
    const { error } = await supabaseAny.from("app_settings").update(payload).eq("id", value.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAny.from("app_settings").insert(payload);
    if (error) throw error;
  }
}

// ---------- Email templates ----------
export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  if (!supabase) return [];
  const { data, error } = await supabaseAny
    .from("email_templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("[listEmailTemplates] error:", error);
    throw error;
  }
  return (data ?? []) as EmailTemplate[];
}

export async function upsertEmailTemplate(
  value: Partial<EmailTemplate> & { template_key: string; name: string; subject: string; body_html: string },
): Promise<EmailTemplate> {
  if (!supabase) throw new Error("Supabase indisponível");
  const payload = {
    template_key: value.template_key,
    name: value.name,
    subject: value.subject,
    body_html: value.body_html,
    enabled: value.enabled ?? true,
    variables: value.variables ?? [],
  };
  
  const query = value.id
    ? supabaseAny.from("email_templates").update(payload).eq("id", value.id)
    : supabaseAny.from("email_templates").insert(payload);

  const { data, error } = await query.select().single();
  
  if (error) {
    console.error("[upsertEmailTemplate] error:", error);
    throw error;
  }
  return data as EmailTemplate;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabaseAny.from("email_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleEmailTemplate(id: string, enabled: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabaseAny
    .from("email_templates")
    .update({ enabled })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Legacy shims (story covers — kept for /admin/qa-capas) ----------
export interface StoryCover {
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  testament: "parables" | "new" | "old";
  is_new: boolean;
  cover_url: string | null;
}

import { safeStorage } from "@/lib/safe-storage";
const LS_COVERS = "rdc.admin.covers";

export async function listStoryCovers(): Promise<StoryCover[]> {
  try {
    const raw = safeStorage.getItem(LS_COVERS);
    if (raw) return JSON.parse(raw) as StoryCover[];
  } catch {
    /* ignore */
  }
  return [];
}

export async function saveStoryCover(cover: StoryCover): Promise<void> {
  const all = await listStoryCovers();
  const next = all.some((c) => c.id === cover.id)
    ? all.map((c) => (c.id === cover.id ? cover : c))
    : [...all, cover];
  try {
    safeStorage.setItem(LS_COVERS, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
