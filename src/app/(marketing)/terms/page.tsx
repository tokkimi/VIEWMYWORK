import { getLocale, pageTitle } from "@/lib/i18n/server";
import { makeFmt } from "@/lib/i18n/core";
import { LEGAL, type LegalSection } from "@/lib/legal";
import { LegalArticle } from "@/components/legal-article";

export const generateMetadata = pageTitle("Terms of use");

const C = LEGAL.company;

const content: Record<"fr" | "en", { title: string; intro: string; updated: string; sections: LegalSection[] }> = {
  fr: {
    title: "Conditions générales d'utilisation",
    updated: "Dernière mise à jour : {date}",
    intro: `Les présentes conditions générales d'utilisation (CGU) encadrent l'accès et l'utilisation de FollowMyFuture, plateforme de suivi de projets et de portail client éditée par ${C}, société de services numériques établie en Suisse. En créant un compte ou en utilisant le service, vous les acceptez. Les abonnements payants sont en outre régis par nos conditions générales de vente.`,
    sections: [
      ["Le service", "FollowMyFuture permet aux professionnels de structurer leurs projets, de partager l'avancement, les livrables, les fichiers et les factures avec leurs clients via un portail, et de piloter leur activité. Nous pouvons faire évoluer les fonctionnalités pour améliorer le service."],
      ["Comptes et accès", ["Vous devez fournir des informations exactes et garder vos identifiants confidentiels. Toute action effectuée depuis votre compte est réputée faite par vous.", "Le propriétaire d'un espace de travail décide qui y accède (collaborateurs, clients) et avec quels droits ; il est responsable des accès qu'il accorde, y compris des liens d'accès partagés par e-mail, WhatsApp ou autre."]],
      ["Vos contenus", "Vous restez propriétaire des contenus que vous déposez (projets, fichiers, messages, factures…). Vous nous accordez uniquement le droit de les héberger, de les traiter et de les afficher aux personnes que vous autorisez, dans la mesure nécessaire au fonctionnement du service. Vous garantissez disposer des droits nécessaires sur ces contenus."],
      ["Usages interdits", "Il est interdit de déposer des contenus illicites, contrefaisants ou malveillants, de tenter d'accéder à des données d'autres espaces de travail, de perturber le service (surcharge, contournement des sécurités), de revendre l'accès sans accord, ou d'utiliser le service pour envoyer des communications non sollicitées."],
      ["Paiements de vos clients", "Les factures que vous émettez et les paiements que vous encaissez auprès de vos clients relèvent exclusivement de votre relation avec eux. Le paiement en ligne passe par votre propre compte Stripe connecté ; nous ne sommes pas partie à ces transactions et ne détenons pas ces fonds."],
      ["Disponibilité", "Nous mettons tout en œuvre pour assurer un service accessible en permanence, sans garantie d'absence totale d'interruption. Des opérations de maintenance peuvent avoir lieu ; nous nous efforçons de les limiter. Les fichiers supprimés restent récupérables pendant 30 jours."],
      ["Propriété intellectuelle", `La plateforme, sa marque, son code et son design appartiennent à ${C}. Aucun droit autre que celui d'utiliser le service conformément aux présentes ne vous est concédé.`],
      ["Suspension et fin d'utilisation", "Nous pouvons suspendre un accès en cas de manquement grave aux présentes CGU, après vous avoir averti sauf urgence. Vous pouvez cesser d'utiliser le service et demander la suppression de votre compte à tout moment ; vous pouvez exporter vos données avant la fermeture."],
      ["Responsabilité", "Le service est un outil : vous restez responsable de l'usage que vous en faites, des informations communiquées à vos clients et du respect de vos obligations (notamment fiscales et comptables). Dans la mesure permise par la loi, notre responsabilité est limitée conformément aux conditions générales de vente ; elle n'est pas limitée en cas de faute intentionnelle ou de négligence grave."],
      ["Données personnelles", `Pour les données de vos clients et collaborateurs que vous enregistrez, vous agissez comme responsable du traitement et ${C} comme sous-traitant. Le détail figure dans notre politique de confidentialité.`],
      ["Modification des CGU", "Nous pouvons modifier les présentes CGU ; les changements importants vous sont annoncés par e-mail ou dans l'application avant leur entrée en vigueur. Continuer à utiliser le service après cette date vaut acceptation."],
      ["Droit applicable", `Les présentes CGU sont soumises au droit suisse. Tout litige relève des tribunaux compétents au siège de ${C}, en Suisse, sous réserve des fors impératifs. Contact : ${LEGAL.email}.`],
    ],
  },
  en: {
    title: "Terms of use",
    updated: "Last updated: {date}",
    intro: `These terms of use govern access to and use of FollowMyFuture, a project tracking and client portal platform published by ${C}, a digital services company based in Switzerland. By creating an account or using the service, you accept them. Paid subscriptions are also governed by our terms of sale.`,
    sections: [
      ["The service", "FollowMyFuture lets professionals structure their projects, share progress, deliverables, files and invoices with their clients through a portal, and steer their business. We may evolve features to improve the service."],
      ["Accounts and access", ["You must provide accurate information and keep your credentials confidential. Any action taken from your account is deemed to be yours.", "A workspace owner decides who can access it (collaborators, clients) and with which rights, and is responsible for the access granted, including access links shared by email, WhatsApp or otherwise."]],
      ["Your content", "You remain the owner of the content you upload (projects, files, messages, invoices…). You only grant us the right to host, process and display it to the people you authorise, as needed to run the service. You warrant that you hold the necessary rights to this content."],
      ["Prohibited use", "You may not upload unlawful, infringing or malicious content, try to access other workspaces' data, disrupt the service (overload, bypassing security), resell access without agreement, or use the service to send unsolicited communications."],
      ["Your clients' payments", "Invoices you issue and payments you collect from your clients are solely between you and them. Online payment goes through your own connected Stripe account; we are not a party to those transactions and don't hold those funds."],
      ["Availability", "We do our best to keep the service available at all times, without guaranteeing it will never be interrupted. Maintenance may take place; we try to keep it short. Deleted files remain recoverable for 30 days."],
      ["Intellectual property", `The platform, its brand, code and design belong to ${C}. No rights are granted to you other than using the service in line with these terms.`],
      ["Suspension and termination", "We may suspend access in case of serious breach of these terms, after warning you except in emergencies. You may stop using the service and ask for your account to be deleted at any time; you can export your data before closing."],
      ["Liability", "The service is a tool: you remain responsible for how you use it, for the information shared with your clients and for meeting your obligations (including tax and accounting). To the extent permitted by law, our liability is limited as set out in the terms of sale; it is not limited for intent or gross negligence."],
      ["Personal data", `For the data of your clients and collaborators that you record, you act as data controller and ${C} as processor. Details are in our privacy policy.`],
      ["Changes to these terms", "We may change these terms; material changes are announced by email or in the app before they take effect. Continuing to use the service after that date means you accept them."],
      ["Governing law", `These terms are governed by Swiss law. Disputes fall under the competent courts at the registered office of ${C}, in Switzerland, subject to mandatory jurisdictions. Contact: ${LEGAL.email}.`],
    ],
  },
};

export default async function Terms() {
  const l = await getLocale();
  const c = content[l];
  return <LegalArticle title={c.title} intro={c.intro} updated={c.updated.replace("{date}", makeFmt(l).date(LEGAL.updated, { day: "numeric", month: "long", year: "numeric" }))} sections={c.sections} />;
}
