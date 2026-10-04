import { SignIn } from "@clerk/react";
import { useLocation } from "react-router-dom";
import { usePageSeo } from "../seo/usePageSeo";
import "./Login.css";

function nextPath(search) {
  const value = new URLSearchParams(search).get("redirect_url") || "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function Login() {
  const location = useLocation();
  const next = nextPath(location.search);
  usePageSeo({
    title: "Anmelden | Vanguard",
    description: "Anmeldung bei Vanguard.",
    path: "/anmelden",
    noindex: true,
  });

  return (
    <section className="auth-page">
      <SignIn
        routing="path"
        path="/anmelden"
        signUpUrl={`/registrieren?redirect_url=${encodeURIComponent(next)}`}
        fallbackRedirectUrl={next}
        forceRedirectUrl={next}
      />
    </section>
  );
}
