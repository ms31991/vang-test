import { Router } from "express";
import { getPool } from "./db.js";

const router = Router();

const STATIC_PATHS = ["/", "/pronat", "/rreth-nesh", "/datenschutz", "/agb", "/cookies", "/impressum"];

function origin(req) {
  const configured = process.env.PUBLIC_SITE_URL || process.env.VITE_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = req.get("x-forwarded-host") || req.get("host");
  const proto = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
  return `${proto}://${host}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

router.get("/robots.txt", (req, res) => {
  const site = origin(req);
  res.type("text/plain").send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /hyr
Disallow: /regjistrohu

Sitemap: ${site}/sitemap.xml
`);
});

router.get("/sitemap.xml", async (req, res) => {
  try {
    const rows = await getPool()
      .request()
      .query("SELECT Id, CreatedAt FROM dbo.Properties WHERE Visibility = 'public' AND Status = 'available' ORDER BY Id");
    const site = origin(req);
    const urls = [
      ...STATIC_PATHS.map((loc) => ({ loc, lastmod: "" })),
      ...rows.recordset.map((row) => ({
        loc: `/pronat/${row.Id}`,
        lastmod: row.CreatedAt ? new Date(row.CreatedAt).toISOString().slice(0, 10) : "",
      })),
    ];
    const body = urls
      .map((url) => {
        const last = url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : "";
        return `<url><loc>${escapeXml(site + url.loc)}</loc>${last}</url>`;
      })
      .join("");
    res
      .type("application/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
  } catch (err) {
    console.error(err);
    res.status(500).type("text/plain").send("sitemap unavailable");
  }
});

export default router;
