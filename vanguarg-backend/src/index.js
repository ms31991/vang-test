import "dotenv/config";

import "./loadEnv.js";

import cors from "cors";
import express from "express";
import { clerkMiddleware } from "@clerk/express";

import { connectDb, getPool } from "./db.js";
import { initDb } from "./initDB.js";

import { requireUser } from "./Auth.js";

import propertiesRouter from "./Properties.js";
import uploadsRouter, { UPLOAD_DIR } from "./Uploads.js";
import messagesRouter from "./Messages.js";
import issuesRouter from "./Issues.js";
import usersRouter from "./Users.js";
import servicesRouter from "./Services.js";
import seoRouter from "./Seo.js";

const app = express();

const port = Number(process.env.PORT) || 3001;

app.use(cors());

app.use(express.json());

if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
}

app.use("/uploads", express.static(UPLOAD_DIR));

app.use(seoRouter);

app.get("/api/health", async (_req, res) => {
  try {
    const r = await getPool().query(
      "SELECT current_database() AS name"
    );

    res.json({
      ok: true,
      service: "vanguarg-backend",
      database: r.rows[0].name,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.get("/api/me", requireUser, (req, res) => {
  res.json(req.user);
});

app.put("/api/me", requireUser, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim();
    const name = String(req.body?.name || "").trim();

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        error: "Email i pavlefshëm.",
      });
    }

    await getPool().query(
      `UPDATE users
       SET
         email = COALESCE($1::text, email),
         full_name = COALESCE($2::text, full_name)
       WHERE id = $3`,
      [
        email || null,
        name || null,
        req.user.id,
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use("/api/properties", propertiesRouter);
app.use("/api/properties", uploadsRouter);

app.use("/api/messages", messagesRouter);
app.use("/api/issues", issuesRouter);
app.use("/api/users", usersRouter);
app.use("/api/services", servicesRouter);

app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    error: "Gabim i brendshëm i serverit.",
  });
});

/*
 * START DATABASE
 *
 * 1. Lidhu me PostgreSQL
 * 2. Krijo tabelat që mungojnë
 * 3. Pastaj starto Express
 */
async function startServer() {
  try {
    await connectDb();

    console.log("✅ PostgreSQL connected");

    await initDb();

    console.log("✅ Database initialized");

    app.listen(port, () => {
      console.log(
        `🚀 vanguarg-backend gati në port ${port}`
      );
    });
  } catch (err) {
    console.error("❌ Server startup failed:", err);

    process.exit(1);
  }
}

startServer();