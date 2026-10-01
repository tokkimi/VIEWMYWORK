import { Link2, MessageSquareText, MonitorSmartphone } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";

function SiteCanvas({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`h-full overflow-hidden bg-[#f8f7f3] text-[#374039] ${compact ? "text-[5px]" : "text-[9px]"}`}>
      <div className={`flex items-center justify-between border-b border-[#e9e6df] ${compact ? "px-3 py-3" : "px-7 py-5"}`}>
        <span className={`font-serif font-semibold tracking-[-0.08em] text-[#a28b64] ${compact ? "text-base" : "text-3xl"}`}>A</span>
        <div className={`flex items-center gap-4 text-[#73796f] ${compact ? "hidden" : ""}`}><span>Programme</span><span>Accompagnement</span><span>Entreprise</span></div>
        <span className={`rounded-full bg-[#344237] font-medium text-white ${compact ? "px-2 py-1" : "px-4 py-2"}`}>Découvrir</span>
      </div>
      <div className={`grid h-[calc(100%-48px)] ${compact ? "grid-cols-1 px-3 pt-7" : "grid-cols-[1.08fr_.92fr] gap-5 px-8 pt-10"}`}>
        <div>
          <p className="uppercase tracking-[.25em] text-[#a89676]">structure · automation · intelligence</p>
          <h3 className={`mt-4 font-light leading-[1.03] tracking-[-.06em] text-[#485048] ${compact ? "text-xl" : "text-[clamp(24px,3vw,48px)]"}`}>Votre entreprise,<br />mieux organisée.<br /><span className="text-[#ae9770]">L&apos;IA en plus.</span></h3>
          <p className={`mt-5 max-w-xs leading-relaxed text-[#7f887e] ${compact ? "text-[7px]" : "text-[11px]"}`}>Structurez vos projets, automatisez les tâches répétitives et gardez le contrôle sur ce qui compte.</p>
          <div className={`mt-5 inline-flex rounded-full bg-[#344237] text-white ${compact ? "px-3 py-2 text-[6px]" : "px-5 py-3 text-[10px]"}`}>Développer ma pratique&nbsp; ↗</div>
        </div>
        {!compact && <div className="relative overflow-hidden bg-[#d7e3e6]"><div className="absolute inset-x-[10%] bottom-0 h-[72%] bg-[#f7f6f0] shadow-[20px_0_0_#e9e7df]" /><div className="absolute bottom-0 right-[7%] h-[82%] w-[22%] bg-[#eef0eb]" /><div className="absolute bottom-[16%] left-[15%] h-[25%] w-[40%] bg-[#dde5df]" /><div className="absolute bottom-[12%] right-[10%] size-16 rounded-full bg-[#6c7b65]/70 blur-sm" /></div>}
      </div>
    </div>
  );
}

export async function DeveloperPreviewShowcase() {
  const { t } = await getI18n();
  const benefits = [
    [Link2, "Add any staging, Vercel or production URL", "Create a preview link in seconds."],
    [MonitorSmartphone, "Check the experience on desktop, tablet and mobile", "See exactly how it looks across every screen."],
    [MessageSquareText, "Turn feedback and approval into clear next steps", "Keep all feedback in one place, on the live preview."],
  ] as const;
  return (
    <section className="relative overflow-hidden border-t border-line bg-[radial-gradient(ellipse_at_80%_55%,rgba(96,86,255,.2),transparent_42%),#090b14]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:py-28">
        <div className="relative z-10">
          <p className="eyebrow text-[#91a4ff]">{t("Built for delivery teams")}</p>
          <h2 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">{t("Share each deployment with a")} <span className="text-[#a8c4ff]">{t("preview")}</span> {t("your client can understand.")}</h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#aab2c6]">{t("Developers add a secure preview link as soon as a version is ready. Your client sees the website in a polished desktop, tablet or mobile frame — and can give feedback in the context of the project.")}</p>
          <ul className="mt-9 space-y-6">
            {benefits.map(([Icon, title, description]) => <li key={title} className="flex gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#7186ff]/35 bg-[#1b2041] text-[#aebaff] shadow-[0_0_22px_rgba(116,103,255,.2)]"><Icon className="size-5" /></span><span><strong className="block text-sm font-medium text-white">{t(title)}</strong><span className="mt-1 block text-sm text-[#aab2c6]">{t(description)}</span></span></li>)}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-3xl min-h-[460px] sm:min-h-[560px]">
          <div className="absolute -right-2 top-0 z-30 rounded-2xl border border-[#9d9bff] bg-[#111526]/95 px-5 py-3 text-sm text-white shadow-[0_0_34px_rgba(131,111,255,.45)] sm:right-4 sm:px-7"><Link2 className="mr-3 inline size-5 text-[#aebaff]" />preview.your-project.com</div>
          <div className="absolute left-0 top-16 h-[68%] w-[76%] overflow-hidden rounded-[26px] border-[5px] border-[#66749d] bg-[#18203a] p-2 shadow-[0_24px_55px_rgba(0,0,0,.5),0_0_34px_rgba(124,111,255,.45)]">
            <div className="flex h-7 items-center gap-2 px-2"><i className="size-2.5 rounded-full bg-[#ff7373]" /><i className="size-2.5 rounded-full bg-[#f7cd70]" /><i className="size-2.5 rounded-full bg-[#6dd38b]" /><span className="ml-2 rounded-full bg-[#3c4b76] px-4 py-1 text-[9px] text-white/80">preview.your-project.com</span></div>
            <div className="h-[calc(100%-28px)] overflow-hidden rounded-[15px]"><SiteCanvas /></div>
          </div>
          <div className="absolute bottom-1 right-0 z-20 h-[57%] w-[31%] overflow-hidden rounded-[30px] border-[5px] border-[#111827] bg-[#18203a] p-1.5 shadow-[0_24px_45px_rgba(0,0,0,.65)]"><div className="mx-auto h-4 w-16 rounded-b-xl bg-[#111827]" /><div className="h-[calc(100%-16px)] overflow-hidden rounded-[22px]"><SiteCanvas compact /></div></div>
          <div className="absolute bottom-7 right-[20%] z-10 hidden h-[45%] w-[23%] overflow-hidden rounded-[22px] border-[5px] border-[#202a42] bg-[#18203a] p-1.5 shadow-2xl sm:block"><div className="h-full overflow-hidden rounded-[15px]"><SiteCanvas compact /></div></div>
          <div className="absolute inset-x-0 bottom-0 h-16 rounded-[50%] bg-[#5c5dd5]/45 blur-xl" />
        </div>
      </div>
    </section>
  );
}
