import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import Logo from "../components/Logo";
import { useLanguage } from "../i18n/LanguageContext";
import { usePageSeo } from "../seo/usePageSeo";
import "./AboutUs.css";

const trades = [
  "seoLaminate",
  "seoParquet",
  "seoElectric",
  "seoPlumbing",
  "seoPaint",
  "seoTiles",
  "seoBath",
  "seoKitchen",
  "seoWindows",
  "seoDoors",
  "seoInsulation",
  "seoHeating",
  "seoPlaster",
  "seoFloors",
];

export default function AboutUs() {
  const { t } = useLanguage();
  const { isLoaded, isSignedIn } = useAuth();
  usePageSeo({
    title: `${t("navAbout")} | Vanguard`,
    description: t("aboutLead"),
    path: "/ueber-uns",
  });

  // I kyçur (ose Clerk po ngarkohet) → direkt te mesazhet.
  // Jo i kyçur → login, pastaj kthehet te mesazhet.
  const writeTo = !isLoaded || isSignedIn
    ? "/posteingang"
    : { pathname: "/anmelden", search: "?redirect=%2Fposteingang" };

  return (
    <article className="about">
      <header className="about-hero section">
        <Logo size="lg" tone="dark" />
        <p className="about-kicker">{t("navAbout")}</p>
        <h1>{t("aboutTitle")}</h1>
        <p className="about-lead">{t("aboutLead")}</p>
      </header>

      <section className="about-points section" aria-label={t("aboutHowTitle")}>
        <article>
          <h2>{t("aboutSaleTitle")}</h2>
          <p>{t("aboutSaleText")}</p>
          <Link to="/immobilien#verkauf">{t("seoBuyLink")}</Link>
        </article>
        <article>
          <h2>{t("aboutRentTitle")}</h2>
          <p>{t("aboutRentText")}</p>
          <Link to="/immobilien#miete">{t("seoRentLink")}</Link>
        </article>
        <article>
          <h2>{t("aboutRenoTitle")}</h2>
          <p>{t("aboutRenoText")}</p>
          <Link to="/#leistungen">{t("servicesTitle")}</Link>
        </article>
      </section>

      <section className="about-how">
        <div className="section">
          <h2>{t("aboutHowTitle")}</h2>
          <p>{t("aboutHow1")}</p>
          <p>{t("aboutHow2")}</p>
          <p>{t("aboutHow3")}</p>
        </div>
      </section>

      <section className="section about-works">
        <h2>{t("aboutTradesTitle")}</h2>
        <ul className="about-trades">
          {trades.map((key) => (
            <li key={key} id={`trade-${key}`}>{t(key)}</li>
          ))}
        </ul>
        <p className="about-close">{t("aboutClose")}</p>
        <Link className="about-write" to={writeTo}>{t("aboutWrite")}</Link>
      </section>
    </article>
  );
}