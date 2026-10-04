import { useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice, localized } from "../data/properties";
import { propertyPoint } from "../data/recommend";
import { useLanguage } from "../i18n/LanguageContext";
import "./PropertiesCard.css";

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

export default function PropertiesCard({ property, onClick, navigate = false }) {
  const { lang, t } = useLanguage();
  const [mapsOpen, setMapsOpen] = useState(false);
  const isRent = property.listingType === "rent";
  const listing = isRent ? "listingRent" : "listingSale";
  const intent = isRent ? "intentRent" : "intentBuy";
  const counts = property.roomCounts || {};
  const filledRooms = Object.entries(counts).filter(([, count]) => count > 0);
  const point = propertyPoint(property);
  const status = property.status || "available";
  const directionsLabel = lang === "en" ? "Directions" : "Route";

  return (
    <article className="property-card">
      <Link to={`/immobilien/${property.id}`} className="property-card-main" onClick={onClick}>
        <div className="property-media">
          {property.cover ? (
            <img
              className="property-cover"
              src={property.cover}
              alt={`${localized(property.title, lang)}, ${localized(property.location, lang)}`}
            />
          ) : (
            <div className="property-cover property-cover-empty" aria-hidden="true" />
          )}
          <span className="property-type">{t(listing)}</span>
          <span className={`property-status status-${status}`}>
            {t(statusLabels[status] || "statusAvailable")}
          </span>
        </div>

        <div className="property-body">
          <h3>{localized(property.title, lang)}</h3>
          <p className="property-location">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span>{localized(property.location, lang)}</span>
          </p>

          <dl className="property-specs">
            <div>
              <dt>{t("rooms")}</dt>
              <dd>{property.rooms ?? "–"}</dd>
            </div>
            <div>
              <dt>{t("area")}</dt>
              <dd>{property.area ?? "–"} m²</dd>
            </div>
          </dl>

          {filledRooms.length ? (
            <ul className="property-room-list">
              {filledRooms.map(([type, count]) => (
                <li key={type}>
                  {t(roomLabels[type] || type)} <strong>{count}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Link>

      <div className="property-footer">
        <p className="property-price">{formatPrice(property.price, lang)}</p>
        <div className="property-actions">
          <Link
            to={`/posteingang?property=${property.id}`}
            className="property-message"
            onClick={onClick}
          >
            {t("cardMessage")} · {t(intent)}
          </Link>
          {navigate && point ? (
            <button
              type="button"
              className="property-navigate"
              onClick={() => setMapsOpen((open) => !open)}
              aria-expanded={mapsOpen}
              aria-label={directionsLabel}
              title={directionsLabel}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 11 21 3l-8 18-2-7-8-3z" />
              </svg>
            </button>
          ) : null}
        </div>

        {mapsOpen && point ? (
          <div className="property-nav-card">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("mapGoogle")}
            </a>
            <a
              href={`https://maps.apple.com/?daddr=${point.lat},${point.lng}&dirflg=d`}
              target="_blank"
              rel="noreferrer"
            >
              {t("mapApple")}
            </a>
            <button type="button" onClick={() => setMapsOpen(false)}>
              {t("mapClose")}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}