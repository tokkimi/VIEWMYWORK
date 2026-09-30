import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="glow pointer-events-none absolute inset-x-0 top-0 h-96" />
      <header className="relative flex items-center justify-between px-6 py-6"><Logo /><LanguageSwitcher /></header>
      <main id="main" className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-16">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
