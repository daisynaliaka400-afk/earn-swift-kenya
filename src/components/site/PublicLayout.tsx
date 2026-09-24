import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        {updated && <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>}
        <div className="mt-8 space-y-5 leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground">
          {children}
        </div>
      </article>
    </PublicLayout>
  );
}
