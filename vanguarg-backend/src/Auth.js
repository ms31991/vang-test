import { clerkClient } from "@clerk/express";
import { getPool } from "./db.js";
import { clerkUserIdFromRequest } from "./session.js";

// Email-et që bëhen admin automatikisht kur hyjnë.
// Mund të shtosh të tjerë edhe te Render: ADMIN_EMAILS=a@gmail.com,b@gmail.com
const ADMIN_EMAILS = [
  "mehmetalishabani04@gmail.com",
  "shabanikelmend399@gmail.com",
  ...String(process.env.ADMIN_EMAILS || "").split(","),
]
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

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

    // Nëse email-i mungon në databazë, merre nga Clerk
    if (!row.email && process.env.CLERK_SECRET_KEY) {
      const cu = await clerkClient.users.getUser(userId);
      const email = cu.emailAddresses?.[0]?.emailAddress ?? null;
      if (email) {
        await pool.query("UPDATE users SET email = $1 WHERE id = $2", [email, row.id]);
        row.email = email;
      }
    }

    // Promovo në admin nëse email-i është në listë
    if (
      row.role !== "admin" &&
      row.email &&
      ADMIN_EMAILS.includes(String(row.email).toLowerCase())
    ) {
      await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [row.id]);
      row.role = "admin";
    }

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