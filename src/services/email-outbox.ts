// Email outbox service — lists queued access-granted notifications.

import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseAny } from "@/integrations/supabase/client";

export interface EmailOutboxRow {
  id: string;
  template_key: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
  status: "pending" | "sent" | "failed" | string;
  reason: string | null;
  user_id: string | null;
  offer_id: string | null;
  variation_id: string | null;
  external_order_id: string | null;
  product_ids: string[];
  area_url: string | null;
  scheduled_for: string;
  sent_at: string | null;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export async function listEmailOutbox(filter?: {
  status?: "pending" | "sent" | "failed" | "all";
  limit?: number;
}): Promise<EmailOutboxRow[]> {
  if (!supabase) return [];
  let q = supabaseAny
    .from("email_outbox")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filter?.limit ?? 50);
  if (filter?.status && filter.status !== "all") {
    q = q.eq("status", filter.status);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as EmailOutboxRow[];
}

export function useEmailOutbox(filter?: {
  status?: "pending" | "sent" | "failed" | "all";
  limit?: number;
}) {
  return useQuery({
    queryKey: ["email_outbox", filter?.status ?? "all", filter?.limit ?? 50],
    queryFn: () => listEmailOutbox(filter),
    refetchInterval: 30_000,
  });
}

export async function markEmailSent(id: string): Promise<void> {
  if (!supabase) return;
  await supabaseAny
    .from("email_outbox")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);
}
