const API_BASE_URL = "https://vang-test.onrender.com";

export async function api(
  path,
  { token, method = "GET", body, form } = {}
) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}

export function parseRoomCounts(value) {
  const counts = {};

  if (!value) return counts;

  String(value).split("|").forEach((part) => {
    const [type, count] = part.split(":");
    const qty = Number(count);

    if (type && qty > 0) {
      counts[type] = qty;
    }
  });

  return counts;
}

export function fromProperty(row) {
  const city = row.City || "";
  const neighborhood = row.Neighborhood || "";

  const location = neighborhood
    ? `${city} – ${neighborhood}`
    : city;

  return {
    id: row.Id,
    title: {
      de: row.Title,
      en: row.TitleEn || row.Title,
    },
    location,
    city,
    lat: row.Lat == null ? null : Number(row.Lat),
    lng: row.Lng == null ? null : Number(row.Lng),
    placeId: row.PlaceId || "",
    cityId: row.CityId || "",
    price: Number(row.Price),
    rooms: row.Rooms,
    roomCounts: parseRoomCounts(row.RoomList),
    area: row.AreaM2,
    cover: row.CoverUrl || null,
    listingType: row.ListingType || "sale",
    status: row.Status || "available",
    visibility: row.Visibility || "public",
  };
}