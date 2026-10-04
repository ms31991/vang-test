import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
  const { lang, t } = useLanguage();
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    setStatus("loading");
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
  const lat = item?.Lat == null ? null : Number(item?.Lat);
  const lng = item?.Lng == null ? null : Number(item?.Lng);
  const hasPoint = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
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
    path: `/pronat/${id}`,
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

  if (status === "loading") {
    return (
      <section className="section">
        <p>{t("loading")}</p>
      </section>
    );
  }

  if (status === "error" || !item) {
    return (
      <section className="section">
        <Link to="/pronat">{t("backToProperties")}</Link>
        <p className="properties-empty">{t("locNoResults")}</p>
      </section>
    );
  }

  return (
    <section className="section property-details">
      <nav className="detail-crumbs" aria-label="Breadcrumb">
        <Link to="/">{t("navHome")}</Link>
        <Link to="/pronat">{t("navProperties")}</Link>
        <span>{title}</span>
      </nav>
      {photos.length ? (
        <div className="detail-photos">
          {photos.map((photo, index) => (
            <img key={photo.Id} src={photo.Url} alt={`${title}, ${location}, ${index + 1}`} />
          ))}
        </div>
      ) : null}
      <div className="detail-layout">
        <div>
          <p className="property-type">{t(listing)}</p>
          <p className={`property-status status-${item.Status || "available"}`}>
            {t(statusLabels[item.Status] || "statusAvailable")}
          </p>
          <h1>{title}</h1>
          <p className="property-location">{location}</p>
          {item.Address ? <p className="property-location">{item.Address}</p> : null}
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
          <p className="property-price">{formatPrice(item.Price, lang)}</p>
          <Link to={`/inbox?property=${item.Id}`} className="property-message">
            {t("cardMessage")} · {t(item.ListingType === "rent" ? "intentRent" : "intentBuy")}
          </Link>
        </div>
        <div>
          <h2>{t("mapTitle")}</h2>
          {hasPoint ? (
            <iframe
              className="property-map"
              title={t("mapTitle")}
              src={mapSrc(lat, lng)}
              loading="lazy"
            />
          ) : (
            <p className="properties-empty">{t("mapMissing")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
