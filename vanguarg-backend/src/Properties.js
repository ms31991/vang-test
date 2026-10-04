import { Router } from "express";
import sql from 'mssql';import { getPool } from "./db.js";
import { requireUser, requireRole } from "./Auth.js";

const knownPlaces = [
  { q: ["eaux-vives"], lat: 46.2015, lng: 6.163 },
  { q: ["enge"], lat: 47.3636, lng: 8.5308 },
  { q: ["wiedikon"], lat: 47.3667, lng: 8.5167 },
  { q: ["oerlikon", "örlikon"], lat: 47.4113, lng: 8.5441 },
  { q: ["zürich", "zurich", "zuerich", "zyrich"], lat: 47.3769, lng: 8.5417 },
  { q: ["winterthur"], lat: 47.4988, lng: 8.7237 },
  { q: ["zug"], lat: 47.1662, lng: 8.5155 },
  { q: ["luzern", "lucerne"], lat: 47.0502, lng: 8.3093 },
  { q: ["bern", "berne"], lat: 46.948, lng: 7.4474 },
  { q: ["basel", "bale"], lat: 47.5596, lng: 7.5886 },
  { q: ["st. gallen", "st gallen", "saint gallen"], lat: 47.4245, lng: 9.3767 },
  { q: ["genf", "geneva", "geneve", "genève"], lat: 46.2044, lng: 6.1432 },
  { q: ["lausanne"], lat: 46.5197, lng: 6.6323 },
  { q: ["lugano"], lat: 46.0037, lng: 8.9511 },
];

function normalizePlace(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function knownPoint(text) {
  const name = normalizePlace(text);
  if (!name) return null;
  const hit = knownPlaces.find((place) => place.q.some((part) => name.includes(normalizePlace(part))));
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ch&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "VanguardRealEstate/1.0", "Accept-Language": "de" },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) return null;
  const rows = await response.json();
  if (!rows[0]) return null;
  return { lat: Number(rows[0].lat), lng: Number(rows[0].lon) };
}

function savedPoint(lat, lng) {
  return lat != null && lng != null
    && !Number.isNaN(lat) && !Number.isNaN(lng)
    && lat >= 45 && lat <= 48.5
    && lng >= 5 && lng <= 11.5;
}

async function resolvePoint(row) {
  const lat = row.Lat == null ? null : Number(row.Lat);
  const lng = row.Lng == null ? null : Number(row.Lng);
  if (savedPoint(lat, lng)) return { lat, lng };

  if (row.Address) {
    const query = [row.Address, row.Neighborhood, row.City, "Schweiz"].filter(Boolean).join(", ");
    const found = await geocode(query).catch(() => null);
    if (found) return found;
  }
  return knownPoint(`${row.Neighborhood || ""} ${row.City || ""} ${row.Address || ""}`);
}

const router = Router();
const ROOM_TYPES = ["living", "bedroom", "kitchen", "bathroom", "wc", "balcony"];
const STATUSES = ["available", "sold", "rented"];
const VISIBILITIES = ["public", "private"];

const roomListSql = `STUFF((
  SELECT '|' + r.RoomType + ':' + CAST(r.Quantity AS varchar(10))
  FROM dbo.PropertyRooms r
  WHERE r.PropertyId = p.Id
  ORDER BY r.Id
  FOR XML PATH(''), TYPE
).value('.', 'nvarchar(max)'), 1, 1, '') AS RoomList`;

async function saveRooms(propertyId, rooms) {
  const pool = getPool();
  await pool.request().input("p", sql.Int, propertyId)
    .query("DELETE FROM dbo.PropertyRooms WHERE PropertyId = @p");
  for (const room of rooms || []) {
    const qty = Number(room.count);
    if (!ROOM_TYPES.includes(room.type) || !Number.isInteger(qty) || qty < 1) continue;
    await pool.request()
      .input("p", sql.Int, propertyId)
      .input("t", sql.NVarChar, room.type)
      .input("q", sql.Int, qty)
      .query("INSERT INTO dbo.PropertyRooms (PropertyId, RoomType, Quantity) VALUES (@p, @t, @q)");
  }
}

// Publike: lista (?ort=zuerich&tipi=rent&lokacioni=Zürich - Enge)
router.get("/", async (req, res, next) => {
  try {
    const { lokacioni, tipi, ort } = req.query;
    const rq = getPool().request();
    const where = ["p.Visibility = 'public'"];

    if (ort) {
      rq.input("ort", sql.NVarChar, ort);
      rq.input("ortLike", sql.NVarChar, `%${ort}%`);
      where.push(`(p.PlaceId = @ort OR p.CityId = @ort OR p.City LIKE @ortLike OR p.Neighborhood LIKE @ortLike OR p.Title LIKE @ortLike OR p.TitleEn LIKE @ortLike)`);
    }
    if (lokacioni) {
      String(lokacioni).split(" - ").forEach((part, i) => {
        rq.input(`loc${i}`, sql.NVarChar, `%${part.trim()}%`);
        where.push(`(p.City LIKE @loc${i} OR p.Neighborhood LIKE @loc${i} OR p.Address LIKE @loc${i})`);
      });
    }
    if (tipi) { rq.input("tipi", sql.NVarChar, tipi); where.push("p.ListingType = @tipi"); }

    const r = await rq.query(`
      SELECT p.*, (SELECT TOP 1 Url FROM dbo.PropertyImages i
                   WHERE i.PropertyId = p.Id ORDER BY i.IsCover DESC, i.SortOrder) AS CoverUrl,
             ${roomListSql}
      FROM dbo.Properties p
      WHERE ${where.join(" AND ")}
      ORDER BY p.CreatedAt DESC`);
    res.json(r.recordset);
  } catch (e) { next(e); }
});

router.get("/manage", requireUser, requireRole("admin"), async (req, res, next) => {
  try {
    const r = await getPool().request().query(`
      SELECT p.*,
        (SELECT TOP 1 Url FROM dbo.PropertyImages i
         WHERE i.PropertyId = p.Id ORDER BY i.IsCover DESC, i.SortOrder) AS CoverUrl,
        STUFF((
          SELECT '|' + i.Url FROM dbo.PropertyImages i
          WHERE i.PropertyId = p.Id
          ORDER BY i.IsCover DESC, i.SortOrder
          FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 1, '') AS ImageUrls,
        ${roomListSql}
      FROM dbo.Properties p
      ORDER BY p.CreatedAt DESC`);
    res.json(r.recordset);
  } catch (e) { next(e); }
});

// Publike: një pronë me të gjitha fotot
router.get("/:id", async (req, res, next) => {
  try {
    const pool = getPool();
    const p = await pool.request().input("id", sql.Int, req.params.id)
      .query("SELECT * FROM dbo.Properties WHERE Id = @id");
    if (!p.recordset.length || p.recordset[0].Visibility === "private") {
      return res.status(404).json({ error: "Prona nuk u gjet." });
    }
    const imgs = await pool.request().input("id", sql.Int, req.params.id)
      .query("SELECT Id, Url, IsCover FROM dbo.PropertyImages WHERE PropertyId = @id ORDER BY IsCover DESC, SortOrder");
    const rooms = await pool.request().input("id", sql.Int, req.params.id)
      .query("SELECT RoomType, Quantity FROM dbo.PropertyRooms WHERE PropertyId = @id");
    const row = p.recordset[0];
    const point = await resolvePoint(row);
    res.json({ ...row, Lat: point?.lat ?? row.Lat, Lng: point?.lng ?? row.Lng, images: imgs.recordset, rooms: rooms.recordset });
  } catch (e) { next(e); }
});

function bindProperty(rq, b) {
  return rq
    .input("title", sql.NVarChar, b.title)
    .input("titleEn", sql.NVarChar, b.titleEn ?? null)
    .input("desc", sql.NVarChar, b.description ?? null)
    .input("price", sql.Decimal(12, 2), b.price)
    .input("ltype", sql.NVarChar, b.listingType ?? "sale")
    .input("area", sql.Decimal(8, 2), b.areaM2 ?? null)
    .input("rooms", sql.Int, b.rooms ?? null)
    .input("city", sql.NVarChar, b.city)
    .input("cityId", sql.NVarChar, b.cityId ?? null)
    .input("hood", sql.NVarChar, b.neighborhood ?? null)
    .input("placeId", sql.NVarChar, b.placeId ?? null)
    .input("addr", sql.NVarChar, b.address ?? null)
    .input("lat", sql.Decimal(9, 6), b.lat ?? null)
    .input("lng", sql.Decimal(9, 6), b.lng ?? null)
    .input("status", sql.NVarChar, STATUSES.includes(b.status) ? b.status : "available")
    .input("visibility", sql.NVarChar, VISIBILITIES.includes(b.visibility) ? b.visibility : "public");
}

function invalidProperty(b) {
  return !b.title || !b.price || !b.city;
}

// Vetëm admin: shton pronë
router.post("/", requireUser, requireRole("admin"), async (req, res, next) => {
  try {
    const b = req.body;
    if (invalidProperty(b))
      return res.status(400).json({ error: "Titulli, çmimi dhe qyteti janë të detyrueshëm." });
    const r = await bindProperty(getPool().request(), b)
      .input("owner", sql.Int, req.user.id)
      .query(`INSERT INTO dbo.Properties
        (OwnerId,Title,TitleEn,Description,Price,ListingType,AreaM2,Rooms,City,CityId,Neighborhood,PlaceId,Address,Lat,Lng,Status,Visibility)
        OUTPUT INSERTED.Id
        VALUES (@owner,@title,@titleEn,@desc,@price,@ltype,@area,@rooms,@city,@cityId,@hood,@placeId,@addr,@lat,@lng,@status,@visibility)`);
    await saveRooms(r.recordset[0].Id, b.roomCounts);
    res.status(201).json({ id: r.recordset[0].Id });
  } catch (e) { next(e); }
});

router.put("/:id", requireUser, requireRole("admin"), async (req, res, next) => {
  try {
    const b = req.body;
    if (invalidProperty(b))
      return res.status(400).json({ error: "Titulli, çmimi dhe qyteti janë të detyrueshëm." });
    const r = await bindProperty(getPool().request(), b)
      .input("id", sql.Int, req.params.id)
      .query(`UPDATE dbo.Properties SET
        Title=@title, TitleEn=@titleEn, Description=@desc, Price=@price, ListingType=@ltype,
        AreaM2=@area, Rooms=@rooms, City=@city, CityId=@cityId, Neighborhood=@hood,
        PlaceId=@placeId, Address=@addr, Lat=@lat, Lng=@lng, Status=@status, Visibility=@visibility
        OUTPUT INSERTED.Id
        WHERE Id=@id`);
    if (!r.recordset.length) return res.status(404).json({ error: "Prona nuk u gjet." });
    await saveRooms(r.recordset[0].Id, b.roomCounts);
    res.json({ id: r.recordset[0].Id });
  } catch (e) { next(e); }
});

router.delete("/:id", requireUser, requireRole("admin"), async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.request().input("id", sql.Int, req.params.id)
      .query("DELETE FROM dbo.Issues WHERE PropertyId = @id");
    const r = await pool.request().input("id", sql.Int, req.params.id)
      .query("DELETE FROM dbo.Properties OUTPUT DELETED.Id WHERE Id = @id");
    if (!r.recordset.length) return res.status(404).json({ error: "Prona nuk u gjet." });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;