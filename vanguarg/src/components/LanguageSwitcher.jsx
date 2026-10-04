import { useLanguage } from "../i18n/LanguageContext";
import "./LanguageSwitcher.css";

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className="lang-switch" role="group" aria-label={t("langSwitch")}>
      <button
        type="button"
        aria-pressed={lang === "de"}
        onClick={() => setLang("de")}
      >
        DE
      </button>
      <button
        type="button"
        aria-pressed={lang === "en"}
        onClick={() => setLang("en")}
      >
        EN
      </button>
    </div>
  );
}
