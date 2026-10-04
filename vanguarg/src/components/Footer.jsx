import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { useCookieConsent } from "../consent/CookieConsent";
import Logo from "./Logo";
import "./Footer.css";

export default function Footer() {
  const { t } = useLanguage();
  const { openSettings } = useCookieConsent();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: t("footerBuy"),
      links: [
        { label: t("categorySale"), to: "/pronat#verkauf" },
        { label: t("footerAll"), to: "/pronat" },
        { label: t("footerSearch"), to: "/#suche" },
      ],
    },
    {
      title: t("footerRent"),
      links: [
        { label: t("categoryRent"), to: "/pronat#miete" },
        { label: t("footerAll"), to: "/pronat" },
      ],
    },
    {
      title: t("footerReno"),
      links: [
        { label: t("seoLaminate"), to: "/#trade-seoLaminate" },
        { label: t("seoParquet"), to: "/#trade-seoParquet" },
        { label: t("seoElectric"), to: "/#trade-seoElectric" },
        { label: t("seoPlumbing"), to: "/#trade-seoPlumbing" },
        { label: t("seoBath"), to: "/#trade-seoBath" },
      ],
    },
    {
      title: t("footerCompany"),
      links: [
        { label: t("navAbout"), to: "/rreth-nesh" },
        { label: t("servicesTitle"), to: "/#leistungen" },
        { label: t("footerContact"), to: "/#kontakt" },
        { label: t("navLogin"), to: "/hyr" },
        { label: t("navRegister"), to: "/regjistrohu" },
      ],
    },
    {
      title: t("footerLegal"),
      links: [
        { label: t("footerPrivacy"), to: "/datenschutz" },
        { label: t("footerTerms"), to: "/agb" },
        { label: t("footerCookies"), to: "/cookies" },
        { label: t("footerImprint"), to: "/impressum" },
      ],
    },
  ];

  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Link to="/" className="footer-logo" aria-label="Vanguard">
            <Logo size="sm" tone="light" />
          </Link>
          <p className="footer-tagline">{t("footerText")}</p>
        </div>

        {columns.map((column) => (
          <div className="footer-column" key={column.title}>
            <h2 className="footer-column-title">{column.title}</h2>
            <ul className="footer-links">
              {column.links.map((link) => (
                <li key={link.to + link.label}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">
          © {year} Vanguard — {t("footerRights")}
        </p>
        <button type="button" className="footer-cookies" onClick={openSettings}>
          {t("cookieSettings")}
        </button>
      </div>
    </footer>
  );
}
