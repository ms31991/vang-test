import { Link } from "react-router-dom";
import { legalOrder, legalPages } from "../content/legal";
import { useLanguage } from "../i18n/LanguageContext";
import { usePageSeo } from "../seo/usePageSeo";
import "./LegalPage.css";

export default function LegalPage({ page }) {
  const { lang } = useLanguage();
  const pack = legalPages[lang] || legalPages.de;
  const content = pack[page];
  usePageSeo({
    title: `${content.title} | Vanguard`,
    description: content.lead,
    path: `/${page}`,
  });

  return (
    <article className="section legal">
      <p className="legal-kicker">{lang === "en" ? "Legal" : "Rechtliches"}</p>
      <h1>{content.title}</h1>
      <p className="legal-lead">{content.lead}</p>
      <p className="legal-updated">{content.updated}</p>
      {content.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.list ? (
            <ul>
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <nav className="legal-related" aria-label={lang === "en" ? "Legal" : "Rechtliches"}>
        {legalOrder.filter((key) => key !== page).map((key) => (
          <Link key={key} to={`/${key}`}>{pack[key].title}</Link>
        ))}
      </nav>
    </article>
  );
}
