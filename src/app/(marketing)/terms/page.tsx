import { getLocale, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Terms");

const content = {
  en: {
    title: "Terms of service",
    intro: "By using FollowMyFuture you agree to these terms.",
    sections: [
      ["Subscriptions", "Paid plans renew automatically each billing period until cancelled. The price shown when you subscribe stays in effect for your subscription; later changes to public pricing do not alter it."],
      ["Client payments", "Invoices you issue and payments you collect from your clients are between you and your clients. Payments are processed by Stripe on your own connected account; FollowMyFuture is not a party to those transactions."],
      ["Acceptable use", "You may not upload unlawful content, attempt to access other workspaces, or abuse the service."],
      ["Liability", "The service is provided “as is”. To the extent permitted by law our liability is limited to the fees paid in the preceding twelve months."],
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    intro: "En utilisant FollowMyFuture, vous acceptez les présentes conditions.",
    sections: [
      ["Abonnements", "Les formules payantes sont renouvelées automatiquement à chaque période de facturation jusqu'à résiliation. Le prix affiché lors de la souscription reste appliqué à votre abonnement ; les modifications ultérieures des tarifs publics ne le changent pas."],
      ["Paiements clients", "Les factures que vous émettez et les paiements que vous encaissez auprès de vos clients relèvent de la relation entre vous et vos clients. Les paiements sont traités par Stripe sur votre propre compte connecté ; FollowMyFuture n'est pas partie à ces transactions."],
      ["Usage acceptable", "Il est interdit de téléverser des contenus illicites, de tenter d'accéder à d'autres espaces de travail ou d'abuser du service."],
      ["Responsabilité", "Le service est fourni « en l'état ». Dans la limite permise par la loi, notre responsabilité est limitée aux sommes payées au cours des douze mois précédents."],
    ],
  },
};

export default async function Terms() {
  const c = content[await getLocale()];
  return (
    <article className="mx-auto max-w-2xl px-5 py-20 text-[15px] leading-relaxed text-muted [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-fg">
      <h1 className="text-4xl font-semibold tracking-tight text-fg">{c.title}</h1>
      <p className="mt-4">{c.intro}</p>
      {c.sections.map(([h, p]) => (
        <section key={h}>
          <h2>{h}</h2>
          <p>{p}</p>
        </section>
      ))}
    </article>
  );
}
