import { Router } from "express";
import { getPool } from "./db.js";
import { requireUser, requireRole } from "./Auth.js";

const router = Router();
router.use(requireUser);

// Kolonat e issues me emrat që pret frontend-i (PascalCase)
const ISSUE_COLS = `
  i.id AS "Id",
  i.client_id AS "ClientId",
  i.property_id AS "PropertyId",
  i.category AS "Category",
  i.description AS "Description",
  i.status AS "Status",
  i.created_at AS "CreatedAt",
  i.resolved_at AS "ResolvedAt"`;

// Klienti sheh raportet e veta; owner i sheh të gjitha
router.get("/", async (req, res, next) => {
  try {
    const seesAll = req.user.role === "owner" || req.user.role === "admin";
    const r = await getPool().query(
      `SELECT ${ISSUE_COLS},
              p.title AS "PropertyTitle",
              u.full_name AS "ClientName"
       FROM issues i
       JOIN properties p ON p.id = i.property_id
       JOIN users u ON u.id = i.client_id
       ${seesAll ? "" : "WHERE i.client_id = $1"}
       ORDER BY i.created_at DESC`,
      seesAll ? [] : [req.user.id]
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

// Klienti raporton defekt — vetëm për pronën që e ka marrë/blerë vetë
router.post("/", async (req, res, next) => {
  try {
    const { propertyId, category, description } = req.body;
    if (!propertyId || !category || !description)
      return res.status(400).json({ error: "Plotëso të gjitha fushat." });
    const pool = getPool();
    const p = await pool.query(
      "SELECT client_id FROM properties WHERE id = $1",
      [propertyId]
    );
    if (Number(p.rows[0]?.client_id) !== req.user.id)
      return res.status(403).json({ error: "Kjo banesë nuk është e lidhur me llogarinë tënde." });

    const r = await pool.query(
      `INSERT INTO issues (client_id, property_id, category, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id AS "Id", client_id AS "ClientId", property_id AS "PropertyId",
                 category AS "Category", description AS "Description",
                 status AS "Status", created_at AS "CreatedAt", resolved_at AS "ResolvedAt"`,
      [req.user.id, propertyId, category, description]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

// Owner ndryshon statusin
router.patch("/:id/status", requireRole("owner", "admin"), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["new", "in_progress", "resolved"].includes(status))
      return res.status(400).json({ error: "Status i pavlefshëm." });
    await getPool().query(
      `UPDATE issues
       SET status = $1::text,
           resolved_at = CASE WHEN $1::text = 'resolved' THEN NOW() ELSE NULL END
       WHERE id = $2`,
      [status, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;