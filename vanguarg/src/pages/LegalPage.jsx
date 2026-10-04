import { useLanguage } from "../i18n/LanguageContext";
import { usePageSeo } from "../seo/usePageSeo";
import "./LegalPage.css";

const pages = {
  datenschutz: {
    title: "legalPrivacyTitle",
    body: ["legalPrivacy1", "legalPrivacy2", "legalPrivacy3"],
  },
  agb: {
    title: "legalTermsTitle",
    body: ["legalTerms1", "legalTerms2"],
  },
  cookies: {
    title: "legalCookiesTitle",
    body: ["legalCookies1", "legalCookies2", "legalCookies3"],
  },
  impressum: {
    title: "legalImprintTitle",
    body: ["legalImprint1", "legalImprint2"],
  },
};

export default function LegalPage({ page }) {
  const { t } = useLanguage();
  const content = pages[page];
  usePageSeo({
    title: `${t(content.title)} | Vanguard`,
    description: t(content.body[0]),
    path: `/${page}`,
  });

  return (
    <section className="section legal">
      <h1>{t(content.title)}</h1>
      {content.body.map((key) => (
        <p key={key}>{t(key)}</p>
      ))}
    </section>
  );
}
