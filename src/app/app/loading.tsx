import { Skeleton } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";

export default async function Loading() {
  const { t } = await getI18n();
  return (
    <div aria-busy="true" aria-label={t("Loading")}>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-6 h-72" />
    </div>
  );
}
