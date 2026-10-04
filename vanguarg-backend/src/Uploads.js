import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { getPool } from "./db.js";
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
      const propertyId = Number(req.params.id);
      if (!Number.isInteger(propertyId) || propertyId < 1)
        return res.status(404).json({ error: "Prona nuk u gjet." });

      const pool = getPool();
      const meta = await pool.query(
        `SELECT COUNT(*)::int AS n,
                COALESCE(SUM(CASE WHEN is_cover THEN 1 ELSE 0 END), 0)::int AS covers
         FROM property_images WHERE property_id = $1`,
        [propertyId]
      );
      const start = meta.rows[0].n;
      const hasCover = meta.rows[0].covers > 0;
      for (const [i, f] of req.files.entries()) {
        await pool.query(
          "INSERT INTO property_images (property_id, url, is_cover, sort_order) VALUES ($1, $2, $3, $4)",
          [propertyId, `/uploads/${f.filename}`, !hasCover && i === 0, start + i]
        );
      }
      res.status(201).json({ uploaded: req.files.length });
    } catch (e) { next(e); }
  });

export default router;