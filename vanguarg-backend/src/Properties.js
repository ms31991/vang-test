import { Router } from "express";
import { getPool } from "./db.js";
import { requireUser } from "./Auth.js";

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

  const hit = knownPlaces.find((place) =>
    place.q.some((part) =>
      name.includes(normalizePlace(part))
    )
  );

  return hit
    ? {
        lat: hit.lat,
        lng: hit.lng,
      }
    : null;
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ch&q=${encodeURIComponent(
    query
  )}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "VanguardRealEstate/1.0",
      "Accept-Language": "de",
    },
    signal: AbortSignal.timeout(4000),
  });

  if (!response.ok) return null;

  const rows = await response.json();

  if (!rows[0]) return null;

  return {
    lat: Number(rows[0].lat),
    lng: Number(rows[0].lon),
  };
}

function savedPoint(lat, lng) {
  return (
    lat != null &&
    lng != null &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat >= 45 &&
    lat <= 48.5 &&
    lng >= 5 &&
    lng <= 11.5
  );
}

async function resolvePoint(row) {
  const lat = row.Lat == null ? null : Number(row.Lat);
  const lng = row.Lng == null ? null : Number(row.Lng);

  if (savedPoint(lat, lng)) {
    return {
      lat,
      lng,
    };
  }

  if (row.Address) {
    const query = [
      row.Address,
      row.Neighborhood,
      row.City,
      "Schweiz",
    ]
      .filter(Boolean)
      .join(", ");

    const found = await geocode(query).catch(() => null);

    if (found) return found;
  }

  return knownPoint(
    `${row.Neighborhood || ""} ${row.City || ""} ${row.Address || ""}`
  );
}

const router = Router();

const ROOM_TYPES = [
  "living",
  "bedroom",
  "kitchen",
  "bathroom",
  "wc",
  "balcony",
];

const STATUSES = [
  "available",
  "sold",
  "rented",
];

const VISIBILITIES = [
  "public",
  "private",
];

// Kolonat e properties me emrat që pret frontend-i
const PROP_COLS = `
  p.id AS "Id",
  p.owner_id AS "OwnerId",
  p.client_id AS "ClientId",
  p.title AS "Title",
  p.title_en AS "TitleEn",
  p.description AS "Description",
  p.price AS "Price",
  p.listing_type AS "ListingType",
  p.area_m2 AS "AreaM2",
  p.rooms AS "Rooms",
  p.city AS "City",
  p.city_id AS "CityId",
  p.neighborhood AS "Neighborhood",
  p.place_id AS "PlaceId",
  p.address AS "Address",
  p.lat AS "Lat",
  p.lng AS "Lng",
  p.status AS "Status",
  p.visibility AS "Visibility",
  p.created_at AS "CreatedAt"
`;

const COVER_SQL = `
  (
    SELECT i.url
    FROM property_images i
    WHERE i.property_id = p.id
    ORDER BY i.is_cover DESC, i.sort_order
    LIMIT 1
  ) AS "CoverUrl"
`;

const ROOM_LIST_SQL = `
  (
    SELECT STRING_AGG(
      r.room_type || ':' || r.quantity::text,
      '|' ORDER BY r.id
    )
    FROM property_rooms r
    WHERE r.property_id = p.id
  ) AS "RoomList"
`;

const IMAGE_URLS_SQL = `
  (
    SELECT STRING_AGG(
      i.url,
      '|' ORDER BY i.is_cover DESC, i.sort_order
    )
    FROM property_images i
    WHERE i.property_id = p.id
  ) AS "ImageUrls"
`;

async function saveRooms(propertyId, rooms) {
  const pool = getPool();

  await pool.query(
    "DELETE FROM property_rooms WHERE property_id = $1",
    [propertyId]
  );

  for (const room of rooms || []) {
    const qty = Number(room.count);

    if (
      !ROOM_TYPES.includes(room.type) ||
      !Number.isInteger(qty) ||
      qty < 1
    ) {
      continue;
    }

    await pool.query(
      `INSERT INTO property_rooms
        (property_id, room_type, quantity)
       VALUES ($1, $2, $3)`,
      [
        propertyId,
        room.type,
        qty,
      ]
    );
  }
}

function parseId(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

// ======================================================
// PUBLIC - LISTA E PRONAVE
// ======================================================

// GET /api/properties
//
// Shembull:
// ?ort=zuerich
// ?tipi=rent
// ?lokacioni=Zürich - Enge

router.get("/", async (req, res, next) => {
  try {
    const {
      lokacioni,
      tipi,
      ort,
    } = req.query;

    const params = [];

    const add = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    const where = [
      "p.visibility = 'public'",
    ];

    if (ort) {
      const exact = add(String(ort));
      const like = add(`%${ort}%`);

      where.push(`
        (
          p.place_id = ${exact}
          OR p.city_id = ${exact}
          OR p.city ILIKE ${like}
          OR p.neighborhood ILIKE ${like}
          OR p.title ILIKE ${like}
          OR p.title_en ILIKE ${like}
        )
      `);
    }

    if (lokacioni) {
      String(lokacioni)
        .split(" - ")
        .forEach((part) => {
          const like = add(
            `%${part.trim()}%`
          );

          where.push(`
            (
              p.city ILIKE ${like}
              OR p.neighborhood ILIKE ${like}
              OR p.address ILIKE ${like}
            )
          `);
        });
    }

    if (tipi) {
      where.push(
        `p.listing_type = ${add(String(tipi))}`
      );
    }

    const r = await getPool().query(
      `
        SELECT
          ${PROP_COLS},
          ${COVER_SQL},
          ${ROOM_LIST_SQL}
        FROM properties p
        WHERE ${where.join(" AND ")}
        ORDER BY p.created_at DESC
      `,
      params
    );

    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

// ======================================================
// MANAGEMENT - ÇDO USER I KYÇUR
// ======================================================

// Tani nuk ka më requireRole("admin").
// Çdo user i kyçur mund ta përdorë.

router.get(
  "/manage",
  requireUser,
  async (req, res, next) => {
    try {
      const r = await getPool().query(
        `
          SELECT
            ${PROP_COLS},
            ${COVER_SQL},
            ${IMAGE_URLS_SQL},
            ${ROOM_LIST_SQL}
          FROM properties p
          ORDER BY p.created_at DESC
        `
      );

      res.json(r.rows);
    } catch (e) {
      next(e);
    }
  }
);

// ======================================================
// PUBLIC - NJË PRONË
// ======================================================

router.get(
  "/:id",
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);

      if (!id) {
        return res.status(404).json({
          error: "Prona nuk u gjet.",
        });
      }

      const pool = getPool();

      const p = await pool.query(
        `
          SELECT
            ${PROP_COLS}
          FROM properties p
          WHERE p.id = $1
        `,
        [id]
      );

      if (
        !p.rows.length ||
        p.rows[0].Visibility === "private"
      ) {
        return res.status(404).json({
          error: "Prona nuk u gjet.",
        });
      }

      const imgs = await pool.query(
        `
          SELECT
            id AS "Id",
            url AS "Url",
            is_cover AS "IsCover"
          FROM property_images
          WHERE property_id = $1
          ORDER BY is_cover DESC, sort_order
        `,
        [id]
      );

      const rooms = await pool.query(
        `
          SELECT
            room_type AS "RoomType",
            quantity AS "Quantity"
          FROM property_rooms
          WHERE property_id = $1
        `,
        [id]
      );

      const row = p.rows[0];

      const point = await resolvePoint(row);

      res.json({
        ...row,

        Lat: point?.lat ?? row.Lat,
        Lng: point?.lng ?? row.Lng,

        images: imgs.rows,
        rooms: rooms.rows,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ======================================================
// PROPERTY VALUES
// ======================================================

function propertyValues(b) {
  return [
    b.title,
    b.titleEn ?? null,
    b.description ?? null,
    b.price,
    b.listingType ?? "sale",
    b.areaM2 ?? null,
    b.rooms ?? null,
    b.city,
    b.cityId ?? null,
    b.neighborhood ?? null,
    b.placeId ?? null,
    b.address ?? null,
    b.lat ?? null,
    b.lng ?? null,

    STATUSES.includes(b.status)
      ? b.status
      : "available",

    VISIBILITIES.includes(b.visibility)
      ? b.visibility
      : "public",
  ];
}

function invalidProperty(b) {
  return (
    !b.title ||
    !b.price ||
    !b.city
  );
}

// ======================================================
// ADD PROPERTY
// ÇDO USER I KYÇUR
// ======================================================

router.post(
  "/",
  requireUser,
  async (req, res, next) => {
    try {
      const b = req.body;

      if (invalidProperty(b)) {
        return res.status(400).json({
          error:
            "Titulli, çmimi dhe qyteti janë të detyrueshëm.",
        });
      }

      const r = await getPool().query(
        `
          INSERT INTO properties
          (
            owner_id,
            title,
            title_en,
            description,
            price,
            listing_type,
            area_m2,
            rooms,
            city,
            city_id,
            neighborhood,
            place_id,
            address,
            lat,
            lng,
            status,
            visibility
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17
          )
          RETURNING id AS "Id"
        `,
        [
          req.user.id,
          ...propertyValues(b),
        ]
      );

      await saveRooms(
        r.rows[0].Id,
        b.roomCounts
      );

      res.status(201).json({
        id: r.rows[0].Id,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ======================================================
// UPDATE PROPERTY
// ÇDO USER I KYÇUR
// ======================================================

router.put(
  "/:id",
  requireUser,
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);

      if (!id) {
        return res.status(404).json({
          error: "Prona nuk u gjet.",
        });
      }

      const b = req.body;

      if (invalidProperty(b)) {
        return res.status(400).json({
          error:
            "Titulli, çmimi dhe qyteti janë të detyrueshëm.",
        });
      }

      const r = await getPool().query(
        `
          UPDATE properties
          SET
            title = $1,
            title_en = $2,
            description = $3,
            price = $4,
            listing_type = $5,
            area_m2 = $6,
            rooms = $7,
            city = $8,
            city_id = $9,
            neighborhood = $10,
            place_id = $11,
            address = $12,
            lat = $13,
            lng = $14,
            status = $15,
            visibility = $16
          WHERE id = $17
          RETURNING id AS "Id"
        `,
        [
          ...propertyValues(b),
          id,
        ]
      );

      if (!r.rows.length) {
        return res.status(404).json({
          error: "Prona nuk u gjet.",
        });
      }

      await saveRooms(
        r.rows[0].Id,
        b.roomCounts
      );

      res.json({
        id: r.rows[0].Id,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ======================================================
// DELETE PROPERTY
// ÇDO USER I KYÇUR
// ======================================================

router.delete(
  "/:id",
  requireUser,
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);

      if (!id) {
        return res.status(404).json({
          error: "Prona nuk u gjet.",
        });
      }

      const pool = getPool();

      await pool.query(
        "DELETE FROM issues WHERE property_id = $1",
        [id]
      );

      const r = await pool.query(
        `
          DELETE FROM properties
          WHERE id = $1
          RETURNING id
        `,
        [id]
      );

      if (!r.rows.length) {
        return res.status(404).json({
          error: "Prona nuk u gjet.",
        });
      }

      res.json({
        ok: true,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;