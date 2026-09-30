import { requireWorkspace } from "@/lib/auth/context";
import { PageHeader, Section } from "@/components/ui/primitives";
import { ProfileForm, PasswordForm } from "@/components/profile-forms";
import { logoutAction } from "@/server/actions/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Profile" };

export default async function Profile() {
  const ctx = await requireWorkspace();
  const sessions = await db.session.findMany({ where: { userId: ctx.user.id, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: "desc" }, take: 10 });
  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" description={ctx.user.email} />
      <div className="space-y-12">
        <Section title="Personal information"><div className="panel rounded-2xl p-5"><ProfileForm name={ctx.user.name} timezone={ctx.user.timezone} locale={ctx.user.locale} /></div></Section>
        <Section title="Password"><div className="panel rounded-2xl p-5"><PasswordForm /></div></Section>
        <Section title="Active sessions">
          <ul className="panel divide-y divide-line rounded-2xl text-sm">
            {sessions.map((s) => <li key={s.id} className="flex justify-between gap-3 px-4 py-2.5"><span className="truncate text-muted">{s.userAgent?.slice(0, 70) ?? "Unknown device"}</span><span className="shrink-0 text-xs text-subtle">{fmtDateTime(s.lastUsedAt)}</span></li>)}
          </ul>
        </Section>
        <form action={logoutAction}><button className="text-sm text-muted hover:text-danger">Sign out</button></form>
      </div>
    </div>
  );
}
