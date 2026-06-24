export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

export function formatBRLCompact(value: number): string {
  if (value >= 1000) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return formatBRL(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}
