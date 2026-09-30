"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Bell, FolderKanban, Users, CheckSquare, Receipt, Wallet, Upload, CornerDownLeft, FileText, Package } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tr, useI18n } from "@/lib/i18n/client";

type Hit = { type: string; id: string; title: string; subtitle?: string; href: string };

const quick = [
  { label: "Project", href: "/app/projects/new", icon: FolderKanban, key: "projects" },
  { label: "Client", href: "/app/clients/new", icon: Users, key: "clients" },
  { label: "Task", href: "/app/tasks?new=1", icon: CheckSquare, key: "tasks" },
  { label: "Invoice", href: "/app/invoices/new", icon: Receipt, key: "invoices" },
  { label: "Expense", href: "/app/finance?new=expense", icon: Wallet, key: "finance" },
  { label: "File", href: "/app/files?upload=1", icon: Upload, key: "files" },
];

export function Topbar({ allowed }: { allowed: Record<string, boolean> }) {
  const { t } = useI18n();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const actions = quick.filter((q) => allowed[q.key] !== false);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/75 pl-14 pr-4 backdrop-blur-xl lg:pl-6">
      <button onClick={() => setPaletteOpen(true)} className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2.5 rounded-[10px] border border-line bg-white/[0.03] px-3 text-left text-[13px] text-subtle hover:border-line-strong" aria-label={t("Search (Ctrl+K)")}>
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate"><Tr>Search projects, clients, invoices…</Tr></span>
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative">
          <button onClick={() => setPlusOpen(!plusOpen)} aria-haspopup="menu" aria-expanded={plusOpen} aria-label={t("Quick create")} className="flex size-9 items-center justify-center rounded-[10px] bg-accent text-white hover:bg-accent-hover">
            <Plus className="size-4" />
          </button>
          {plusOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPlusOpen(false)} />
              <div role="menu" className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-line bg-surface-2 p-1 shadow-2xl">
                {actions.map((q) => (
                  <Link key={q.label} role="menuitem" href={q.href} onClick={() => setPlusOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-white/[0.05]">
                    <q.icon className="size-4 text-muted" /> {t(q.label)}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
        <NotificationBell />
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} actions={actions} />}
    </header>
  );
}

const typeIcon: Record<string, React.ComponentType<{ className?: string }>> = { project: FolderKanban, client: Users, task: CheckSquare, invoice: Receipt, file: FileText, deliverable: Package };

function CommandPalette({ onClose, actions }: { onClose: () => void; actions: typeof quick }) {
  const { t: tr } = useI18n();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const c = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: c.signal });
        if (r.ok) setHits((await r.json()).results);
      } catch {}
      setLoading(false);
    }, 180);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [q]);

  const items: { title: string; subtitle?: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
    ...hits.map((h) => ({ title: h.title, subtitle: h.subtitle, href: h.href, icon: typeIcon[h.type] ?? FileText })),
    ...actions
      .map((a) => ({ title: tr("Create: {item}", { item: tr(a.label) }), subtitle: tr("Action"), href: a.href, icon: a.icon }))
      .filter((a) => !q || a.title.toLowerCase().includes(q.toLowerCase())),
  ];
  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={tr("Search")}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-subtle" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setIdx((i) => Math.min(items.length - 1, i + 1));
              if (e.key === "ArrowUp") setIdx((i) => Math.max(0, i - 1));
              if (e.key === "Enter" && items[idx]) go(items[idx].href);
            }}
            placeholder={tr("Search or type a command…")}
            aria-label={tr("Search")}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
          />
          {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />}
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-subtle">{q.length >= 2 && !loading ? tr("No results") : tr("Type to search")}</li>}
          {items.map((it, i) => (
            <li key={it.href + i} role="option" aria-selected={i === idx}>
              <button onMouseEnter={() => setIdx(i)} onClick={() => go(it.href)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", i === idx && "bg-white/[0.06]")}>
                <it.icon className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{it.title}</span>
                  {it.subtitle && <span className="block truncate text-xs text-subtle">{it.subtitle}</span>}
                </span>
                {i === idx && <CornerDownLeft className="size-3.5 text-subtle" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type N = { id: string; title: string; message: string; actionUrl: string | null; readAt: string | null; createdAt: string; category: string };

export function NotificationBell({ base = "/app" }: { base?: string }) {
  const { t, fmt } = useI18n();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: N[] }>({ unread: 0, items: [] });
  const router = useRouter();
  const load = async () => {
    try {
      const r = await fetch("/api/notifications?limit=8", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
  };
  useEffect(() => {
    load();
    // Lightweight polling keeps the badge fresh without realtime infrastructure.
    const t = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    return () => clearInterval(t);
  }, []);
  const markAll = async () => {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    load();
    router.refresh();
  };
  const openItem = async (n: N) => {
    setOpen(false);
    if (!n.readAt) await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) });
    load();
    if (n.actionUrl) router.push(n.actionUrl);
  };
  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); if (!open) load(); }} aria-label={data.unread ? t("Notifications ({n} unread)", { n: data.unread }) : t("Notifications")} aria-expanded={open} className="relative flex size-9 items-center justify-center rounded-[10px] text-muted hover:bg-white/[0.05] hover:text-fg">
        <Bell className="size-[18px]" />
        {data.unread > 0 && <span className="num absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9.5px] font-semibold text-white">{data.unread > 9 ? "9+" : data.unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-medium"><Tr>Notifications</Tr></span>
              {data.unread > 0 && <button onClick={markAll} className="text-xs text-muted hover:text-fg"><Tr>Mark all as read</Tr></button>}
            </div>
            <ul className="max-h-[60vh] overflow-y-auto">
              {data.items.length === 0 && <li className="px-4 py-10 text-center text-sm text-subtle"><Tr>You&apos;re all caught up.</Tr></li>}
              {data.items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => openItem(n)} className="flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-white/[0.03]">
                    <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent")} aria-label={n.readAt ? undefined : t("Unread")} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{n.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.message}</span>
                      <span className="mt-1 block text-[11px] text-subtle">{fmt.rel(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Link href={`${base}/notifications`} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-xs text-muted hover:text-fg"><Tr>View all</Tr></Link>
          </div>
        </>
      )}
    </div>
  );
}
