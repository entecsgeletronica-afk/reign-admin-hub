import * as React from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}

export function KpiCard({ icon, label, value, detail, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-soft text-gold">
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">{value}</div>
        <div className="text-sm font-medium text-foreground/90">{label}</div>
        {detail ? <div className="text-xs text-muted-foreground">{detail}</div> : null}
      </div>
    </div>
  );
}
