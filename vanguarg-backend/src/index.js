import "dotenv/config";
import "./loadEnv.js";
import cors from "cors";
import express from "express";
import sql from 'mssql';import { clerkMiddleware } from "@clerk/express";
import { connectDb, getPool } from "./db.js";
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
    const r = await getPool().request().query("SELECT DB_NAME() AS name");
    res.json({ ok: true, service: "vanguarg-backend", database: r.recordset[0].name });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/me", requireUser, (req, res) => res.json(req.user));

app.put("/api/me", requireUser, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim();
    const name = String(req.body?.name || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Email i pavlefshëm." });
    }
    await getPool().request()
      .input("id", sql.Int, req.user.id)
      .input("email", sql.NVarChar, email || null)
      .input("name", sql.NVarChar, name || null)
      .query(`UPDATE dbo.Users
              SET Email = COALESCE(@email, Email),
                  FullName = COALESCE(@name, FullName)
              WHERE Id = @id`);
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
  res.status(500).json({ error: "Gabim i brendshëm i serverit." });
});

await connectDb();
app.listen(port, () => console.log(`vanguarg-backend gati në http://localhost:${port}`));