import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import sql from 'mssql';import { getPool } from "./db.js";
import { requireUser, requireRole } from "./Auth.js";

export const UPLOAD_DIR = path.resolve("uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_r, f, cb) =>
      cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase()),
  }),
  fileFilter: (_r, f, cb) =>
    cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype)),
});

const router = Router();

// POST /api/properties/:id/images  (form-data, fusha "images")
router.post("/:id/images", requireUser, requireRole("admin"),
  upload.array("images", 20), async (req, res, next) => {
    try {
      if (!req.files?.length) return res.status(400).json({ error: "Zgjidh foto JPG, PNG ose WEBP." });
      const pool = getPool();
      const meta = await pool.request().input("p", sql.Int, req.params.id)
        .query(`SELECT COUNT(*) AS n,
                       SUM(CASE WHEN IsCover = 1 THEN 1 ELSE 0 END) AS covers
                FROM dbo.PropertyImages WHERE PropertyId = @p`);
      const start = meta.recordset[0].n;
      const hasCover = meta.recordset[0].covers > 0;
      for (const [i, f] of req.files.entries()) {
        await pool.request()
          .input("p", sql.Int, req.params.id)
          .input("u", sql.NVarChar, `/uploads/${f.filename}`)
          .input("c", sql.Bit, !hasCover && i === 0)
          .input("s", sql.Int, start + i)
          .query("INSERT INTO dbo.PropertyImages (PropertyId,Url,IsCover,SortOrder) VALUES (@p,@u,@c,@s)");
      }
      res.status(201).json({ uploaded: req.files.length });
    } catch (e) { next(e); }
  });

export default router;