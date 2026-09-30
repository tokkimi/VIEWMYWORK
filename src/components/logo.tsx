import Link from "next/link";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6", className)}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="#4D7CFE" strokeWidth="3" strokeLinecap="round" strokeDasharray="40.7 56.5" transform="rotate(-90 12 12)" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight", className)} aria-label="ViewMyWork home">
      <LogoMark />
      <span>ViewMyWork</span>
    </Link>
  );
}
