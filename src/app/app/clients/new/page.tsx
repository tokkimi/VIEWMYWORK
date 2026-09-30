import { requireWorkspace, requirePerm } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { ClientForm } from "@/components/app/client-form";

export const metadata = { title: "New client" };

export default async function NewClient() {
  const ctx = await requireWorkspace();
  requirePerm(ctx, "clients", "edit");
  return (
    <div className="max-w-3xl">
      <PageHeader title="New client" eyebrow="Clients" />
      <ClientForm v={{ currency: ctx.workspace.defaultCurrency }} />
    </div>
  );
}
