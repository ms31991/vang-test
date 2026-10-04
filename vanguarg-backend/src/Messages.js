import { Router } from "express";
import { getPool } from "./db.js";
import { requireUser } from "./Auth.js";
import { notifyChatMessage } from "./mail.js";
import { notePresence } from "./presence.js";

const router = Router();
router.use(requireUser);

router.post("/presence", (req, res) => {
  notePresence(req.user.id, req.body?.open !== false, req.body?.at);
  res.json({ ok: true });
});

function isStaff(user) {
  return user.role === "admin" || user.role === "owner";
}

function userId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function displayName(row) {
  const name = row.FullName && String(row.FullName).trim();
  const email = row.Email && String(row.Email).trim();
  return name || email || `User ${row.Id}`;
}

async function supportAccount(pool) {
  const r = await pool.query(`
    SELECT id AS "Id", full_name AS "FullName", email AS "Email", role AS "Role"
    FROM users
    WHERE role IN ('admin', 'owner')
    ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, id
    LIMIT 1`);
  return r.rows[0] || null;
}

router.get("/conversations", async (req, res, next) => {
  try {
    const pool = getPool();
    if (!isStaff(req.user)) {
      const support = await supportAccount(pool);
      if (!support) return res.status(500).json({ error: "Nuk ka support." });
      const supportId = userId(support.Id);

      const last = await pool.query(
        `SELECT body AS "Body", sent_at AS "SentAt"
         FROM messages
         WHERE (sender_id = $1 AND receiver_id = $2)
            OR (sender_id = $2 AND receiver_id = $1)
         ORDER BY sent_at DESC, id DESC
         LIMIT 1`,
        [req.user.id, supportId]
      );
      const unread = await pool.query(
        `SELECT COUNT(*)::int AS "Unread"
         FROM messages
         WHERE sender_id = $2 AND receiver_id = $1 AND is_read = false`,
        [req.user.id, supportId]
      );
      const latest = last.rows[0];
      return res.json([{
        id: supportId,
        name: "Support",
        lastBody: latest?.Body || null,
        lastAt: latest?.SentAt || null,
        unread: unread.rows[0]?.Unread || 0,
      }]);
    }

    const r = await pool.query(
      `SELECT
         other.id AS "Id",
         other.full_name AS "FullName",
         other.email AS "Email",
         lastMsg.body AS "LastBody",
         lastMsg.sent_at AS "LastAt",
         (
           SELECT COUNT(*)::int
           FROM messages unread
           WHERE unread.sender_id = other.id
             AND unread.receiver_id = $1
             AND unread.is_read = false
         ) AS "Unread"
       FROM users other
       JOIN (
         SELECT other_id, MAX(id) AS last_id
         FROM (
           SELECT
             CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_id,
             m.id
           FROM messages m
           WHERE m.sender_id = $1 OR m.receiver_id = $1
         ) t
         GROUP BY other_id
       ) pairs ON pairs.other_id = other.id
       JOIN messages lastMsg ON lastMsg.id = pairs.last_id
       ORDER BY lastMsg.sent_at DESC`,
      [req.user.id]
    );

    res.json(r.rows.map((row) => ({
      id: userId(row.Id),
      name: displayName(row),
      email: row.Email || null,
      lastBody: row.LastBody,
      lastAt: row.LastAt,
      unread: row.Unread || 0,
    })));
  } catch (e) { next(e); }
});

router.get("/with/:userId", async (req, res, next) => {
  try {
    const pool = getPool();
    const support = await supportAccount(pool);
    if (!support) return res.status(500).json({ error: "Nuk ka support." });

    const supportId = userId(support.Id);
    let otherId = userId(req.params.userId);
    if (!isStaff(req.user)) {
      if (otherId !== supportId) return res.status(403).json({ error: "Nuk ke leje." });
      otherId = supportId;
    }
    if (!otherId || otherId === userId(req.user.id)) {
      return res.status(400).json({ error: "Biseda nuk është e vlefshme." });
    }

    const person = await pool.query(
      `SELECT id AS "Id", full_name AS "FullName", email AS "Email"
       FROM users WHERE id = $1`,
      [otherId]
    );
    const peer = person.rows[0];
    if (!peer) return res.status(404).json({ error: "Përdoruesi nuk u gjet." });

    await pool.query(
      `UPDATE messages
       SET is_read = true
       WHERE sender_id = $2 AND receiver_id = $1 AND is_read = false`,
      [req.user.id, otherId]
    );

    const r = await pool.query(
      `SELECT id AS "Id", body AS "Body", sender_id AS "SenderId", sent_at AS "SentAt"
       FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY sent_at ASC, id ASC`,
      [req.user.id, otherId]
    );

    res.json({
      peer: {
        id: peer.Id,
        name: isStaff(req.user) ? displayName(peer) : "Support",
      },
      messages: r.rows.map((row) => ({
        id: row.Id,
        body: row.Body,
        mine: userId(row.SenderId) === userId(req.user.id),
        sentAt: row.SentAt,
      })),
    });
  } catch (e) { next(e); }
});

router.get("/", async (req, res, next) => {
  try {
    const seesAll = isStaff(req.user);
    const r = await getPool().query(
      `SELECT
         m.id AS "Id",
         m.sender_id AS "SenderId",
         m.receiver_id AS "ReceiverId",
         m.property_id AS "PropertyId",
         m.body AS "Body",
         m.sent_at AS "SentAt",
         m.is_read AS "IsRead",
         s.full_name AS "SenderName",
         rc.full_name AS "ReceiverName"
       FROM messages m
       JOIN users s ON s.id = m.sender_id
       JOIN users rc ON rc.id = m.receiver_id
       ${seesAll ? "" : "WHERE m.sender_id = $1 OR m.receiver_id = $1"}
       ORDER BY m.sent_at DESC`,
      seesAll ? [] : [req.user.id]
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const text = String(req.body?.body || "").trim();
    if (!text) return res.status(400).json({ error: "Mesazhi është bosh." });
    if (text.length > 2000) return res.status(400).json({ error: "Mesazhi është shumë i gjatë." });

    const pool = getPool();
    let receiver;

    if (isStaff(req.user)) {
      receiver = userId(req.body?.toUserId);
      if (!receiver) return res.status(400).json({ error: "Zgjidh marrësin." });
    } else {
      const support = await supportAccount(pool);
      receiver = userId(support?.Id);
    }

    if (!receiver || receiver === userId(req.user.id)) {
      return res.status(400).json({ error: "Marrësi nuk është i vlefshëm." });
    }

    const exists = await pool.query("SELECT id FROM users WHERE id = $1", [receiver]);
    if (!exists.rows.length) return res.status(404).json({ error: "Përdoruesi nuk u gjet." });

    let propertyId = Number(req.body?.propertyId);
    if (!propertyId || isStaff(req.user)) propertyId = null;
    else {
      const property = await pool.query("SELECT id FROM properties WHERE id = $1", [propertyId]);
      if (!property.rows.length) propertyId = null;
    }

    const r = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, property_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id AS "Id", body AS "Body", sender_id AS "SenderId", sent_at AS "SentAt"`,
      [req.user.id, receiver, propertyId, text]
    );
    const row = r.rows[0];
    notifyChatMessage({
      senderId: req.user.id,
      receiverId: receiver,
      staff: isStaff(req.user),
      body: text,
    }).catch((err) => console.error("chat email:", err.message));
    res.status(201).json({
      id: row.Id,
      body: row.Body,
      mine: true,
      sentAt: row.SentAt,
    });
  } catch (e) { next(e); }
});

export default router;