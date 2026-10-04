import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import PropertyCategory from "../components/PropertyCategory";
import { api, fromProperty } from "../api";
import { findPlace, placeLabel } from "../data/places";
import { useLanguage } from "../i18n/LanguageContext";
import { localized } from "../data/properties";
import { usePageSeo } from "../seo/usePageSeo";
import "./Properties.css";

export default function Properties() {
  const { lang, t } = useLanguage();
  const { hash } = useLocation();
  const [params] = useSearchParams();
  const ort = params.get("ort") || "";
  const radius = params.get("radius");
  const near = params.get("lat") && params.get("lng");
  const place = findPlace(ort);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const query = new URLSearchParams();
    if (!near && ort) query.set("ort", ort);
    setStatus("loading");
    api(`/api/properties?${query}`)
      .then((rows) => {
        setItems(rows.map(fromProperty));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [ort, near]);

  const placeName = place ? placeLabel(place, lang) : ort;
  const sale = items.filter((property) => property.listingType !== "rent");
  const rent = items.filter((property) => property.listingType === "rent");
  const mode = hash === "#miete" ? "rent" : "sale";
  const shown = mode === "rent" ? rent : sale;
  const summary = near
    ? t("locNear")
    : placeName
      ? t("locResults").replace("{place}", placeName)
      : t("propertyCount").replace("{n}", shown.length);
  const filtered = Boolean(ort || near);
  const search = params.toString();

  usePageSeo({
    title: `${t("propertiesTitle")} | Vanguard`,
    description: t("seoMetaProperties"),
    path: "/pronat",
    noindex: filtered,
    jsonLd: {
      kind: "list",
      name: t("propertiesTitle"),
      items: items.map((property) => ({
        id: property.id,
        name: localized(property.title, lang),
      })),
    },
  });

  return (
    <section className="section">
      <div className="section-head">
        <div>
          <p className="eyebrow">{t("listEyebrow")}</p>
          <h1>{t("propertiesTitle")}</h1>
        </div>
        <p>
          {status === "ready" ? summary : t("loading")}
          {radius ? ` · ${radius} km` : ""}
        </p>
      </div>
      <div className="listing-switch" role="group" aria-label={t("propertiesTitle")}>
        <Link
          to={{ pathname: "/pronat", search, hash: "verkauf" }}
          className={mode === "sale" ? "is-on" : undefined}
          aria-pressed={mode === "sale"}
        >
          {t("listingSale")}
        </Link>
        <Link
          to={{ pathname: "/pronat", search, hash: "miete" }}
          className={mode === "rent" ? "is-on" : undefined}
          aria-pressed={mode === "rent"}
        >
          {t("listingRent")}
        </Link>
      </div>
      {status === "error" ? <p className="properties-empty">{t("locNoResults")}</p> : null}
      {status === "ready" ? (
        <PropertyCategory
          id={mode === "rent" ? "miete" : "verkauf"}
          title={mode === "rent" ? t("categoryRent") : t("categorySale")}
          items={shown}
          empty={t("categoryEmpty")}
        />
      ) : null}
    </section>
  );
}
