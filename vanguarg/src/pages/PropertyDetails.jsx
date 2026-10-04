import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { formatPrice, localized } from "../data/properties";
import { useLanguage } from "../i18n/LanguageContext";
import { usePageSeo } from "../seo/usePageSeo";
import "./PropertyDetails.css";
import "../components/PropertiesCard.css";

const roomLabels = {
  living: "roomLiving",
  bedroom: "roomBedroom",
  kitchen: "roomKitchen",
  bathroom: "roomBathroom",
  wc: "roomWc",
  balcony: "roomBalcony",
};

const statusLabels = {
  available: "statusAvailable",
  rented: "statusRented",
  sold: "statusSold",
};

function mapSrc(lat, lng) {
  const pad = 0.006;
  const bbox = [lng - pad, lat - pad, lng + pad, lat + pad].map((n) => n.toFixed(5)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState("loading");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [askMaps, setAskMaps] = useState(false);

  useEffect(() => {
    setStatus("loading");
    setPhotoIndex(0);
    api(`/api/properties/${id}`)
      .then((row) => {
        setItem(row);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  const location = item
    ? [item.Neighborhood, item.City].filter(Boolean).join(" – ") || item.Address
    : "";
  const listing = item?.ListingType === "rent" ? "listingRent" : "listingSale";
  const intent = item?.ListingType === "rent" ? "intentRent" : "intentBuy";
  const lat = item?.Lat == null ? null : Number(item?.Lat);
  const lng = item?.Lng == null ? null : Number(item?.Lng);
  const hasPoint = lat >= 45 && lat <= 48.5 && lng >= 5 && lng <= 11.5;
  const photos = item?.images || [];
  const rooms = (item?.rooms || []).filter((room) => room.Quantity > 0);
  const title = item
    ? localized({ de: item.Title, en: item.TitleEn || item.Title }, lang)
    : t("loading");
  const detailDescription = item
    ? [title, location, item.Address, item.Description].filter(Boolean).join(". ")
    : t("seoMetaProperties");

  usePageSeo({
    title: item ? `${title} | Vanguard` : `${t("propertiesTitle")} | Vanguard`,
    description: detailDescription,
    path: `/immobilien/${id}`,
    image: photos[0]?.Url,
    noindex: status !== "ready",
    jsonLd: item
      ? {
          kind: "listing",
          id: item.Id,
          name: title,
          description: detailDescription,
          city: item.City,
          address: item.Address,
          price: Number(item.Price),
          rooms: item.Rooms,
          area: item.AreaM2,
          listingType: item.ListingType,
          status: item.Status,
          images: photos.map((photo) => photo.Url),
          listName: t("navProperties"),
        }
      : null,
  });

  function goBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/immobilien");
  }

  const backButton = (
    <button type="button" className="detail-back" onClick={goBack}>
      {t("goBack")}
    </button>
  );

  if (status === "loading") {
    return (
      <section className="section property-details">
        {backButton}
        <p>{t("loading")}</p>
      </section>
    );
  }

  if (status === "error" || !item) {
    return (
      <section className="section property-details">
        {backButton}
        <p className="properties-empty">{t("locNoResults")}</p>
      </section>
    );
  }

  return (
    <section className="section property-details">
      {backButton}
     
      <div className="detail-stage">
        <div className="detail-gallery">
          {photos.length ? (
            <>
              <img
                className="detail-cover"
                src={photos[photoIndex]?.Url || photos[0].Url}
                alt={`${title}, ${location}, ${photoIndex + 1}`}
              />
              {photos.length > 1 ? (
                <div className="detail-thumbs">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.Id}
                      type="button"
                      className={index === photoIndex ? "is-on" : undefined}
                      onClick={() => setPhotoIndex(index)}
                    >
                      <img src={photo.Url} alt={`${title}, ${location}, ${index + 1}`} />
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="detail-cover detail-cover-empty" />
          )}
        </div>
        <article className="detail-panel">
          <p className="detail-intent">{t(intent)}</p>
          <div className="detail-tags">
            <p className="property-type">{t(listing)}</p>
            <p className={`property-status status-${item.Status || "available"}`}>
              {t(statusLabels[item.Status] || "statusAvailable")}
            </p>
          </div>
          <h1>{title}</h1>
          <p className="property-location">{[location, item.Address].filter(Boolean).join(" · ")}</p>
          <p className="property-price">{formatPrice(item.Price, lang)}</p>
          <dl>
            <div>
              <dt>{t("rooms")}</dt>
              <dd>{item.Rooms ?? "–"}</dd>
            </div>
            <div>
              <dt>{t("area")}</dt>
              <dd>{item.AreaM2 ?? "–"} m²</dd>
            </div>
          </dl>
          {rooms.length ? (
            <ul className="property-room-list">
              {rooms.map((room) => (
                <li key={room.RoomType}>
                  {t(roomLabels[room.RoomType] || room.RoomType)} {room.Quantity}
                </li>
              ))}
            </ul>
          ) : null}
          {item.Description ? <p className="detail-description">{item.Description}</p> : null}
          <Link to={`/posteingang?property=${item.Id}`} className="detail-message">
            {t("cardMessage")}
          </Link>
        </article>
      </div>
      <div className="detail-map">
        <h2>{t("mapTitle")}</h2>
        {hasPoint ? (
          <div className="map-frame">
            <iframe
              className="property-map"
              title={t("mapTitle")}
              src={mapSrc(lat, lng)}
              loading="lazy"
              tabIndex={-1}
            />
            <button type="button" className="map-hit" onClick={() => setAskMaps(true)}>
              {t("mapAsk")}
            </button>
            {askMaps ? (
              <div className="map-ask" onClick={() => setAskMaps(false)}>
                <div
                  className="map-ask-card"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="map-ask-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <h3 id="map-ask-title">{t("mapAsk")}</h3>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer">
                    {t("mapGoogle")}
                  </a>
                  <a href={`https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`} target="_blank" rel="noreferrer">
                    {t("mapApple")}
                  </a>
                  <button type="button" onClick={() => setAskMaps(false)}>
                    {t("mapClose")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="properties-empty">{t("mapMissing")}</p>
        )}
      </div>
    </section>
  );
}
