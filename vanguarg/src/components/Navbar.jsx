import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useClerk } from "@clerk/react";
import { api } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";
import Logo from "./Logo";
import "./Navbar.css";

function isTypingField(element) {
  if (!element || element === document.body) return false;
  const tag = element.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = String(element.type || "text").toLowerCase();
    return ![
      "checkbox",
      "radio",
      "button",
      "submit",
      "reset",
      "file",
      "hidden",
      "range",
      "color",
    ].includes(type);
  }
  return Boolean(element.isContentEditable);
}

export default function Navbar() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const desktopLinks = [
    { to: "/", label: t("navHome"), end: true },
    { to: "/pronat", label: t("navProperties") },
    { to: "/#leistungen", label: t("navServices"), service: true },
    { to: "/rreth-nesh", label: t("navAbout") },
    ...(isSignedIn
      ? [{ to: "/inbox", label: isAdminUser ? t("navInbox") : t("navSupport") }]
      : []),
    ...(isAdminUser ? [{ to: "/admin", label: t("navAdmin") }] : []),
  ];
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches,
  );
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const isHome = location.pathname === "/";
  const isProperties = location.pathname.startsWith("/pronat");
  const isAbout = location.pathname.startsWith("/rreth-nesh");
  const isServices = location.pathname === "/" && location.hash === "#leistungen";
  const isInbox = location.pathname.startsWith("/inbox");
  const isAdmin = location.pathname.startsWith("/admin");
  const isAccount =
    location.pathname === "/hyr" ||
    location.pathname.startsWith("/hyr/") ||
    location.pathname === "/regjistrohu" ||
    location.pathname.startsWith("/regjistrohu/");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setIsAdminUser(false);
      return;
    }

    let ignore = false;
    getToken()
      .then((token) => api("/api/me", { token }))
      .then((me) => {
        if (!ignore) setIsAdminUser(me.role === "admin");
      })
      .catch(() => {
        if (!ignore) setIsAdminUser(false);
      });

    return () => {
      ignore = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setKeyboardOpen(false);
      return;
    }

    let timer = 0;
    const sync = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setKeyboardOpen(isTypingField(document.activeElement));
      }, 60);
    };

    window.addEventListener("focusin", sync);
    window.addEventListener("focusout", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focusin", sync);
      window.removeEventListener("focusout", sync);
    };
  }, [isMobile]);

  return (
    <>
      {!isMobile && (
        <header className="navbar">
          <div className="navbar-inner">
            <NavLink to="/" className="navbar-logo" end aria-label="Vanguard">
              <Logo />
            </NavLink>
            <nav className="navbar-links" aria-label="Main">
              {desktopLinks.map((link) => {
                const active = link.service
                  ? isServices
                  : link.end
                    ? location.pathname === "/" && !isServices
                    : location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={active ? "active" : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="navbar-actions">
              <LanguageSwitcher />
              {isSignedIn ? (
                <button type="button" className="login-link" onClick={handleLogout}>
                  {t("navLogout")}
                </button>
              ) : (
                <>
                  <NavLink to="/hyr" className="login-link">
                    {t("navLogin")}
                  </NavLink>
                  <NavLink to="/regjistrohu" className="register-link">
                    {t("navRegister")}
                  </NavLink>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {isMobile && (
        <div className="mobile-lang">
          <LanguageSwitcher />
        </div>
      )}

      {isMobile && (
        <nav
          className={`mobile-bottom-nav${keyboardOpen ? " mobile-bottom-nav--hidden" : ""}`}
          aria-label="Mobile navigation"
          aria-hidden={keyboardOpen}
        >
          <NavLink
            to="/"
            end
            className={() => `mobile-nav-item${isHome && !isServices ? " active" : ""}`}
          >
            <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20z" />
              <path d="M9.5 21.5v-7h5v7" />
            </svg>
            <span>{t("navHome")}</span>
          </NavLink>

          <NavLink
            to="/pronat"
            className={() => `mobile-nav-item${isProperties ? " active" : ""}`}
          >
            <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20V9.5L12 4l8 5.5V20" />
              <path d="M9 20v-6h6v6" />
            </svg>
            <span>{t("navProperties")}</span>
          </NavLink>

          {isAdminUser ? (
            <NavLink
              to="/admin"
              className={() => `mobile-nav-center${isAdmin ? " active" : ""}`}
              aria-label={t("navAdmin")}
            >
              <span className="mobile-nav-center-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </NavLink>
          ) : (
            <Link
              to="/#leistungen"
              className={`mobile-nav-item${isServices ? " active" : ""}`}
              aria-current={isServices ? "page" : undefined}
            >
              <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 7h14M5 12h14M5 17h14" />
              </svg>
              <span>{t("navServices")}</span>
            </Link>
          )}

          {isSignedIn ? (
            <NavLink
              to="/inbox"
              className={() => `mobile-nav-item${isInbox ? " active" : ""}`}
            >
              <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6.5h16v11H4z" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              <span>{isAdminUser ? t("navInbox") : t("navSupport")}</span>
            </NavLink>
          ) : (
            <NavLink
              to="/rreth-nesh"
              className={() => `mobile-nav-item${isAbout ? " active" : ""}`}
            >
              <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 11v5" />
                <path d="M12 8h.01" />
              </svg>
              <span>{t("navAbout")}</span>
            </NavLink>
          )}

          {isSignedIn ? (
            <button type="button" className="mobile-nav-item" onClick={handleLogout}>
              <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17" />
                <path d="M4 12h10" />
                <path d="M7 9l-3 3 3 3" />
              </svg>
              <span>{t("navLogout")}</span>
            </button>
          ) : (
            <NavLink
              to="/hyr"
              className={() => `mobile-nav-item${isAccount ? " active" : ""}`}
            >
              <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.2" />
                <path d="M5.5 19.2c.9-3.1 3.4-4.7 6.5-4.7s5.6 1.6 6.5 4.7" />
              </svg>
              <span>{t("navLogin")}</span>
            </NavLink>
          )}
        </nav>
      )}
    </>
  );
}
