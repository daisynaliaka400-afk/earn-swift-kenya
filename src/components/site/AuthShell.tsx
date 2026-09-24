import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-glow" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
        <Logo />
        <div className="card mt-10 p-6 md:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
