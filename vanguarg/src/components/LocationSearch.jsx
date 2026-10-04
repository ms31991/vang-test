import { useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { placeLabel, swissPlaces } from "../data/places";
import { useLanguage } from "../i18n/LanguageContext";
import "./LocationSearch.css";

const RADIUS = [5, 10, 25, 50];

export default function LocationSearch() {
  const nav = useNavigate();
  const { lang, t } = useLanguage();
  const id = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [km, setKm] = useState(10);
  const [geoMsg, setGeoMsg] = useState("");

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    const source = query
      ? swissPlaces.filter((place) => {
          const label = `${place.de} ${place.en} ${place.canton}`.toLowerCase();
          return label.includes(query);
        })
      : swissPlaces.filter((place) => place.major);
    return source.slice(0, 6);
  }, [q]);

  function go(placeId = "", typed = q) {
    const params = new URLSearchParams({ radius: String(km) });
    if (placeId) params.set("ort", placeId);
    else if (typed.trim()) params.set("ort", typed.trim());
    nav(`/pronat?${params}`);
  }

  function pick(place) {
    setQ(placeLabel(place, lang));
    setOpen(false);
    setActive(-1);
    go(place.id);
  }

  function onKey(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0 && matches[active]) pick(matches[active]);
      else go();
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function nearMe() {
    if (!navigator.geolocation) {
      setGeoMsg(t("locGeoUnsupported"));
      return;
    }
    setGeoMsg(t("locGeoFinding"));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams({
          radius: String(km),
          lat: position.coords.latitude.toFixed(5),
          lng: position.coords.longitude.toFixed(5),
        });
        nav(`/pronat?${params}`);
      },
      () => setGeoMsg(t("locGeoDenied")),
    );
  }

  return (
    <section className="loc" id="suche" aria-label={t("locAria")}>
      <div className="loc-main">
        <span className="loc-pin" aria-hidden="true" />
        <div className="loc-field">
          <label htmlFor={id} className="loc-label">
            {t("locLabel")}
          </label>
          <input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
            autoComplete="off"
            placeholder={t("locPlaceholder")}
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setOpen(true);
              setActive(-1);
              setGeoMsg("");
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 140)}
            onKeyDown={onKey}
          />
          {open && (
            <ul id={`${id}-list`} role="listbox" className="loc-list">
              {matches.length > 0 ? (
                matches.map((place, index) => (
                  <li
                    key={place.id}
                    id={`${id}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className={index === active ? "is-active" : ""}
                    onMouseDown={() => pick(place)}
                  >
                    <span>{placeLabel(place, lang)}</span>
                    <small>{place.canton}</small>
                  </li>
                ))
              ) : (
                <li className="loc-empty">{t("locEmpty")}</li>
              )}
            </ul>
          )}
        </div>
        <button type="button" className="loc-near" onClick={nearMe}>
          {t("locNear")}
        </button>
        <button type="button" className="loc-go" onClick={() => go(findPlaceByLabel(q)?.id || "")}>
          {t("locSearch")}
        </button>
      </div>

      <div className="loc-radius" role="radiogroup" aria-label={t("locRadiusAria")}>
        <span>{t("locWithin")}</span>
        {RADIUS.map((radius) => (
          <button
            key={radius}
            type="button"
            role="radio"
            aria-checked={km === radius}
            className={km === radius ? "on" : ""}
            onClick={() => setKm(radius)}
          >
            {radius} km
          </button>
        ))}
        {geoMsg ? (
          <span className="loc-msg" role="status">
            {geoMsg}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function findPlaceByLabel(value) {
  const query = value.trim().toLowerCase();
  if (!query) return undefined;
  return swissPlaces.find(
    (place) => place.de.toLowerCase() === query || place.en.toLowerCase() === query,
  );
}
