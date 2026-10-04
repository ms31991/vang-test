export const swissPlaces = [
  { id: "zuerich", cityId: "zuerich", canton: "ZH", de: "Zürich", en: "Zurich", lat: 47.3769, lng: 8.5417, major: true },
  { id: "zuerich-enge", cityId: "zuerich", canton: "ZH", de: "Zürich – Enge", en: "Zurich – Enge", lat: 47.3636, lng: 8.5308 },
  { id: "zuerich-wiedikon", cityId: "zuerich", canton: "ZH", de: "Zürich – Wiedikon", en: "Zurich – Wiedikon", lat: 47.3667, lng: 8.5167 },
  { id: "zuerich-oerlikon", cityId: "zuerich", canton: "ZH", de: "Zürich – Oerlikon", en: "Zurich – Oerlikon", lat: 47.4113, lng: 8.5441 },
  { id: "winterthur", cityId: "winterthur", canton: "ZH", de: "Winterthur", en: "Winterthur", lat: 47.4988, lng: 8.7237, major: true },
  { id: "zug", cityId: "zug", canton: "ZG", de: "Zug", en: "Zug", lat: 47.1662, lng: 8.5155, major: true },
  { id: "luzern", cityId: "luzern", canton: "LU", de: "Luzern", en: "Lucerne", lat: 47.0502, lng: 8.3093, major: true },
  { id: "bern", cityId: "bern", canton: "BE", de: "Bern", en: "Bern", lat: 46.948, lng: 7.4474, major: true },
  { id: "basel", cityId: "basel", canton: "BS", de: "Basel", en: "Basel", lat: 47.5596, lng: 7.5886, major: true },
  { id: "st-gallen", cityId: "st-gallen", canton: "SG", de: "St. Gallen", en: "St. Gallen", lat: 47.4245, lng: 9.3767 },
  { id: "genf", cityId: "genf", canton: "GE", de: "Genf", en: "Geneva", lat: 46.2044, lng: 6.1432, major: true },
  { id: "genf-eaux-vives", cityId: "genf", canton: "GE", de: "Genf – Eaux-Vives", en: "Geneva – Eaux-Vives", lat: 46.2015, lng: 6.163 },
  { id: "lausanne", cityId: "lausanne", canton: "VD", de: "Lausanne", en: "Lausanne", lat: 46.5197, lng: 6.6323, major: true },
  { id: "lugano", cityId: "lugano", canton: "TI", de: "Lugano", en: "Lugano", lat: 46.0037, lng: 8.9511, major: true },
];

export function placeLabel(place, lang) {
  return place[lang] || place.de;
}

export function findPlace(id) {
  return swissPlaces.find((place) => place.id === id);
}
