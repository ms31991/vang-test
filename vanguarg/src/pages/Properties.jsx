import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import PropertyCategory from "../components/PropertyCategory";
import PropertiesCard from "../components/PropertiesCard";
import LocationSearch from "../components/LocationSearch";
import { api, fromProperty } from "../api";
import { findPlace, placeLabel } from "../data/places";
import { closestProperties, kmBetween, propertyPoint, searchOrigin } from "../data/recommend";
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
  const [pool, setPool] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const query = new URLSearchParams();
    if (!near && ort) query.set("ort", ort);
    setStatus("loading");
    let ignore = false;
    const exact = api(`/api/properties?${query}`).then((rows) => rows.map(fromProperty));
    const all = ort || near
      ? api("/api/properties").then((rows) => rows.map(fromProperty))
      : exact;
    Promise.all([exact, all])
      .then(([matched, every]) => {
        if (ignore) return;
        setItems(matched);
        setPool(every);
        setStatus("ready");
      })
      .catch(() => {
        if (!ignore) setStatus("error");
      });
    return () => {
      ignore = true;
    };
  }, [ort, near]);

  const placeName = near ? t("locNear") : place ? placeLabel(place, lang) : ort;
  const origin = searchOrigin({
    ort,
    lat: params.get("lat"),
    lng: params.get("lng"),
    place,
  });
  const radiusKm = Number(radius) || 10;
  const inRange = near && origin
    ? items.filter((property) => {
        const point = propertyPoint(property);
        return point && kmBetween(origin, point) <= radiusKm;
      })
    : items;
  const sale = inRange.filter((property) => property.listingType !== "rent");
  const rent = inRange.filter((property) => property.listingType === "rent");
  const mode = hash === "#miete" ? "rent" : "sale";
  const shown = mode === "rent" ? rent : sale;
  const filtered = Boolean(ort || near);
  const missed = filtered && status === "ready" && shown.length === 0;
  const recommended = missed ? closestProperties(pool, origin, mode) : [];
  const summary = near
    ? t("locNear")
    : placeName;
  const search = params.toString();

  usePageSeo({
    title: `${t("propertiesTitle")} | Vanguard`,
    description: t("seoMetaProperties"),
    path: "/immobilien",
    noindex: filtered,
    jsonLd: {
      kind: "list",
      name: t("propertiesTitle"),
      items: (missed ? recommended : items).map((property) => ({
        id: property.id,
        name: localized(property.title, lang),
      })),
    },
  });

  return (
    <section className="section">
      <div className="properties-top">
        <div>
          <h1>{t("propertiesTitle")}</h1>
          {/* Teksti vendoset në <span>, që shtesat e shfletuesit (përkthyes etj.)
              të mos prishin zëvendësimin e nyjës së tekstit nga React. */}
          <p className="properties-summary">
            <span>{status === "ready" ? summary : t("loading")}</span>
            {radius ? <span>{` · ${radius} km`}</span> : null}
          </p>
        </div>
        <LocationSearch page />
      </div>
      <div className="listing-switch" role="group" aria-label={t("propertiesTitle")}>
        <Link
          to={{ pathname: "/immobilien", search, hash: "verkauf" }}
          className={mode === "sale" ? "is-on" : undefined}
          aria-current={mode === "sale" ? "page" : undefined}
        >
          {t("listingSale")}
        </Link>
        <Link
          to={{ pathname: "/immobilien", search, hash: "miete" }}
          className={mode === "rent" ? "is-on" : undefined}
          aria-current={mode === "rent" ? "page" : undefined}
        >
          {t("listingRent")}
        </Link>
      </div>
      {status === "error" ? <p className="properties-empty">{t("locNoResults")}</p> : null}
      {status === "ready" && !missed ? (
        <PropertyCategory
          id={mode === "rent" ? "miete" : "verkauf"}
          title={mode === "rent" ? t("categoryRent") : t("categorySale")}
          items={shown}
          empty={t("categoryEmpty")}
        />
      ) : null}
      {missed ? (
        <div className="recommend">
          <p className="recommend-kicker">{t("recommendedEyebrow")}</p>
          <h2>{t("recommendedTitle")}</h2>
          <p>{t("recommendedLead").replace("{place}", placeName || t("locNear"))}</p>
          {recommended.length ? (
            <div className="property-grid">
              {recommended.map((property) => (
                <PropertiesCard key={property.id} property={property} navigate />
              ))}
            </div>
          ) : (
            <p className="properties-empty">{t("categoryEmpty")}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}