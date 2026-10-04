import "./Logo.css";

export default function Logo({ size = "md", tone = "light" }) {
  const src = tone === "dark" ? "/logo.svg" : "/logo-on-dark.svg";

  return (
    <span className={`brand-logo brand-logo--${size}`}>
      <img src={src} alt="Vanguard Living" />
    </span>
  );
}
