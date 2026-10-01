import { getLocale, pageTitle } from "@/lib/i18n/server";
import { makeFmt } from "@/lib/i18n/core";
import { LEGAL, type LegalSection } from "@/lib/legal";
import { LegalArticle } from "@/components/legal-article";

export const generateMetadata = pageTitle("Privacy");

const C = LEGAL.company;

const content: Record<"fr" | "en", { title: string; intro: string; updated: string; sections: LegalSection[] }> = {
  fr: {
    title: "Politique de confidentialité",
    updated: "Dernière mise à jour : {date}",
    intro: `Cette politique explique quelles données FollowMyFuture traite, pourquoi et comment. Elle est établie conformément à la loi fédérale suisse sur la protection des données (nLPD) et, lorsqu'il s'applique, au règlement général sur la protection des données de l'UE (RGPD).`,
    sections: [
      ["Responsable du traitement", [`Pour les données liées à votre compte et à votre abonnement, le responsable du traitement est ${C}, société de services numériques établie en Suisse (contact : ${LEGAL.email}).`, `Pour les données de leurs clients et collaborateurs, les propriétaires d'espace de travail sont responsables du traitement ; ${C} agit en tant que sous-traitant, uniquement sur leurs instructions.`]],
      ["Données traitées", "Données de compte (nom, e-mail, mot de passe chiffré), contenus de l'espace de travail que vous créez (clients, projets, fichiers, messages, factures), données d'abonnement et de facturation, et journaux techniques nécessaires à la sécurité."],
      ["Finalités", "Fournir et sécuriser le service, envoyer les e-mails transactionnels (invitations, rapports, factures, reçus, rappels), facturer les abonnements, prévenir les abus et améliorer le service. Nous ne vendons aucune donnée personnelle et n'en faisons aucun usage publicitaire."],
      ["Prestataires", "Nous faisons appel à des prestataires soigneusement choisis : Vercel (hébergement de l'application), Neon (base de données), Stripe (paiements — nous ne stockons jamais les numéros de carte complets) et Resend (envoi d'e-mails). Certains sont situés hors de Suisse, notamment aux États-Unis ; ces transferts sont encadrés par des garanties appropriées (clauses contractuelles types, cadres de protection des données reconnus)."],
      ["Fichiers", "Les fichiers sont stockés de façon privée et servis uniquement via des liens signés à durée de vie courte, après vérification des autorisations. Les fichiers supprimés sont conservés 30 jours pour permettre leur restauration, puis effacés."],
      ["Conservation", "Les données de compte sont conservées tant que le compte est actif, puis supprimées dans un délai raisonnable après sa fermeture. Les documents comptables (factures, paiements) sont conservés pendant la durée légale (10 ans en Suisse)."],
      ["Vos droits", `Vous pouvez demander l'accès à vos données, leur rectification, leur suppression, leur portabilité, ou vous opposer à certains traitements, en écrivant à ${LEGAL.email}. Vous pouvez aussi saisir le Préposé fédéral à la protection des données et à la transparence (PFPDT) ou, si vous résidez dans l'UE, l'autorité de contrôle de votre pays.`],
      ["Cookies", "Nous utilisons uniquement les cookies nécessaires au fonctionnement du service (session, langue, sécurité). Aucun cookie publicitaire ni de suivi tiers n'est utilisé."],
    ],
  },
  en: {
    title: "Privacy policy",
    updated: "Last updated: {date}",
    intro: "This policy explains what data FollowMyFuture processes, why and how. It follows the Swiss Federal Act on Data Protection (FADP) and, where applicable, the EU General Data Protection Regulation (GDPR).",
    sections: [
      ["Controller", [`For data about your account and subscription, the controller is ${C}, a digital services company based in Switzerland (contact: ${LEGAL.email}).`, `For the data of their clients and collaborators, workspace owners are the controllers; ${C} acts as their processor, only on their instructions.`]],
      ["Data we process", "Account data (name, email, hashed password), workspace content you create (clients, projects, files, messages, invoices), subscription and billing data, and technical logs needed for security."],
      ["Purposes", "Providing and securing the service, sending transactional emails (invitations, reports, invoices, receipts, reminders), billing subscriptions, preventing abuse and improving the service. We never sell personal data or use it for advertising."],
      ["Service providers", "We rely on carefully selected providers: Vercel (application hosting), Neon (database), Stripe (payments — we never store full card numbers) and Resend (email delivery). Some are located outside Switzerland, notably in the United States; these transfers are covered by appropriate safeguards (standard contractual clauses, recognised data protection frameworks)."],
      ["Files", "Files are stored privately and served only through short-lived signed links after an authorisation check. Deleted files are kept for 30 days so they can be restored, then erased."],
      ["Retention", "Account data is kept while the account is active, then deleted within a reasonable time after it is closed. Accounting records (invoices, payments) are kept for the legal period (10 years in Switzerland)."],
      ["Your rights", `You can ask to access, correct, delete or port your data, or object to some processing, by writing to ${LEGAL.email}. You may also contact the Swiss Federal Data Protection and Information Commissioner (FDPIC) or, if you live in the EU, your local supervisory authority.`],
      ["Cookies", "We only use cookies needed for the service to work (session, language, security). No advertising or third-party tracking cookies are used."],
    ],
  },
};

export default async function Privacy() {
  const l = await getLocale();
  const c = content[l];
  return <LegalArticle title={c.title} intro={c.intro} updated={c.updated.replace("{date}", makeFmt(l).date(LEGAL.updated, { day: "numeric", month: "long", year: "numeric" }))} sections={c.sections} />;
}
