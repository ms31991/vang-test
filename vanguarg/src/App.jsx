import { useEffect } from "react";
import { ClerkProvider } from "@clerk/react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { CookieConsentProvider } from "./consent/CookieConsent";
import Home from "./pages/Home";
import Properties from "./pages/Properties";
import PropertyDetails from "./pages/PropertyDetails";
import AboutUs from "./pages/AboutUs";
import Inbox from "./pages/Inbox";
import LegalPage from "./pages/LegalPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminPage from "./pages/AdminPage";
import PropertyEditPage from "./pages/PropertyEditPage";
import "./App.css";

const clerkAppearance = {
  options: {
    unsafe_disableDevelopmentModeWarnings: true,
  },
};

function RedirectKeep({ to }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

function RedirectProperty() {
  const { id } = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`/immobilien/${id}${search}${hash}`} replace />;
}

function ClerkRoutes() {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      signInUrl="/anmelden"
      signUpUrl="/registrieren"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      appearance={clerkAppearance}
    >
      <div className="app">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/immobilien" element={<Properties />} />
            <Route path="/immobilien/:id" element={<PropertyDetails />} />
            <Route path="/ueber-uns" element={<AboutUs />} />
            <Route path="/posteingang" element={<Inbox />} />
            <Route path="/datenschutz" element={<LegalPage page="datenschutz" />} />
            <Route path="/agb" element={<LegalPage page="agb" />} />
            <Route path="/cookies" element={<LegalPage page="cookies" />} />
            <Route path="/impressum" element={<LegalPage page="impressum" />} />
            <Route path="/anmelden/*" element={<Login />} />
            <Route path="/registrieren/*" element={<Register />} />

            <Route path="/verwaltung" element={<AdminPage />} />
            <Route path="/verwaltung/neu" element={<PropertyEditPage />} />
            <Route path="/verwaltung/bearbeiten/:id" element={<PropertyEditPage />} />

            <Route path="/pronat/:id" element={<RedirectProperty />} />
            <Route path="/pronat" element={<RedirectKeep to="/immobilien" />} />
            <Route path="/rreth-nesh" element={<RedirectKeep to="/ueber-uns" />} />
            <Route path="/inbox" element={<RedirectKeep to="/posteingang" />} />
            <Route path="/hyr/*" element={<RedirectKeep to="/anmelden" />} />
            <Route path="/regjistrohu/*" element={<RedirectKeep to="/registrieren" />} />
            <Route path="/admin" element={<RedirectKeep to="/verwaltung" />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </ClerkProvider>
  );
}

function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    const id = decodeURIComponent(hash.slice(1));
    const run = () => document.getElementById(id)?.scrollIntoView();
    run();
    const timer = window.setTimeout(run, 60);
    return () => window.clearTimeout(timer);
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <CookieConsentProvider>
        <ScrollToHash />
        <ClerkRoutes />
      </CookieConsentProvider>
    </BrowserRouter>
  );
}