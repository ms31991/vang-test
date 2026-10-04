import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo";
import { api } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import "./RenovationBanner.css";

/* Rregullat më specifike më parë. E para që përputhet fiton. */
const ICON_RULES = [
  [/fliese|tile|plattenleger|pllak/i, Tile],
  [/bad|bath|dusche|shower|vask/i, Bath],
  [/küche|kuche|kueche|kitchen|möbel|moebel|kuzhin/i, Cabinet],
  [/maler|streich|farbe|paint|bojos|ngjyr/i, Roller],
  [/laminat|parkett|boden|floor|dysheme/i, Floor],
  [/heiz|heat|wärme|waerme|boiler|ngroh/i, Flame],
  [/elektr|electric|strom|bolt/i, Bolt],
  [/sanit|rohr|plumb|pipe|wasser|water|çezm|instalim/i, Faucet],
];

function iconFor(item) {
  if (item.icon && ICONS[item.icon]) return ICONS[item.icon];
  const text = `${item.titleDe || ""} ${item.titleEn || ""}`;
  const rule = ICON_RULES.find(([pattern]) => pattern.test(text));
  return rule ? rule[1] : Wrench;
}

export default function RenovationBanner() {
  const { lang, t } = useLanguage();
  const [services, setServices] = useState([]);

  useEffect(() => {
    let ignore = false;
    api("/api/services")
      .then((rows) => {
        if (!ignore) setServices(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!ignore) setServices([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function title(item) {
    return lang === "en" ? item.titleEn || item.titleDe : item.titleDe;
  }

  return (
    <div className="reno-banner" id="kontakt">
      <div className="reno-scene">
        <Logo size="lg" />
      </div>
      <div className="reno-copy">
        <p className="reno-kicker">{t("renoBannerKicker")}</p>
        <h2>{t("renoBannerTitle")}</h2>
        <p>{t("renoBannerText")}</p>
        {services.length ? (
          <ul className="reno-jobs">
            {services.map((item, index) => {
              const Icon = iconFor(item);
              return (
                <li key={item.id || index}>
                  <Link to={{ pathname: "/ueber-uns", hash: `trade-${item.id}` }}>
                    <Icon />
                    <span>{title(item)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function Wrench() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.3-.6-.6-2.3 2.5-2.7z"
        fill="currentColor"
      />
    </svg>
  );
}

function Faucet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h9a4 4 0 0 1 4 4v1h-3v-1a1 1 0 0 0-1-1H4V8z" fill="currentColor" />
      <path
        d="M8 8V5h4v3M15 17c0 1.5 1.2 2.5 1.2 3.5a1.2 1.2 0 0 1-2.4 0C13.8 19.5 15 18.5 15 17z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function Bolt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6z" fill="currentColor" />
    </svg>
  );
}

function Drop() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2s7 8 7 13a7 7 0 0 1-14 0C5 10 12 2 12 2z" fill="currentColor" />
    </svg>
  );
}

function Flame() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2c2 4-1 5-1 8 2-1 4-1 5 2 2 4-1 10-6 10S3 17 5 12c1-2 3-3 3-6 0 2 2 2 4-4z" fill="currentColor" />
    </svg>
  );
}

function Floor() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 16h18v3H3zM3 11h18v3H3zM3 6h18v3H3z" fill="currentColor" />
    </svg>
  );
}

function Bath() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3zM7 12V8a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 20v2M16 20v2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Cabinet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 4v16M3 12h18" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Roller() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="14" height="6" rx="2" fill="currentColor" />
      <path d="M10 10v4h6v6" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Tile() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" />
      <rect x="13" y="3" width="8" height="8" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="3" y="13" width="8" height="8" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="13" y="13" width="8" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}

const ICONS = { Bolt, Drop, Flame, Floor, Bath, Cabinet, Roller, Tile, Faucet, Wrench };