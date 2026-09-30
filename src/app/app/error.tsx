"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const denied = /permission|not found/i.test(error.message);
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-line bg-white/[0.03]"><AlertTriangle className="size-5 text-warning" /></div>
      <h1 className="mt-5 text-lg font-medium">{denied ? "You can't access this page" : "Something went wrong"}</h1>
      <p className="mt-2 text-sm text-muted">{denied ? "It may not exist, or you may not have permission to view it." : "We couldn't load this page. Check your connection and try again."}</p>
      <Button variant="secondary" className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
