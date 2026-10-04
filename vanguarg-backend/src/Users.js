import { Router } from "express";
import { getPool } from "./db.js";
import { requireUser } from "./Auth.js";

const router = Router();

router.get(
  "/",
  requireUser,
  async (_req, res, next) => {
    try {
      const r = await getPool().request().query(`
        SELECT
          Id,
          FullName,
          Email,
          Role,
          CreatedAt
        FROM dbo.Users
        ORDER BY CreatedAt DESC
      `);

      res.json(r.recordset);
    } catch (e) {
      next(e);
    }
  }
);

export default router;