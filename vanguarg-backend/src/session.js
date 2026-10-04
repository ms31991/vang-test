import { createPublicKey, verify } from "node:crypto";
import { getAuth } from "@clerk/express";

function frontendApi() {
  const key = process.env.CLERK_PUBLISHABLE_KEY || "";
  const encoded = key.split("_")[2] || "";
  const decoded = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  if (!decoded.includes(".")) return "";
  return decoded;
}

let cachedKeys = [];
let cachedAt = 0;

async function signingKeys() {
  if (cachedKeys.length && Date.now() - cachedAt < 60 * 60 * 1000) return cachedKeys;
  const host = frontendApi();
  if (!host) return [];
  const response = await fetch(`https://${host}/.well-known/jwks.json`);
  if (!response.ok) return [];
  const body = await response.json();
  cachedKeys = body.keys || [];
  cachedAt = Date.now();
  return cachedKeys;
}

function decodePart(part) {
  const pad = part.length % 4 === 0 ? "" : "=".repeat(4 - (part.length % 4));
  return Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

async function userIdFromToken(token) {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) return null;

  const header = JSON.parse(decodePart(headerPart).toString("utf8"));
  const payload = JSON.parse(decodePart(payloadPart).toString("utf8"));
  if (header.alg !== "RS256") return null;

  const jwk = (await signingKeys()).find((key) => key.kid === header.kid);
  if (!jwk) return null;

  const valid = verify(
    "RSA-SHA256",
    Buffer.from(`${headerPart}.${payloadPart}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    decodePart(signaturePart),
  );
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  const issuer = `https://${frontendApi()}`;
  if (payload.iss !== issuer) return null;
  if (typeof payload.exp === "number" && payload.exp < now) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now + 10) return null;
  if (typeof payload.sub !== "string" || !payload.sub.startsWith("user_")) return null;
  return payload.sub;
}

export async function clerkUserIdFromRequest(req) {
  if (process.env.CLERK_SECRET_KEY) {
    return getAuth(req).userId || null;
  }

  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  return userIdFromToken(header.slice(7).trim());
}
