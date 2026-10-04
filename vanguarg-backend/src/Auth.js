import sql from 'mssql';
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
    let r = await pool.request()
      .input("cid", sql.NVarChar, userId)
      .query("SELECT Id, Role, FullName, Email FROM dbo.Users WHERE ClerkUserId = @cid");

    if (!r.recordset.length) {
      let name = null;
      let email = null;
      if (process.env.CLERK_SECRET_KEY) {
        const cu = await clerkClient.users.getUser(userId);
        email = cu.emailAddresses?.[0]?.emailAddress ?? null;
        name = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null;
      }
      r = await pool.request()
        .input("cid", sql.NVarChar, userId)
        .input("name", sql.NVarChar, name)
        .input("email", sql.NVarChar, email)
        .query(`INSERT INTO dbo.Users (ClerkUserId, FullName, Email)
                OUTPUT INSERTED.Id, INSERTED.Role, INSERTED.FullName, INSERTED.Email
                VALUES (@cid, @name, @email)`);
    }
    const row = r.recordset[0];
    req.user = {
      id: Number(row.Id),
      role: row.Role,
      name: row.FullName || null,
      email: row.Email || null,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: "Nuk ke leje." });