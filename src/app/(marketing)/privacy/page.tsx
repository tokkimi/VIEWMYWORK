import { getLocale, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Privacy");

const content = {
  en: {
    title: "Privacy policy",
    intro: "This policy explains what data FollowMyFuture processes and why. Workspace owners act as data controllers for the client data they store; FollowMyFuture acts as their processor.",
    sections: [
      ["Data we process", "Account data (name, email, hashed password), workspace content you create (clients, projects, files, invoices), billing data handled by our payment processor, and technical logs necessary for security."],
      ["How we use it", "To provide the service, secure accounts, send transactional emails (invitations, invoices, receipts, password resets) and bill subscriptions. We do not sell personal data."],
      ["Payments", "Card payments are processed by Stripe. Client invoice payments go directly to the professional's connected Stripe account. We never store full card numbers."],
      ["Files", "Files are stored privately and served only through short-lived signed links after an authorization check."],
      ["Retention & your rights", "Financial records (invoices, payments) are retained as required by law. You may request access, correction or deletion of your personal data by contacting support."],
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    intro: "Cette politique explique quelles données FollowMyFuture traite et pourquoi. Les propriétaires d'espace de travail sont responsables de traitement des données clients qu'ils enregistrent ; FollowMyFuture agit en tant que sous-traitant.",
    sections: [
      ["Données traitées", "Données de compte (nom, e-mail, mot de passe chiffré), contenus de l'espace de travail que vous créez (clients, projets, fichiers, factures), données de facturation gérées par notre prestataire de paiement, et journaux techniques nécessaires à la sécurité."],
      ["Utilisation", "Fournir le service, sécuriser les comptes, envoyer les e-mails transactionnels (invitations, factures, reçus, réinitialisations de mot de passe) et facturer les abonnements. Nous ne vendons aucune donnée personnelle."],
      ["Paiements", "Les paiements par carte sont traités par Stripe. Les paiements de factures clients sont versés directement sur le compte Stripe connecté du professionnel. Nous ne stockons jamais les numéros de carte complets."],
      ["Fichiers", "Les fichiers sont stockés de façon privée et servis uniquement via des liens signés à durée de vie courte, après vérification des autorisations."],
      ["Conservation et droits", "Les documents financiers (factures, paiements) sont conservés conformément à la loi. Vous pouvez demander l'accès, la rectification ou la suppression de vos données personnelles en contactant le support."],
    ],
  },
};

export default async function Privacy() {
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
