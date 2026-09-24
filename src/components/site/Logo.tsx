import { Link } from "@tanstack/react-router";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="SmartEarn home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-brand">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 16l5-5 4 4 7-8" />
          <path d="M15 7h5v5" />
        </svg>
      </span>
      <span className={`font-display text-lg font-bold ${light ? "text-navy-foreground" : "text-foreground"}`}>
        Smart<span className="text-brand">Earn</span>
      </span>
    </Link>
  );
}
