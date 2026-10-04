import { useLanguage } from "../i18n/LanguageContext";
import { usePageSeo } from "../seo/usePageSeo";
import "./AboutUs.css";

export default function AboutUs() {
  const { t } = useLanguage();
  usePageSeo({
    title: `${t("navAbout")} | Vanguard`,
    description: t("seoMetaAbout"),
    path: "/rreth-nesh",
  });

  return (
    <section className="section about">
      <p className="eyebrow">{t("navAbout")}</p>
      <h1>Vanguard</h1>
      <p>{t("aboutLead")}</p>
      <ul>
        <li>{t("aboutItem1")}</li>
        <li>{t("aboutItem2")}</li>
        <li>{t("aboutItem3")}</li>
      </ul>
    </section>
  );
}
