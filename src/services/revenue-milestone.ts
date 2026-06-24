import { supabase, supabaseAny } from "@/integrations/supabase/client";

/**
 * Faturamento acumulado total — soma de TODAS as vendas aprovadas
 * (status `approved` ou `paid`) recebidas via webhooks. Inclui pagamentos
 * únicos e cobranças recorrentes (cada renovação é uma nova linha em
 * `sales`). Retorna o valor em reais (não centavos).
 */
export async function fetchAccumulatedRevenue(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabaseAny
    .from("sales")
    .select("amount_cents, status")
    .in("status", ["approved", "paid", "completed"]);
  if (error || !data) return 0;
  const totalCents = (data as Array<{ amount_cents: number }>).reduce(
    (acc, row) => acc + (Number(row.amount_cents) || 0),
    0,
  );
  return totalCents / 100;
}

export interface Milestone {
  /** valor em reais */
  value: number;
  label: string;
}

/**
 * Marcos de faturamento. Cada faixa é um "troféu" a conquistar:
 * 0 → 100k → 500k → 1M → 5M.
 */
export const MILESTONES: Milestone[] = [
  { value: 0, label: "R$ 0" },
  { value: 100_000, label: "R$ 100K" },
  { value: 500_000, label: "R$ 500K" },
  { value: 1_000_000, label: "R$ 1M" },
  { value: 5_000_000, label: "R$ 5M" },
];

export interface MilestoneProgress {
  current: number;
  next: Milestone;
  previous: Milestone;
  percent: number;
  reachedIndex: number;
}

export function computeMilestoneProgress(current: number): MilestoneProgress {
  // Index do último marco já alcançado
  let reachedIndex = 0;
  for (let i = 0; i < MILESTONES.length; i++) {
    if (current >= MILESTONES[i].value) reachedIndex = i;
  }
  const previous = MILESTONES[reachedIndex];
  const next = MILESTONES[Math.min(reachedIndex + 1, MILESTONES.length - 1)];
  const span = Math.max(1, next.value - previous.value);
  const percent =
    reachedIndex >= MILESTONES.length - 1
      ? 100
      : Math.min(100, Math.max(0, ((current - previous.value) / span) * 100));
  return { current, next, previous, percent, reachedIndex };
}
