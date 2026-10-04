import { Link } from "react-router-dom";
import { formatPrice, localized } from "../data/properties";
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

export default function PropertiesCard({ property, onClick }) {
  const { lang, t } = useLanguage();
  const listing = property.listingType === "rent" ? "listingRent" : "listingSale";
  const counts = property.roomCounts || {};
  const filledRooms = Object.entries(counts).filter(([, count]) => count > 0);

  const intent = property.listingType === "rent" ? "intentRent" : "intentBuy";

  return (
    <article className="property-card">
      <Link to={`/pronat/${property.id}`} className="property-card-main" onClick={onClick}>
        {property.cover ? (
          <img
            className="property-cover"
            src={property.cover}
            alt={`${localized(property.title, lang)}, ${property.location}`}
          />
        ) : null}
        <p className="property-type">{t(listing)}</p>
        <p className={`property-status status-${property.status || "available"}`}>
          {t(statusLabels[property.status] || "statusAvailable")}
        </p>
        <h3>{localized(property.title, lang)}</h3>
        <p className="property-location">{localized(property.location, lang)}</p>
        <dl>
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
                {t(roomLabels[type] || type)} {count}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="property-price">{formatPrice(property.price, lang)}</p>
      </Link>
      <Link
        to={`/inbox?property=${property.id}`}
        className="property-message"
        onClick={onClick}
      >
        {t("cardMessage")} · {t(intent)}
      </Link>
    </article>
  );
}
