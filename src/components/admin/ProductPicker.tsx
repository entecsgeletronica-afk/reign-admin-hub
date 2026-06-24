import * as React from "react";
import { Check, ChevronsUpDown, Package, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface ProductPickerOption {
  id: string;
  title: string;
  subtitle?: string | null;
}

interface ProductPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: ProductPickerOption[];
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

export function ProductPicker({
  value,
  onChange,
  options,
  disabled,
  placeholder = "Selecione um produto…",
  emptyText = "Nenhum produto disponível",
  className,
}: ProductPickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "group flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 text-left text-sm text-foreground shadow-sm transition-all",
            "hover:border-gold/50 hover:bg-card",
            "focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-gold ring-2 ring-gold/30",
            className,
          )}
        >
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
              selected
                ? "bg-gold/15 text-gold"
                : "bg-card text-muted-foreground group-hover:text-gold",
            )}
          >
            <Package className="h-3.5 w-3.5" />
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              !selected && "text-muted-foreground",
            )}
          >
            {selected ? selected.title : placeholder}
          </span>
          <ChevronsUpDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180 text-gold",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[--radix-popover-trigger-width] overflow-hidden rounded-xl border border-border bg-surface-elevated p-0 shadow-xl"
      >
        <Command className="bg-transparent">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput
              placeholder="Buscar produto…"
              className="h-10 border-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:ring-0"
            />
          </div>
          <CommandList className="scrollbar-premium max-h-72">
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup className="p-1">
              {options.map((opt) => {
                const isSelected = value === opt.id;
                return (
                  <CommandItem
                    key={opt.id}
                    value={`${opt.title} ${opt.id}`}
                    onSelect={() => {
                      onChange(opt.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors",
                      "data-[selected=true]:bg-gold/15 data-[selected=true]:text-foreground",
                      "aria-selected:bg-gold/15",
                      isSelected && "bg-gold/10",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                        isSelected
                          ? "bg-gold text-gold-foreground"
                          : "bg-card text-muted-foreground",
                      )}
                    >
                      <Package className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{opt.title}</span>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-gold" />
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
