import { useEffect } from "react";
import { ClerkProvider } from "@clerk/react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
import "./App.css";

const clerkAppearance = {
  options: {
    unsafe_disableDevelopmentModeWarnings: true,
  },
};

function ClerkRoutes() {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      signInUrl="/hyr"
      signUpUrl="/regjistrohu"
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
            <Route path="/pronat" element={<Properties />} />
            <Route path="/pronat/:id" element={<PropertyDetails />} />
            <Route path="/rreth-nesh" element={<AboutUs />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/datenschutz" element={<LegalPage page="datenschutz" />} />
            <Route path="/agb" element={<LegalPage page="agb" />} />
            <Route path="/cookies" element={<LegalPage page="cookies" />} />
            <Route path="/impressum" element={<LegalPage page="impressum" />} />
            <Route path="/hyr/*" element={<Login />} />
            <Route path="/regjistrohu/*" element={<Register />} />
            <Route path="/admin" element={<AdminPage />} />
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
