import * as React from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
            {eyebrow}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {title}
          </h1>
        </div>
        {actions ? (
          <div className="relative flex flex-wrap gap-2 lg:justify-end">{actions}</div>
        ) : null}
      </div>
      {description ? (
        <div className="border-t border-border px-6 py-4 sm:px-8">
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
      ) : null}
    </header>
  );
}
