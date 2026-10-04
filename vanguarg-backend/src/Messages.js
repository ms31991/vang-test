import { Router } from "express";
import sql from 'mssql';import { getPool } from "./db.js";
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
  const r = await pool.request().query(`
    SELECT TOP 1 Id, FullName, Email, Role
    FROM dbo.Users
    WHERE Role IN ('admin', 'owner')
    ORDER BY CASE Role WHEN 'admin' THEN 0 ELSE 1 END, Id`);
  return r.recordset[0] || null;
}

router.get("/conversations", async (req, res, next) => {
  try {
    const pool = getPool();
    if (!isStaff(req.user)) {
      const support = await supportAccount(pool);
      if (!support) return res.status(500).json({ error: "Nuk ka support." });
      const last = await pool.request()
        .input("me", sql.Int, req.user.id)
        .input("support", sql.Int, userId(support.Id))
        .query(`
          SELECT TOP 1 Body, SentAt
          FROM dbo.Messages
          WHERE (SenderId = @me AND ReceiverId = @support)
             OR (SenderId = @support AND ReceiverId = @me)
          ORDER BY SentAt DESC, Id DESC`);
      const unread = await pool.request()
        .input("me", sql.Int, req.user.id)
        .input("support", sql.Int, userId(support.Id))
        .query(`
          SELECT COUNT(*) AS Unread
          FROM dbo.Messages
          WHERE SenderId = @support AND ReceiverId = @me AND IsRead = 0`);
      const latest = last.recordset[0];
      return res.json([{
        id: userId(support.Id),
        name: "Support",
        lastBody: latest?.Body || null,
        lastAt: latest?.SentAt || null,
        unread: unread.recordset[0]?.Unread || 0,
      }]);
    }

    const r = await pool.request()
      .input("me", sql.Int, req.user.id)
      .query(`
        SELECT
          other.Id,
          other.FullName,
          other.Email,
          lastMsg.Body AS LastBody,
          lastMsg.SentAt AS LastAt,
          (
            SELECT COUNT(*)
            FROM dbo.Messages unread
            WHERE unread.SenderId = other.Id
              AND unread.ReceiverId = @me
              AND unread.IsRead = 0
          ) AS Unread
        FROM dbo.Users other
        JOIN (
          SELECT
            CASE WHEN m.SenderId = @me THEN m.ReceiverId ELSE m.SenderId END AS OtherId,
            MAX(m.Id) AS LastId
          FROM dbo.Messages m
          WHERE m.SenderId = @me OR m.ReceiverId = @me
          GROUP BY CASE WHEN m.SenderId = @me THEN m.ReceiverId ELSE m.SenderId END
        ) pairs ON pairs.OtherId = other.Id
        JOIN dbo.Messages lastMsg ON lastMsg.Id = pairs.LastId
        ORDER BY lastMsg.SentAt DESC`);

    res.json(r.recordset.map((row) => ({
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

    const person = await pool.request()
      .input("id", sql.Int, otherId)
      .query("SELECT Id, FullName, Email FROM dbo.Users WHERE Id = @id");
    const peer = person.recordset[0];
    if (!peer) return res.status(404).json({ error: "Përdoruesi nuk u gjet." });

    await pool.request()
      .input("me", sql.Int, req.user.id)
      .input("other", sql.Int, otherId)
      .query(`
        UPDATE dbo.Messages
        SET IsRead = 1
        WHERE SenderId = @other AND ReceiverId = @me AND IsRead = 0`);

    const r = await pool.request()
      .input("me", sql.Int, req.user.id)
      .input("other", sql.Int, otherId)
      .query(`
        SELECT Id, Body, SenderId, SentAt
        FROM dbo.Messages
        WHERE (SenderId = @me AND ReceiverId = @other)
           OR (SenderId = @other AND ReceiverId = @me)
        ORDER BY SentAt ASC, Id ASC`);

    res.json({
      peer: {
        id: peer.Id,
        name: isStaff(req.user) ? displayName(peer) : "Support",
      },
      messages: r.recordset.map((row) => ({
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
    const rq = getPool().request().input("me", sql.Int, req.user.id);
    const r = await rq.query(`
      SELECT m.*, s.FullName AS SenderName, rc.FullName AS ReceiverName
      FROM dbo.Messages m
      JOIN dbo.Users s ON s.Id = m.SenderId
      JOIN dbo.Users rc ON rc.Id = m.ReceiverId
      ${seesAll ? "" : "WHERE m.SenderId = @me OR m.ReceiverId = @me"}
      ORDER BY m.SentAt DESC`);
    res.json(r.recordset);
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

    const exists = await pool.request()
      .input("id", sql.Int, receiver)
      .query("SELECT Id FROM dbo.Users WHERE Id = @id");
    if (!exists.recordset.length) return res.status(404).json({ error: "Përdoruesi nuk u gjet." });

    let propertyId = Number(req.body?.propertyId);
    if (!propertyId || isStaff(req.user)) propertyId = null;
    else {
      const property = await pool.request()
        .input("id", sql.Int, propertyId)
        .query("SELECT Id FROM dbo.Properties WHERE Id = @id");
      if (!property.recordset.length) propertyId = null;
    }

    const r = await pool.request()
      .input("s", sql.Int, req.user.id)
      .input("r", sql.Int, receiver)
      .input("p", sql.Int, propertyId)
      .input("b", sql.NVarChar, text)
      .query(`INSERT INTO dbo.Messages (SenderId, ReceiverId, PropertyId, Body)
              OUTPUT INSERTED.Id, INSERTED.Body, INSERTED.SenderId, INSERTED.SentAt
              VALUES (@s, @r, @p, @b)`);
    const row = r.recordset[0];
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
