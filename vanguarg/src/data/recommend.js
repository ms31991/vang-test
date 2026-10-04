import { swissPlaces } from "./places";

const aliases = {
  zurich: "zuerich",
  zuerich: "zuerich",
  zyrich: "zuerich",
  geneve: "genf",
  geneva: "genf",
  lucerne: "luzern",
  berne: "bern",
};

function fold(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function placeKey(value) {
  const folded = fold(value);
  return aliases[folded] || folded;
}

function samePlace(place, key) {
  return [place.id, place.cityId, place.de, place.en].some((part) => placeKey(part) === key);
}

export function searchOrigin({ ort, lat, lng, place }) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (lat != null && lng != null && lat !== "" && lng !== "" && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { lat: latitude, lng: longitude };
  }
  if (place) return { lat: place.lat, lng: place.lng };
  const key = placeKey(ort);
  if (!key) return null;
  const hit = swissPlaces.find((item) => samePlace(item, key));
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

function inSwitzerland(lat, lng) {
  return lat >= 45 && lat <= 48.5 && lng >= 5 && lng <= 11.5;
}

export function propertyPoint(property) {
  const latitude = Number(property.lat);
  const longitude = Number(property.lng);
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && inSwitzerland(latitude, longitude)) {
    return { lat: latitude, lng: longitude };
  }
  const key = placeKey(property.city || property.location);
  if (!key) return null;
  const hit = swissPlaces.find((item) => samePlace(item, key));
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

export function kmBetween(a, b) {
  const earth = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const chord = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180)
    * Math.cos((b.lat * Math.PI) / 180)
    * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(chord)));
}

export function closestProperties(items, origin, listingType, limit = 6) {
  const sameType = (item) => (listingType === "rent" ? item.listingType === "rent" : item.listingType !== "rent");
  const ranked = items.map((item) => {
    const point = origin ? propertyPoint(item) : null;
    const distance = point ? kmBetween(origin, point) : null;
    return { item, distance, sameType: sameType(item) };
  });
  ranked.sort((a, b) => {
    if (a.sameType !== b.sameType) return a.sameType ? -1 : 1;
    if (a.distance == null) return 1;
    if (b.distance == null) return -1;
    return a.distance - b.distance;
  });
  const preferred = ranked.filter((row) => row.sameType);
  return (preferred.length ? preferred : ranked).slice(0, limit).map((row) => ({
    ...row.item,
    distanceKm: row.distance == null ? null : Math.max(1, Math.round(row.distance)),
  }));
}
