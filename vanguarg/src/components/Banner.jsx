import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import Logo from "./Logo";
import "./Banner.css";

const COLS = 6;
const ROWS = 7;
// Dritaret e ndezura = shtëpi të lira (pozicionet janë të zgjedhura me dorë)
const LIT = [2, 8, 10, 15, 19, 22, 27, 31, 34, 38];


export default function Banner() {
  const { t } = useLanguage();

  return (
    <section className="banner">
      <div className="banner-copy">
        <Logo size="lg" />
        <h1>{t("bannerTitle")}</h1>
        <p className="banner-text">{t("bannerText")}</p>


        <Link to="/immobilien" className="banner-cta">
          {t("bannerCta")}
        </Link>
      </div>

      <div className="facade" aria-hidden="true">
        <div className="embers">
          
        </div>
        <div className="facade-roof" />
        <div className="facade-grid" style={{ "--cols": COLS }}>
          {Array.from({ length: COLS * ROWS }, (_, i) => (
            <span
              key={i}
              className={LIT.includes(i) ? "win lit" : "win"}
              style={{ "--d": `${LIT.indexOf(i) * 220 + 400}ms` }}
            />
          ))}
        </div>
        <div className="facade-door" />
      </div>
    </section>
  );
}