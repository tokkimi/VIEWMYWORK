import { getLocale, pageTitle } from "@/lib/i18n/server";
import { makeFmt } from "@/lib/i18n/core";
import { LEGAL, type LegalSection } from "@/lib/legal";
import { LegalArticle } from "@/components/legal-article";

export const generateMetadata = pageTitle("General terms of sale");

const C = LEGAL.company;

const content: Record<"fr" | "en", { title: string; intro: string; updated: string; sections: LegalSection[] }> = {
  fr: {
    title: "Conditions générales de vente",
    updated: "Dernière mise à jour : {date}",
    intro: `Les présentes conditions générales de vente (CGV) régissent la souscription aux abonnements payants du service FollowMyFuture, édité par ${C}, société de services numériques établie en Suisse (« nous »). Elles s'appliquent à toute souscription effectuée depuis followmyfuture.com et complètent les conditions générales d'utilisation.`,
    sections: [
      ["Clientèle visée", "Le service est destiné aux professionnels (indépendants, studios, agences et entreprises) qui l'utilisent dans le cadre de leur activité. En souscrivant, vous déclarez agir à titre professionnel."],
      ["Offres et prix", ["Les formules (Starter, Pro, Business…), leur contenu et leurs limites sont décrits sur la page Tarifs. Les prix sont indiqués dans la devise affichée, par mois ou par an, taxes éventuellement applicables en sus.", "Le prix affiché au moment de la souscription s'applique à votre abonnement. Une modification ultérieure de nos tarifs publics ne modifie pas le prix d'un abonnement en cours ; tout changement de prix vous serait annoncé au moins 30 jours à l'avance par e-mail."]],
      ["Période d'essai gratuite", "Chaque nouvel espace de travail bénéficie d'une période d'essai gratuite dont la durée est indiquée lors de l'inscription. Une carte de paiement est demandée au démarrage de l'essai, mais rien n'est débité pendant l'essai. Un rappel vous est envoyé 3 jours avant la fin de l'essai. Sans résiliation de votre part avant cette date, l'abonnement démarre automatiquement et le premier paiement est prélevé."],
      ["Paiement", ["Les abonnements sont payables d'avance, au début de chaque période (mois ou année), par carte bancaire. Les paiements sont traités par notre prestataire de paiement sécurisé Stripe ; nous ne conservons jamais vos numéros de carte complets.", "Chaque paiement donne lieu à une facture, consultable depuis votre espace (Réglages → Abonnement)."]],
      ["Changement de formule", ["Passage à une formule supérieure : il prend effet immédiatement. Vous ne payez que la différence, calculée au prorata du temps restant sur la période en cours ; ce montant est prélevé le jour du changement.", "Passage à une formule inférieure : il prend effet immédiatement ; la partie non utilisée de votre formule précédente vous est créditée et déduite de vos prochaines factures.", "Pendant la période d'essai, un changement de formule n'entraîne aucun paiement ; le nouveau tarif s'applique à la fin de l'essai.", "Le montant exact est affiché avant toute confirmation."]],
      ["Renouvellement et résiliation", ["L'abonnement est renouvelé automatiquement à la fin de chaque période, pour une durée identique.", "Vous pouvez résilier à tout moment depuis Réglages → Abonnement. La résiliation prend effet à la fin de la période déjà payée : vous conservez l'accès jusqu'à cette date et aucun nouveau paiement n'est prélevé. Les périodes entamées ne sont pas remboursées, sauf disposition légale impérative contraire."]],
      ["Défaut de paiement", "Si un paiement échoue, nous vous en informons et de nouvelles tentatives sont effectuées. Tant que le paiement n'est pas régularisé, l'accès peut être limité à la consultation. Vos données ne sont pas supprimées du fait d'un incident de paiement."],
      ["Droit de rétractation", "Le service étant destiné aux professionnels, aucun droit de rétractation ne s'applique ; le droit suisse ne prévoit d'ailleurs pas de droit de rétractation général pour les contrats conclus en ligne. Si vous êtes néanmoins un consommateur résidant dans l'Union européenne, vous disposez d'un délai de 14 jours à compter de la souscription pour vous rétracter, en nous écrivant à l'adresse de contact ; si vous avez demandé que le service commence pendant ce délai, un montant proportionnel au service fourni reste dû."],
      ["Responsabilité", "Nous mettons tout en œuvre pour fournir un service fiable et disponible. Dans la mesure permise par la loi, notre responsabilité est limitée aux dommages directs et au montant payé pour l'abonnement au cours des douze mois précédant l'événement. Cette limitation ne s'applique pas en cas de faute intentionnelle ou de négligence grave."],
      ["Données personnelles", "Le traitement de vos données est décrit dans notre politique de confidentialité, conformément à la loi fédérale suisse sur la protection des données (nLPD) et, lorsqu'il s'applique, au RGPD."],
      ["Modification des CGV", "Nous pouvons faire évoluer les présentes CGV. Toute modification importante vous est notifiée par e-mail au moins 30 jours avant son entrée en vigueur ; vous pouvez résilier sans frais avant cette date si vous ne l'acceptez pas."],
      ["Droit applicable et for", `Les présentes CGV sont soumises au droit suisse, à l'exclusion de la Convention de Vienne sur la vente internationale de marchandises. Tout litige relève des tribunaux compétents au siège de ${C}, en Suisse, sous réserve des fors impératifs prévus par la loi. Avant toute action, nous vous invitons à nous contacter pour rechercher une solution amiable : ${LEGAL.email}.`],
    ],
  },
  en: {
    title: "Terms of sale",
    updated: "Last updated: {date}",
    intro: `These terms of sale govern paid subscriptions to the FollowMyFuture service, published by ${C}, a digital services company based in Switzerland ("we"). They apply to every subscription made on followmyfuture.com and complement the terms of use.`,
    sections: [
      ["Who the service is for", "The service is intended for professionals (freelancers, studios, agencies and companies) using it for their business. By subscribing, you confirm you are acting in a professional capacity."],
      ["Plans and prices", ["Plans (Starter, Pro, Business…), their content and limits are described on the Pricing page. Prices are shown in the displayed currency, per month or per year, plus any applicable taxes.", "The price shown when you subscribe applies to your subscription. Later changes to our public prices don't affect a running subscription; any price change would be announced by email at least 30 days in advance."]],
      ["Free trial", "Every new workspace gets a free trial whose length is shown at sign-up. A payment card is requested when the trial starts, but nothing is charged during the trial. A reminder is sent 3 days before it ends. Unless you cancel before then, the subscription starts automatically and the first payment is charged."],
      ["Payment", ["Subscriptions are paid in advance at the start of each period (month or year), by card. Payments are processed by our secure payment provider Stripe; we never store full card numbers.", "Every payment comes with an invoice, available in your workspace (Settings → Subscription)."]],
      ["Changing plan", ["Upgrading takes effect immediately. You only pay the difference, prorated to the time left in the current period; it is charged on the day of the change.", "Downgrading takes effect immediately; the unused part of your previous plan is credited and deducted from your next invoices.", "During the trial, changing plan triggers no payment; the new price applies when the trial ends.", "The exact amount is shown before you confirm."]],
      ["Renewal and cancellation", ["The subscription renews automatically at the end of each period, for the same duration.", "You can cancel at any time in Settings → Subscription. Cancellation takes effect at the end of the period already paid: you keep access until then and no further payment is taken. Started periods are not refunded, unless mandatory law provides otherwise."]],
      ["Failed payments", "If a payment fails, we let you know and retry. Until it is settled, access may be limited to read-only. Your data is not deleted because of a payment issue."],
      ["Right of withdrawal", "As the service is intended for professionals, no right of withdrawal applies; Swiss law also provides no general right of withdrawal for contracts concluded online. If you are nevertheless a consumer living in the European Union, you may withdraw within 14 days of subscribing by writing to our contact address; if you asked for the service to start during that period, an amount proportional to the service provided remains due."],
      ["Liability", "We do our best to provide a reliable, available service. To the extent permitted by law, our liability is limited to direct damage and to the amount paid for the subscription in the twelve months before the event. This limitation does not apply to intent or gross negligence."],
      ["Personal data", "How we process your data is described in our privacy policy, in line with the Swiss Federal Act on Data Protection (FADP) and, where applicable, the GDPR."],
      ["Changes to these terms", "We may update these terms. Any material change is notified by email at least 30 days before it takes effect; you may cancel free of charge before then if you don't accept it."],
      ["Governing law and jurisdiction", `These terms are governed by Swiss law, excluding the Vienna Convention on the International Sale of Goods. Disputes fall under the competent courts at the registered office of ${C}, in Switzerland, subject to mandatory jurisdictions provided by law. Before any action, please contact us to find an amicable solution: ${LEGAL.email}.`],
    ],
  },
};

export default async function SalesTerms() {
  const l = await getLocale();
  const c = content[l];
  return <LegalArticle title={c.title} intro={c.intro} updated={c.updated.replace("{date}", makeFmt(l).date(LEGAL.updated, { day: "numeric", month: "long", year: "numeric" }))} sections={c.sections} />;
}
