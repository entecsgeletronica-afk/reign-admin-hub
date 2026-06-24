import { supabase } from "@/integrations/supabase/client";

export type MemberAreaDomain = {
  id: string;
  member_area_id: string;
  root_domain: string;
  subdomain_key: string;
  full_domain: string;
  is_primary: boolean;
  status: "pending" | "active" | "error";
  created_at: string;
  updated_at: string;
};

export async function listDomainsForArea(
  memberAreaId: string,
): Promise<MemberAreaDomain[]> {
  const { data, error } = await supabase
    .from("member_area_domains" as never)
    .select("*")
    .eq("member_area_id", memberAreaId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as MemberAreaDomain[];
}

/**
 * Resolve uma área de membros pelo host atual (full domain).
 * Retorna null se nada for encontrado — chamadores devem cair em fallback.
 */
export async function resolveAreaByHost(
  host: string,
): Promise<{ memberAreaId: string } | null> {
  const { data, error } = await supabase
    .from("member_area_domains" as never)
    .select("member_area_id")
    .eq("full_domain", host)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return { memberAreaId: (data as { member_area_id: string }).member_area_id };
}
