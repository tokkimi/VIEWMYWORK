import type { LegalSection } from "@/lib/legal";

/** Shared layout for the legal pages (terms, sales terms, privacy, legal notice). */
export function LegalArticle({ title, intro, updated, sections }: { title: string; intro?: string; updated: string; sections: LegalSection[] }) {
  return (
    <article className="mx-auto max-w-2xl px-5 py-20 text-[15px] leading-relaxed text-muted [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-fg">
      <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h1>
      <p className="mt-2 text-xs text-subtle">{updated}</p>
      {intro && <p className="mt-6">{intro}</p>}
      {sections.map(([h, body], i) => (
        <section key={h}>
          <h2>{i + 1}. {h}</h2>
          {(Array.isArray(body) ? body : [body]).map((p, j) => <p key={j} className="mt-3">{p}</p>)}
        </section>
      ))}
    </article>
  );
}
