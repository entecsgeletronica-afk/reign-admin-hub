import { useQuery } from "@tanstack/react-query";
import { fetchProtectedSettings, PROTECTED_DEFAULTS } from "@/services/protected-settings";

export function useProtectedSettings() {
  const query = useQuery({
    queryKey: ["protected_settings"],
    queryFn: fetchProtectedSettings,
    staleTime: 5 * 60 * 1000,
  });
  // Sempre retorna valores válidos, mesmo durante loading.
  const values = query.data ?? PROTECTED_DEFAULTS;
  return { values, isLoading: query.isLoading };
}
