import { Router } from "express";
import { getPool } from "./db.js";
import { requireUser } from "./Auth.js";

const router = Router();

router.get("/", requireUser, async (_req, res, next) => {
  try {
    const r = await getPool().query(`
      SELECT
        id AS "Id",
        full_name AS "FullName",
        email AS "Email",
        role AS "Role",
        created_at AS "CreatedAt"
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

export default router;