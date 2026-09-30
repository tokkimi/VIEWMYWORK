"use client";

import { Form, Submit } from "@/components/ui/form";
import { savePreferencesAction } from "@/server/actions/preferences";

export function PreferencesForm({ topics }: { topics: { key: string; label: string; inApp: boolean; email: boolean }[] }) {
  return (
    <Form action={savePreferencesAction} className="space-y-5">
      <div className="panel overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11.5px] uppercase tracking-wide text-subtle"><th className="border-b border-line px-4 py-2.5 font-medium">Topic</th><th className="w-24 border-b border-line px-4 py-2.5 text-center font-medium">In-app</th><th className="w-24 border-b border-line px-4 py-2.5 text-center font-medium">Email</th></tr></thead>
          <tbody>
            {topics.map((t) => (
              <tr key={t.key} className="border-b border-line last:border-0">
                <td className="px-4 py-3">{t.label}</td>
                <td className="px-4 py-3 text-center"><input type="checkbox" name={`${t.key}_inApp`} defaultChecked={t.inApp} aria-label={`${t.label} in-app`} className="size-4 accent-[#4d7cfe]" /></td>
                <td className="px-4 py-3 text-center"><input type="checkbox" name={`${t.key}_email`} defaultChecked={t.email} aria-label={`${t.label} email`} className="size-4 accent-[#4d7cfe]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-subtle">Transactional emails — invoices, payment receipts, password resets and invitations — are always delivered and don&apos;t depend on these preferences.</p>
      <div className="flex justify-end"><Submit>Save preferences</Submit></div>
    </Form>
  );
}
