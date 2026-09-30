import type { Metadata } from "next";
export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-20 text-[15px] leading-relaxed text-muted [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-fg">
      <h1 className="text-4xl font-semibold tracking-tight text-fg">Terms of service</h1>
      <p className="mt-4">By using ViewMyWork you agree to these terms.</p>
      <h2>Subscriptions</h2>
      <p>Paid plans renew automatically each billing period until cancelled. The price shown when you subscribe stays in effect for your subscription; later changes to public pricing do not alter it.</p>
      <h2>Client payments</h2>
      <p>Invoices you issue and payments you collect from your clients are between you and your clients. Payments are processed by Stripe on your own connected account; ViewMyWork is not a party to those transactions.</p>
      <h2>Acceptable use</h2>
      <p>You may not upload unlawful content, attempt to access other workspaces, or abuse the service.</p>
      <h2>Liability</h2>
      <p>The service is provided “as is”. To the extent permitted by law our liability is limited to the fees paid in the preceding twelve months.</p>
    </article>
  );
}
