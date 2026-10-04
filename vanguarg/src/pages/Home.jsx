import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Banner from "../components/Banner";
import PropertyCategory from "../components/PropertyCategory";
import LocationSearch from "../components/LocationSearch";
import { api, fromProperty } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import { usePageSeo } from "../seo/usePageSeo";
import "./Home.css";

const fallbackServices = [
  ["serviceBuy", "serviceBuyText"],
  ["serviceSell", "serviceSellText"],
  ["serviceRent", "serviceRentText"],
  ["serviceValue", "serviceValueText"],
  ["serviceManage", "serviceManageText"],
  ["serviceView", "serviceViewText"],
  ["serviceContract", "serviceContractText"],
  ["serviceFinance", "serviceFinanceText"],
];

const trades = [
  ["seoLaminate", true],
  ["seoParquet", true],
  ["seoElectric", true],
  ["seoPlumbing", false],
  ["seoPaint", false],
  ["seoTiles", false],
  ["seoBath", false],
  ["seoKitchen", false],
  ["seoWindows", false],
  ["seoDoors", false],
  ["seoInsulation", false],
  ["seoHeating", false],
  ["seoPlaster", false],
  ["seoFloors", false],
];

export default function Home() {
  const { lang, t } = useLanguage();
  usePageSeo({
    title: `${t("seoTitle")} | Vanguard`,
    description: t("seoMetaHome"),
    path: "/",
    jsonLd: { kind: "home", description: t("seoMetaHome") },
  });
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [serviceItems, setServiceItems] = useState(null);
  const [pickService, setPickService] = useState(false);

  useEffect(() => {
    api("/api/services")
      .then((rows) => setServiceItems(rows))
      .catch(() => setServiceItems(null));
  }, []);

  useEffect(() => {
    api("/api/properties")
      .then((rows) => {
        setItems(rows.map(fromProperty));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const services = serviceItems?.length
    ? serviceItems.map((item) => ({
        key: item.id,
        title: lang === "en" ? item.titleEn || item.titleDe : item.titleDe,
        text: lang === "en" ? item.textEn || item.textDe : item.textDe,
      }))
    : fallbackServices.map(([title, text]) => ({
        key: title,
        title: t(title),
        text: t(text),
      }));
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
              action={<Link to="/pronat#verkauf">{t("seeAll")}</Link>}
              cycle
            />
            <PropertyCategory
              id="miete"
              title={t("categoryRent")}
              items={rent}
              empty={t("categoryEmpty")}
              action={<Link to="/pronat#miete">{t("seeAll")}</Link>}
              cycle
            />
          </>
        ) : null}
      </section>
      <section className="section services" id="leistungen">
        <div className="services-layout">
          <div className="services-intro">
            <p className="services-kicker">Vanguard</p>
            <h2>{t("servicesTitle")}</h2>
            <p>{t("servicesLead")}</p>
            <div className="service-contact-panel" id="kontakt">
              <p className="service-contact-kicker">{t("serviceContact")}</p>
              <p className="service-contact-lead">{t("serviceContactLead")}</p>
              <button type="button" className="service-contact" onClick={() => setPickService(true)}>
                {t("serviceContact")}
              </button>
            </div>
          </div>
          <ul className="service-list">
            {services.map((service, index) => (
              <li key={service.key}>
                <span className="service-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
              </li>
            ))}
          </ul>
        </div>
        {pickService ? (
          <div className="service-picker">
            <p>{t("chatPickService")}</p>
            <ul>
              {services.map((service) => (
                <li key={service.key}>
                  <Link to={`/inbox?service=${encodeURIComponent(service.key)}`}>
                    <strong>{service.title}</strong>
                    <span>{service.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      <section className="home-seo" aria-labelledby="vanguard-seo">
        <p className="home-seo-mark" aria-hidden="true">Vanguard</p>
        <div className="home-seo-inner">
          <div>
            <p className="home-seo-kicker">Vanguard</p>
            <h2 id="vanguard-seo">{t("seoTitle")}</h2>
            <article>
              <h3>{t("seoBuyTitle")}</h3>
              <p>{t("seoBuyText")}</p>
              <Link className="home-seo-more" to="/pronat#verkauf">{t("seoBuyLink")}</Link>
            </article>
            <article>
              <h3>{t("seoRentTitle")}</h3>
              <p>{t("seoRentText")}</p>
              <Link className="home-seo-more" to="/pronat#miete">{t("seoRentLink")}</Link>
            </article>
          </div>
          <article className="home-seo-reno">
            <h3>{t("seoRenoTitle")}</h3>
            <p>{t("seoRenovation")}</p>
            <p>{t("seoRenoMore")}</p>
            <ul className="home-seo-trades">
              {trades.map(([key, core]) => (
                <li key={key} id={`trade-${key}`} className={core ? "is-core" : undefined}>{t(key)}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </>
  );
}
