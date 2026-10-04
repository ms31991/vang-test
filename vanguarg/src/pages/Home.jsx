import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Banner from "../components/Banner";
import RenovationBanner from "../components/RenovationBanner";
import PropertyCategory from "../components/PropertyCategory";
import LocationSearch from "../components/LocationSearch";
import { api, fromProperty } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import { usePageSeo } from "../seo/usePageSeo";

export default function Home() {
  const { t } = useLanguage();
  usePageSeo({
    title: `${t("seoTitle")} | Vanguard`,
    description: t("seoMetaHome"),
    path: "/",
    jsonLd: { kind: "home", description: t("seoMetaHome") },
  });
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    api("/api/properties")
      .then((rows) => {
        setItems(rows.map(fromProperty));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const sale = items.filter((property) => property.listingType !== "rent");
  const rent = items.filter((property) => property.listingType === "rent");

  return (
    <>
      <Banner />
      <LocationSearch />
      <section className="section">
        {status === "loading" ? <p>{t("loading")}</p> : null}
        {status === "error" ? <p className="properties-empty">{t("locNoResults")}</p> : null}
        {status === "ready" ? (
          <>
            <PropertyCategory
              id="verkauf"
              title={t("categorySale")}
              items={sale}
              empty={t("categoryEmpty")}
              action={<Link to="/immobilien#verkauf">{t("seeAll")}</Link>}
              cycle
            />
            <PropertyCategory
              id="miete"
              title={t("categoryRent")}
              items={rent}
              empty={t("categoryEmpty")}
              action={<Link to="/immobilien#miete">{t("seeAll")}</Link>}
              cycle
            />
          </>
        ) : null}
      </section>
      <section className="section services" id="leistungen">
        <RenovationBanner />
      </section>
    </>
  );
}
