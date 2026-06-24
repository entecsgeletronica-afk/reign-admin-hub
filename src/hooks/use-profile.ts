import { useQuery } from "@tanstack/react-query";
import { supabaseAny } from "@/integrations/supabase/client";

export interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string | null;
  child_name: string | null;
  avatar_url: string | null;
  purchase_email: string | null;
}

export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProfileRow | null> => {
      if (!userId) return null;
      const { data, error } = await supabaseAny
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return null;
      return (data as ProfileRow | null) ?? null;
    },
    staleTime: 30_000,
  });
}
