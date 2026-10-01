import { getLocale, pageTitle } from "@/lib/i18n/server";
import { makeFmt } from "@/lib/i18n/core";
import { LEGAL, type LegalSection } from "@/lib/legal";
import { LegalArticle } from "@/components/legal-article";

export const generateMetadata = pageTitle("Legal notice");

export default async function LegalNotice() {
  const l = await getLocale();
  const fr = l === "fr";
  const publisher = [
    `${LEGAL.company} — ${fr ? "société de services numériques" : "digital services company"}`,
    LEGAL.address ?? (fr ? "Siège : Suisse" : "Registered office: Switzerland"),
    ...(LEGAL.ide ? [`${fr ? "Numéro IDE" : "Company number (UID)"} : ${LEGAL.ide}`] : []),
    `${fr ? "Contact" : "Contact"} : ${LEGAL.email}`,
  ];
  const sections: LegalSection[] = fr
    ? [
        ["Éditeur", publisher],
        ["Directeur de la publication", `Le représentant légal de ${LEGAL.company}.`],
        ["Hébergement", "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com. Base de données : Neon (neon.tech)."],
        ["Propriété intellectuelle", `Le site, la marque FollowMyFuture, les textes, le code et les éléments graphiques sont la propriété de ${LEGAL.company}. Toute reproduction sans autorisation est interdite.`],
        ["Documents contractuels", "Conditions générales d'utilisation, conditions générales de vente et politique de confidentialité, accessibles en bas de chaque page."],
      ]
    : [
        ["Publisher", publisher],
        ["Publication director", `The legal representative of ${LEGAL.company}.`],
        ["Hosting", "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States — vercel.com. Database: Neon (neon.tech)."],
        ["Intellectual property", `The website, the FollowMyFuture brand, texts, code and graphics are the property of ${LEGAL.company}. Any reproduction without permission is prohibited.`],
        ["Contract documents", "Terms of use, terms of sale and privacy policy, linked at the bottom of every page."],
      ];
  return <LegalArticle title={fr ? "Mentions légales" : "Legal notice"} updated={(fr ? "Dernière mise à jour : " : "Last updated: ") + makeFmt(l).date(LEGAL.updated, { day: "numeric", month: "long", year: "numeric" })} sections={sections} />;
}
