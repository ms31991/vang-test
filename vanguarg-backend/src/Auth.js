import { clerkClient } from "@clerk/express";
import { getPool } from "./db.js";
import { clerkUserIdFromRequest } from "./session.js";

// Kërkon që përdoruesi të jetë i identifikuar në Clerk.
// Nëse hyn për herë të parë, e krijon në databazë me rolin 'client'.
export async function requireUser(req, res, next) {
  try {
    const userId = await clerkUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "Duhet të hysh në llogari." });

    const pool = getPool();
    let r = await pool.query(
      `SELECT id, role, full_name AS "fullName", email
       FROM users WHERE clerk_user_id = $1`,
      [userId]
    );

    if (!r.rows.length) {
      let name = null;
      let email = null;
      if (process.env.CLERK_SECRET_KEY) {
        const cu = await clerkClient.users.getUser(userId);
        email = cu.emailAddresses?.[0]?.emailAddress ?? null;
        name = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null;
      }
      r = await pool.query(
        `INSERT INTO users (clerk_user_id, full_name, email)
         VALUES ($1, $2, $3)
         RETURNING id, role, full_name AS "fullName", email`,
        [userId, name, email]
      );
    }
    const row = r.rows[0];
    req.user = {
      id: Number(row.id),
      role: row.role,
      name: row.fullName || null,
      email: row.email || null,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: "Nuk ke leje." });