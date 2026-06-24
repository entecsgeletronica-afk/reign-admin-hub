import { safeStorage } from "@/lib/safe-storage";
import type { PeriodKey } from "@/services/dashboard";

/**
 * Persistência do filtro de período do Dashboard entre navegações.
 *
 * Mantemos o último período escolhido no `localStorage` para que ao
 * sair (ex.: ir para /admin/usuarios) e voltar (/admin/dashboard) o
 * usuário encontre exatamente o mesmo recorte — sem precisar reabrir
 * o seletor. Quando a URL já carrega `?period=...` (compartilhamento,
 * back/forward, link direto), a query string vence e é também salva,
 * mantendo o storage sincronizado com o que está na tela.
 */
export const DASHBOARD_PERIOD_STORAGE_KEY = "admin.dashboard.period";

const VALID: readonly PeriodKey[] = [
  "today",
  "7d",
  "30d",
  "90d",
  "month",
  "custom",
];

export function readPersistedDashboardPeriod(): PeriodKey | null {
  const raw = safeStorage.getItem(DASHBOARD_PERIOD_STORAGE_KEY);
  if (!raw) return null;
  return (VALID as readonly string[]).includes(raw) ? (raw as PeriodKey) : null;
}

export function persistDashboardPeriod(period: PeriodKey): void {
  safeStorage.setItem(DASHBOARD_PERIOD_STORAGE_KEY, period);
}
