import Link from "next/link";
import { cn } from "@/lib/cn";

export const BRAND = "FollowMyFuture";

export function LogoMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.svg" alt="" aria-hidden width={24} height={24} className={cn("size-6 shrink-0", className)} />;
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight", className)} aria-label={BRAND}>
      <LogoMark className="size-7" />
      <span>{BRAND}</span>
    </Link>
  );
}
