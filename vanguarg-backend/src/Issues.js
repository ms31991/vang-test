import { Router } from "express";
import sql from "mssql/msnodesqlv8.js";
import { getPool } from "./db.js";
import { requireUser, requireRole } from "./Auth.js";

const router = Router();
router.use(requireUser);

// Klienti sheh raportet e veta; owner i sheh të gjitha
router.get("/", async (req, res, next) => {
  try {
    const seesAll = req.user.role === "owner" || req.user.role === "admin";
    const r = await getPool().request().input("me", sql.Int, req.user.id).query(`
      SELECT i.*, p.Title AS PropertyTitle, u.FullName AS ClientName
      FROM dbo.Issues i
      JOIN dbo.Properties p ON p.Id = i.PropertyId
      JOIN dbo.Users u ON u.Id = i.ClientId
      ${seesAll ? "" : "WHERE i.ClientId = @me"}
      ORDER BY i.CreatedAt DESC`);
    res.json(r.recordset);
  } catch (e) { next(e); }
});

// Klienti raporton defekt — vetëm për pronën që e ka marrë/blerë vetë
router.post("/", async (req, res, next) => {
  try {
    const { propertyId, category, description } = req.body;
    if (!propertyId || !category || !description)
      return res.status(400).json({ error: "Plotëso të gjitha fushat." });
    const pool = getPool();
    const p = await pool.request().input("id", sql.Int, propertyId)
      .query("SELECT ClientId FROM dbo.Properties WHERE Id = @id");
    if (p.recordset[0]?.ClientId !== req.user.id)
      return res.status(403).json({ error: "Kjo banesë nuk është e lidhur me llogarinë tënde." });

    const r = await pool.request()
      .input("c", sql.Int, req.user.id).input("p", sql.Int, propertyId)
      .input("cat", sql.NVarChar, category).input("d", sql.NVarChar, description)
      .query(`INSERT INTO dbo.Issues (ClientId,PropertyId,Category,Description)
              OUTPUT INSERTED.* VALUES (@c,@p,@cat,@d)`);
    res.status(201).json(r.recordset[0]);
  } catch (e) { next(e); }
});

// Owner ndryshon statusin
router.patch("/:id/status", requireRole("owner", "admin"), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["new", "in_progress", "resolved"].includes(status))
      return res.status(400).json({ error: "Status i pavlefshëm." });
    await getPool().request()
      .input("id", sql.Int, req.params.id).input("s", sql.NVarChar, status)
      .query(`UPDATE dbo.Issues SET Status=@s,
              ResolvedAt = CASE WHEN @s='resolved' THEN SYSUTCDATETIME() ELSE NULL END
              WHERE Id=@id`);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;