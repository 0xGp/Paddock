import { cn } from "@/lib/cn";

/** Paddock's mark: a banknote and a coin on the navy tile. Same drawing as `app/icon.svg`. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-9 shrink-0", className)}>
      <defs>
        <linearGradient id="paddock-logo-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f1d45" />
          <stop offset="1" stopColor="#1f4fb8" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#paddock-logo-tile)" />
      <g transform="rotate(-12 18 18)">
        <rect x="7" y="11" width="23" height="14" rx="3" fill="#fff" />
        <circle cx="18.5" cy="18" r="3.4" fill="none" stroke="#1f4fb8" strokeWidth="1.8" />
        <circle cx="11" cy="18" r="1.1" fill="#1f4fb8" />
        <circle cx="26" cy="18" r="1.1" fill="#1f4fb8" />
      </g>
      <circle cx="28" cy="28" r="7" fill="#4fd4cf" stroke="#13265a" strokeWidth="2.2" />
      <circle cx="28" cy="28" r="3.8" fill="none" stroke="#1d7d86" strokeWidth="1.4" />
    </svg>
  );
}
