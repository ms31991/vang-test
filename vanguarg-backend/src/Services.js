import { Router } from "express";
import sql from "mssql/msnodesqlv8.js";
import { getPool } from "./db.js";
import { requireUser, requireRole } from "./Auth.js";

const router = Router();

const DEFAULTS = [
  ["Kaufberatung", "Buying advice", "Wir suchen die passende Immobilie und begleiten den Kauf bis zum Abschluss.", "We look for the right property and stay with the purchase until it is done."],
  ["Verkauf", "Selling", "Bewertung, Inserat und Verkauf der Immobilie zum passenden Preis.", "Value the home, list it and sell it at a fitting price."],
  ["Vermietung", "Renting", "Wohnungen und Häuser zur Miete anbieten und Mieter finden.", "Offer homes for rent and find the tenant."],
  ["Bewertung", "Valuation", "Den Marktwert einer Immobilie klar und nachvollziehbar einschätzen.", "Estimate what a property is worth, clearly and in plain terms."],
  ["Verwaltung", "Management", "Laufende Betreuung von Mietobjekten, Unterhalt und Abrechnungen.", "Look after rented homes, upkeep and the accounts."],
  ["Besichtigung", "Viewings", "Termine vor Ort organisieren und die Immobilie zeigen.", "Arrange visits and show the property on site."],
  ["Verträge", "Contracts", "Miet- und Kaufverträge vorbereiten und die Unterlagen ordnen.", "Prepare rent and sale contracts and keep the papers in order."],
  ["Finanzierung", "Financing", "Beim Überblick über Preis, Anzahlung und nächste Schritte helfen.", "Help you see the price, the deposit and the next step."],
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

async function ensureServices() {
  const pool = getPool();
  const created = await pool.request().query(`
    IF OBJECT_ID('dbo.Services','U') IS NULL
    BEGIN
      CREATE TABLE dbo.Services (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        SortOrder INT NOT NULL,
        TitleDe   NVARCHAR(160) NOT NULL,
        TitleEn   NVARCHAR(160) NOT NULL,
        TextDe    NVARCHAR(800) NOT NULL,
        TextEn    NVARCHAR(800) NOT NULL
      );
      SELECT 1 AS created;
    END
    ELSE SELECT 0 AS created;
  `);
  if (!created.recordset[0]?.created) return;

  for (let i = 0; i < DEFAULTS.length; i += 1) {
    const [titleDe, titleEn, textDe, textEn] = DEFAULTS[i];
    await pool.request()
      .input("sort", sql.Int, i)
      .input("titleDe", sql.NVarChar, titleDe)
      .input("titleEn", sql.NVarChar, titleEn)
      .input("textDe", sql.NVarChar, textDe)
      .input("textEn", sql.NVarChar, textEn)
      .query(`INSERT INTO dbo.Services (SortOrder, TitleDe, TitleEn, TextDe, TextEn)
              VALUES (@sort, @titleDe, @titleEn, @textDe, @textEn)`);
  }
}

async function listServices() {
  await ensureServices();
  const rows = await getPool().request().query(`
    SELECT Id, TitleDe, TitleEn, TextDe, TextEn
    FROM dbo.Services
    ORDER BY SortOrder, Id
  `);
  return rows.recordset.map(mapRow);
}

router.get("/", async (_req, res, next) => {
  try {
    res.json(await listServices());
  } catch (error) {
    next(error);
  }
});

router.put("/", requireUser, requireRole("admin"), async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) return res.status(400).json({ error: "Liste fehlt." });

    const clean = items.map((item) => ({
      titleDe: String(item.titleDe || "").trim(),
      titleEn: String(item.titleEn || item.titleDe || "").trim(),
      textDe: String(item.textDe || "").trim(),
      textEn: String(item.textEn || item.textDe || "").trim(),
    }));
    if (clean.some((item) => !item.titleDe || !item.textDe)) {
      return res.status(400).json({ error: "Titel und Text auf Deutsch sind nötig." });
    }

    await ensureServices();
    const pool = getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).query("DELETE FROM dbo.Services");
      for (let i = 0; i < clean.length; i += 1) {
        const item = clean[i];
        await new sql.Request(tx)
          .input("sort", sql.Int, i)
          .input("titleDe", sql.NVarChar, item.titleDe)
          .input("titleEn", sql.NVarChar, item.titleEn)
          .input("textDe", sql.NVarChar, item.textDe)
          .input("textEn", sql.NVarChar, item.textEn)
          .query(`INSERT INTO dbo.Services (SortOrder, TitleDe, TitleEn, TextDe, TextEn)
                  VALUES (@sort, @titleDe, @titleEn, @textDe, @textEn)`);
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
    res.json(await listServices());
  } catch (error) {
    next(error);
  }
});

export default router;
