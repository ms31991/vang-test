import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import "./CookieConsent.css";

const STORAGE_KEY = "vanguard-consent";
const CookieConsentContext = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.optional !== "boolean") return null;
    return { optional: parsed.optional };
  } catch {
    return null;
  }
}

export function CookieConsentProvider({ children }) {
  const { t } = useLanguage();
  const [choice, setChoice] = useState(null);
  const [bannerOpen, setBannerOpen] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setChoice(stored);
      return;
    }
    setBannerOpen(true);
  }, []);

  const save = useCallback((optional) => {
    const next = { optional: Boolean(optional) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setChoice(next);
    setBannerOpen(false);
  }, []);

  const openSettings = useCallback(() => {
    setBannerOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      optionalAllowed: Boolean(choice?.optional),
      decided: Boolean(choice),
      openSettings,
    }),
    [choice, openSettings],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {bannerOpen ? (
        <div className="cookie-banner" role="dialog" aria-labelledby="cookie-title">
          <h2 id="cookie-title">{t("cookieTitle")}</h2>
          <p>
            {t("cookieText")} <Link to="/cookies">{t("cookieMore")}</Link>
          </p>
          <div className="cookie-actions">
            <button type="button" className="cookie-btn-primary" onClick={() => save(true)}>
              {t("cookieAccept")}
            </button>
            <button type="button" className="cookie-btn-ghost" onClick={() => save(false)}>
              {t("cookieReject")}
            </button>
          </div>
        </div>
      ) : null}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    return { optionalAllowed: false, decided: false, openSettings: () => {} };
  }
  return context;
}
