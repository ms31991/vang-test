export const properties = [
  {
    id: 1,
    title: { de: "Wohnung in der Enge", en: "Apartment in Enge" },
    location: { de: "Zürich – Enge", en: "Zurich – Enge" },
    placeId: "zuerich-enge",
    cityId: "zuerich",
    price: 1250000,
    type: "apartment",
    rooms: 2,
    area: 78,
  },
  {
    id: 2,
    title: { de: "Villa am Zürichsee", en: "Villa on Lake Zurich" },
    location: { de: "Zürich", en: "Zurich" },
    placeId: "zuerich",
    cityId: "zuerich",
    price: 4800000,
    type: "villa",
    rooms: 4,
    area: 210,
  },
  {
    id: 3,
    title: { de: "Haus mit Garten", en: "House with a garden" },
    location: { de: "Bern", en: "Bern" },
    placeId: "bern",
    cityId: "bern",
    price: 1650000,
    type: "house",
    rooms: 3,
    area: 160,
  },
  {
    id: 4,
    title: { de: "Studio im Zentrum", en: "Studio in the centre" },
    location: { de: "Genf", en: "Geneva" },
    placeId: "genf",
    cityId: "genf",
    price: 890000,
    type: "studio",
    rooms: 1,
    area: 42,
  },
];

export function localized(value, lang) {
  if (value && typeof value === "object") {
    return value[lang] || value.de || value.en || "";
  }
  return value;
}

export function formatPrice(value, lang) {
  return new Intl.NumberFormat(lang === "en" ? "en-CH" : "de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(value);
}
