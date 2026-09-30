import type { Metadata } from "next";
export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-20 text-[15px] leading-relaxed text-muted [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-fg">
      <h1 className="text-4xl font-semibold tracking-tight text-fg">Privacy policy</h1>
      <p className="mt-4">This policy explains what data ViewMyWork processes and why. Workspace owners act as data controllers for the client data they store; ViewMyWork acts as their processor.</p>
      <h2>Data we process</h2>
      <p>Account data (name, email, hashed password), workspace content you create (clients, projects, files, invoices), billing data handled by our payment processor, and technical logs necessary for security.</p>
      <h2>How we use it</h2>
      <p>To provide the service, secure accounts, send transactional emails (invitations, invoices, receipts, password resets) and bill subscriptions. We do not sell personal data.</p>
      <h2>Payments</h2>
      <p>Card payments are processed by Stripe. Client invoice payments go directly to the professional&apos;s connected Stripe account. We never store full card numbers.</p>
      <h2>Files</h2>
      <p>Files are stored privately and served only through short-lived signed links after an authorization check.</p>
      <h2>Retention & your rights</h2>
      <p>Financial records (invoices, payments) are retained as required by law. You may request access, correction or deletion of your personal data by contacting support.</p>
    </article>
  );
}
