import { SignUp } from "@clerk/react";
import { useLocation } from "react-router-dom";
import { usePageSeo } from "../seo/usePageSeo";
import "./Register.css";

function nextPath(search) {
  const value = new URLSearchParams(search).get("redirect_url") || "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function Register() {
  const location = useLocation();
  const next = nextPath(location.search);
  usePageSeo({
    title: "Registrieren | Vanguard",
    description: "Registrierung bei Vanguard.",
    path: "/regjistrohu",
    noindex: true,
  });

  return (
    <section className="auth-page">
      <SignUp
        routing="path"
        path="/regjistrohu"
        signInUrl={`/hyr?redirect_url=${encodeURIComponent(next)}`}
        fallbackRedirectUrl={next}
        forceRedirectUrl={next}
      />
    </section>
  );
}
