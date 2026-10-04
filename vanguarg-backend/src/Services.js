import { Router } from "express";
import { getPool } from "./db.js";
import { requireUser } from "./Auth.js";

const router = Router();

const DEFAULTS = [
  [
    "Kaufberatung",
    "Buying advice",
    "Wir suchen die passende Immobilie und begleiten den Kauf bis zum Abschluss.",
    "We look for the right property and stay with the purchase until it is done.",
  ],
  [
    "Verkauf",
    "Selling",
    "Bewertung, Inserat und Verkauf der Immobilie zum passenden Preis.",
    "Value the home, list it and sell it at a fitting price.",
  ],
  [
    "Vermietung",
    "Renting",
    "Wohnungen und Häuser zur Miete anbieten und Mieter finden.",
    "Offer homes for rent and find the tenant.",
  ],
  [
    "Bewertung",
    "Valuation",
    "Den Marktwert einer Immobilie klar und nachvollziehbar einschätzen.",
    "Estimate what a property is worth, clearly and in plain terms.",
  ],
  [
    "Verwaltung",
    "Management",
    "Laufende Betreuung von Mietobjekten, Unterhalt und Abrechnungen.",
    "Look after rented homes, upkeep and the accounts.",
  ],
  [
    "Besichtigung",
    "Viewings",
    "Termine vor Ort organisieren und die Immobilie zeigen.",
    "Arrange visits and show the property on site.",
  ],
  [
    "Verträge",
    "Contracts",
    "Miet- und Kaufverträge vorbereiten und die Unterlagen ordnen.",
    "Prepare rent and sale contracts and keep the papers in order.",
  ],
  [
    "Finanzierung",
    "Financing",
    "Beim Überblick über Preis, Anzahlung und nächste Schritte helfen.",
    "Help you see the price, the deposit and the next step.",
  ],
];

function mapRow(row) {
  return {
    id: row.Id,
    titleDe: row.TitleDe,
    titleEn: row.TitleEn,
    textDe: row.TextDe,
    textEn: row.TextEn,
  };
}

const INSERT_SQL = `
  INSERT INTO services
  (
    sort_order,
    title_de,
    title_en,
    text_de,
    text_en
  )
  VALUES ($1, $2, $3, $4, $5)
`;

async function ensureServices() {
  const pool = getPool();

  const exists = await pool.query(
    "SELECT to_regclass('public.services') IS NOT NULL AS exists"
  );

  if (exists.rows[0].exists) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      sort_order INTEGER NOT NULL,
      title_de   VARCHAR(160) NOT NULL,
      title_en   VARCHAR(160) NOT NULL,
      text_de    VARCHAR(800) NOT NULL,
      text_en    VARCHAR(800) NOT NULL
    )
  `);

  for (let i = 0; i < DEFAULTS.length; i += 1) {
    const [
      titleDe,
      titleEn,
      textDe,
      textEn,
    ] = DEFAULTS[i];

    await pool.query(
      INSERT_SQL,
      [
        i,
        titleDe,
        titleEn,
        textDe,
        textEn,
      ]
    );
  }
}

async function listServices() {
  await ensureServices();

  const rows = await getPool().query(`
    SELECT
      id AS "Id",
      title_de AS "TitleDe",
      title_en AS "TitleEn",
      text_de AS "TextDe",
      text_en AS "TextEn"
    FROM services
    ORDER BY sort_order, id
  `);

  return rows.rows.map(mapRow);
}

// ======================================================
// GET SERVICES
// Publik
// ======================================================

router.get(
  "/",
  async (_req, res, next) => {
    try {
      res.json(
        await listServices()
      );
    } catch (error) {
      next(error);
    }
  }
);

// ======================================================
// UPDATE SERVICES
// ÇDO USER I KYÇUR
// ======================================================

router.put(
  "/",
  requireUser,
  async (req, res, next) => {
    try {
      const items = Array.isArray(
        req.body?.items
      )
        ? req.body.items
        : null;

      if (!items) {
        return res.status(400).json({
          error: "Liste fehlt.",
        });
      }

      const clean = items.map((item) => ({
        titleDe: String(
          item.titleDe || ""
        ).trim(),

        titleEn: String(
          item.titleEn ||
            item.titleDe ||
            ""
        ).trim(),

        textDe: String(
          item.textDe || ""
        ).trim(),

        textEn: String(
          item.textEn ||
            item.textDe ||
            ""
        ).trim(),
      }));

      if (
        clean.some(
          (item) =>
            !item.titleDe ||
            !item.textDe
        )
      ) {
        return res.status(400).json({
          error:
            "Titel und Text auf Deutsch sind nötig.",
        });
      }

      await ensureServices();

      const client =
        await getPool().connect();

      try {
        await client.query(
          "BEGIN"
        );

        await client.query(
          "DELETE FROM services"
        );

        for (
          let i = 0;
          i < clean.length;
          i += 1
        ) {
          const item = clean[i];

          await client.query(
            INSERT_SQL,
            [
              i,
              item.titleDe,
              item.titleEn,
              item.textDe,
              item.textEn,
            ]
          );
        }

        await client.query(
          "COMMIT"
        );
      } catch (error) {
        await client.query(
          "ROLLBACK"
        );

        throw error;
      } finally {
        client.release();
      }

      res.json(
        await listServices()
      );
    } catch (error) {
      next(error);
    }
  }
);

export default router;