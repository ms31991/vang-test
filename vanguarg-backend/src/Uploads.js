import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { getPool } from "./db.js";
import { requireUser } from "./Auth.js";

export const UPLOAD_DIR = path.resolve("uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,

    filename: (_req, file, cb) => {
      cb(
        null,
        crypto.randomUUID() +
          path.extname(file.originalname).toLowerCase()
      );
    },
  }),

  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Vetëm foto JPG, PNG ose WEBP lejohen."
        )
      );
    }
  },

  limits: {
    files: 20,
    fileSize: 10 * 1024 * 1024, // 10 MB për foto
  },
});

const router = Router();

// ======================================================
// POST /api/properties/:id/images
//
// form-data:
// images = foto
//
// ÇDO USER I KYÇUR MUND TË NGARKOJË FOTO
// ======================================================

router.post(
  "/:id/images",
  requireUser,
  upload.array("images", 20),
  async (req, res, next) => {
    try {
      // Kontrollo nëse janë ngarkuar foto
      if (!req.files?.length) {
        return res.status(400).json({
          error:
            "Zgjidh foto JPG, PNG ose WEBP.",
        });
      }

      // Merr ID e pronës
      const propertyId = Number(
        req.params.id
      );

      if (
        !Number.isInteger(propertyId) ||
        propertyId < 1
      ) {
        return res.status(404).json({
          error: "Prona nuk u gjet.",
        });
      }

      const pool = getPool();

      // Kontrollo nëse prona ekziston
      const property = await pool.query(
        `
          SELECT id
          FROM properties
          WHERE id = $1
        `,
        [propertyId]
      );

      if (!property.rows.length) {
        // Nëse prona nuk ekziston,
        // fshij fotot që sapo u upload-uan
        for (const file of req.files) {
          try {
            fs.unlinkSync(file.path);
          } catch {
            // ignore
          }
        }

        return res.status(404).json({
          error: "Prona nuk u gjet.",
        });
      }

      // Merr numrin e fotove ekzistuese
      // dhe kontrollo nëse ekziston cover photo
      const meta = await pool.query(
        `
          SELECT
            COUNT(*)::int AS n,
            COALESCE(
              SUM(
                CASE
                  WHEN is_cover THEN 1
                  ELSE 0
                END
              ),
              0
            )::int AS covers
          FROM property_images
          WHERE property_id = $1
        `,
        [propertyId]
      );

      const start = meta.rows[0].n;
      const hasCover =
        meta.rows[0].covers > 0;

      // Ruaj fotot në database
      for (const [i, file] of req.files.entries()) {
        const isCover =
          !hasCover && i === 0;

        await pool.query(
          `
            INSERT INTO property_images
            (
              property_id,
              url,
              is_cover,
              sort_order
            )
            VALUES
            (
              $1,
              $2,
              $3,
              $4
            )
          `,
          [
            propertyId,
            `/uploads/${file.filename}`,
            isCover,
            start + i,
          ]
        );
      }

      res.status(201).json({
        uploaded: req.files.length,
      });
    } catch (e) {
      // Në rast gabimi, fshij fotot
      // që janë upload-uar fizikisht
      if (req.files?.length) {
        for (const file of req.files) {
          try {
            fs.unlinkSync(file.path);
          } catch {
            // ignore
          }
        }
      }

      next(e);
    }
  }
);

export default router;