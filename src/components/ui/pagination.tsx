import Link from "next/link";
import { Tr } from "@/lib/i18n/client";

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
      {page > 1 ? <Link className="text-muted hover:text-fg" href={hrefFor(page - 1)}>← <Tr>Previous</Tr></Link> : <span />}
      <span className="num text-xs text-subtle"><Tr vars={{ page, pages }}>{"Page {page} of {pages}"}</Tr></span>
      {page < pages ? <Link className="text-muted hover:text-fg" href={hrefFor(page + 1)}><Tr>Next</Tr> →</Link> : <span />}
    </nav>
  );
}
