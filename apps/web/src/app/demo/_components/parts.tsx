import type { Category } from "@splitsense/engine";
import { BedDouble, Building2, Car, Fuel, Receipt, ShoppingBasket, Ticket, Trash2, Utensils, Wifi, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const AVATAR_TINT = [
  "bg-[oklch(0.9_0.06_252)] text-[oklch(0.38_0.14_258)]",
  "bg-[oklch(0.91_0.07_192)] text-[oklch(0.38_0.08_200)]",
  "bg-[oklch(0.92_0.06_75)] text-[oklch(0.42_0.1_60)]",
  "bg-[oklch(0.91_0.05_300)] text-[oklch(0.4_0.12_300)]",
];

export function Avatar({ name, index, className }: { name: string; index: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
        AVATAR_TINT[index % AVATAR_TINT.length],
        className,
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function Brand({ tag }: { tag: string }) {
  return (
    <span className="flex items-center gap-2.5 text-lg font-bold">
      <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-navy">
        <span className="size-3 rounded-full bg-sui-bright" />
      </span>
      SplitSense
      <span className="glass hidden rounded-full px-3 py-1.5 text-xs font-semibold text-sui sm:inline">{tag}</span>
    </span>
  );
}

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  fuel: Fuel,
  power: Zap,
  data: Wifi,
  groceries: ShoppingBasket,
  housing: Building2,
  utilities: Trash2,
  food: Utensils,
  transport: Car,
  tickets: Ticket,
  stay: BedDouble,
  other: Receipt,
};

export function CategoryIcon({ category }: { category: Category }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-sui-soft text-sui">
      <Icon className="size-[1.125rem]" strokeWidth={2} />
    </span>
  );
}

export function Section({
  id,
  title,
  note,
  className,
  children,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={`${id}-section`} aria-labelledby={id} className={cn("glass scroll-mt-20 rounded-[1.75rem] p-2", className)}>
      <div className="px-3 pt-3 pb-1">
        <h2 id={id} className="text-base font-bold text-balance">
          {title}
        </h2>
        {note && <div className="mt-0.5 text-sm text-pretty text-ink-muted">{note}</div>}
      </div>
      <ul role="list" className="space-y-0.5">
        {children}
      </ul>
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <li className="flex min-h-16 items-center gap-3 rounded-2xl px-3 py-3">{children}</li>;
}

export function Chip({ tone = "muted", children }: { tone?: "teal" | "muted"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        tone === "teal" ? "bg-teal/50 text-teal-ink" : "bg-ink/[0.06] text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}

export function Meter({ value, tone }: { value: number; tone: "sui" | "muted" | "owes" }) {
  return (
    <span aria-hidden className="block h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
      <span
        className={cn("block h-full rounded-full", tone === "sui" ? "bg-sui" : tone === "owes" ? "bg-owes" : "bg-ink-muted/60")}
        style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
      />
    </span>
  );
}
