import {
  useQuery,
  useInfiniteQuery,
  keepPreviousData,
  useQueryClient,
} from "@tanstack/react-query";
import * as React from "react";
import {
  fetchUsers,
  fetchUsersSummary,
  type AdminUser,
  type UserStatus,
} from "@/services/users";

/**
 * Cache "por sessão logada" para a tela de Usuários.
 *
 * Mesma estratégia do `use-dashboard`: dados ficam frescos enquanto o
 * admin estiver logado e só são refeitos por invalidação explícita após
 * criar/editar/excluir usuário. Veja `useCreateUser` (em usuarios.tsx) e
 * `useToggleAdminRole` (em services/user-detail.ts) para os pontos de
 * `invalidateQueries({ queryKey: ["admin", "users"] })`.
 */
const SESSION_CACHE = {
  placeholderData: keepPreviousData,
  staleTime: 5000, // 5 seconds for admin data to be relatively fresh
  gcTime: 1000 * 60 * 5, // 5 minutes cache
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchOnMount: true,
} as const;

export function useUsersSummary() {
  return useQuery({
    queryKey: ["admin", "users-summary"],
    queryFn: () => fetchUsersSummary(),
    ...SESSION_CACHE,
  });
}

export function useUsers(params: { search: string; status: UserStatus | "all" }) {
  return useQuery({
    queryKey: ["admin", "users", params.status, params.search],
    queryFn: () => fetchUsers(params),
    ...SESSION_CACHE,
  });
}

/**
 * Infinite/paginated users hook.
 *
 * - A página base (status + search) é buscada UMA vez via `fetchUsers` e
 *   cacheada por sessão (mesma chave do `useUsers`, então é compartilhada).
 * - As "páginas" são fatias em memória dessa lista filtrada — não há custo
 *   adicional de rede ao avançar páginas.
 * - Cada combinação `(status, search, pageSize)` tem sua própria entrada de
 *   cache na infinite query, então voltar a um filtro já visto restaura a
 *   posição instantaneamente.
 */
export interface UsersPage {
  items: AdminUser[];
  nextOffset: number | null;
  total: number;
}

export function useInfiniteAdminUsers(params: {
  search: string;
  status: UserStatus | "all";
  pageSize?: number;
}) {
  const qc = useQueryClient();
  const pageSize = params.pageSize ?? 40;

  return useInfiniteQuery<UsersPage>({
    queryKey: ["admin", "users", "page", params.status, params.search, pageSize],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      // Reusa o cache "por sessão" da lista filtrada inteira:
      const filtered = await qc.ensureQueryData({
        queryKey: ["admin", "users", params.status, params.search],
        queryFn: () => fetchUsers({ search: params.search, status: params.status }),
        staleTime: 5000,
        gcTime: 1000 * 60 * 5,
      });

      const offset = (pageParam as number) ?? 0;
      const items = filtered.slice(offset, offset + pageSize);
      const nextOffset = offset + pageSize < filtered.length ? offset + pageSize : null;
      return { items, nextOffset, total: filtered.length };
    },
    getNextPageParam: (last) => last.nextOffset,
    ...SESSION_CACHE,
  });
}

/**
 * Achata todas as páginas de uma `useInfiniteAdminUsers` em uma lista única.
 * Memoizado para evitar re-renderizações desnecessárias do virtualizador.
 */
export function useFlatInfiniteUsers(
  data: { pages: UsersPage[] } | undefined,
): { items: AdminUser[]; total: number } {
  return React.useMemo(() => {
    if (!data) return { items: [], total: 0 };
    const items = data.pages.flatMap((p) => p.items);
    const total = data.pages[0]?.total ?? items.length;
    return { items, total };
  }, [data]);
}
