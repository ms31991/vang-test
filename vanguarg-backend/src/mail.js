import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { ImapFlow } from "imapflow";
import sql from "mssql/msnodesqlv8.js";
import { getPool } from "./db.js";
import { alreadyMailedWhileAway, clearMailedWhileAway, isChatOpen, markMailedWhileAway } from "./presence.js";

const ADMIN = "mehmetalishabani04@gmail.com";

function configured() {
  return Boolean(String(process.env.SMTP_PASS || "").trim());
}

function transport() {
  const user = process.env.SMTP_USER || ADMIN;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user, pass: process.env.SMTP_PASS },
  });
}

function addressOnly(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

async function deliverToOwnInbox(message) {
  const user = process.env.SMTP_USER || ADMIN;
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass: process.env.SMTP_PASS },
    logger: false,
  });
  await client.connect();
  try {
    const raw = await new MailComposer(message).compile().build();
    await client.append("INBOX", raw, []);
  } finally {
    await client.logout();
  }
}

function siteInbox() {
  const origin = String(process.env.PUBLIC_SITE_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${origin}/inbox`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailHtml({ kicker, title, lead, preview, button, link }) {
  const safePreview = escapeHtml(preview).replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background:#f6f4f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4f0;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #e4dfd6;">
          <tr>
            <td style="background:#101c16;padding:26px 28px 22px;">
              <p style="margin:0;font-family:Georgia,serif;font-size:22px;letter-spacing:-0.03em;color:#f4f1ea;">Vanguard</p>
              <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#f4b942;">${escapeHtml(kicker)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;line-height:1.15;letter-spacing:-0.03em;color:#14221c;">${escapeHtml(title)}</h1>
              <p style="margin:14px 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#5c6b63;">${escapeHtml(lead)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                <tr>
                  <td style="background:#f6f4f0;border-radius:16px;padding:16px 18px;font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#14221c;">${safePreview}</td>
                </tr>
              </table>
              <p style="margin:22px 0 0;">
                <a href="${escapeHtml(link)}" style="display:inline-block;background:#1f6b4a;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:12px 18px;border-radius:999px;">${escapeHtml(button)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function notifyChatMessage({ senderId, receiverId, staff, body }) {
  if (!configured()) {
    console.warn("Email i chatit u kapërcye: SMTP_PASS mungon në .env.");
    return;
  }
  if (isChatOpen(receiverId) || alreadyMailedWhileAway(receiverId)) return;
  markMailedWhileAway(receiverId);

  const people = await getPool().request()
    .input("s", sql.Int, senderId)
    .input("r", sql.Int, receiverId)
    .query("SELECT Id, FullName, Email FROM dbo.Users WHERE Id = @s OR Id = @r");
  const sender = people.recordset.find((row) => row.Id === senderId);
  const receiver = people.recordset.find((row) => row.Id === receiverId);
  const who = (sender?.FullName && String(sender.FullName).trim())
    || (sender?.Email && String(sender.Email).trim())
    || "Dikush";
  const preview = String(body || "").trim().slice(0, 500);
  const link = siteInbox();
  const to = staff
    ? String(receiver?.Email || "").trim()
    : (process.env.SMTP_ADMIN || ADMIN);
  if (!to.includes("@")) {
    clearMailedWhileAway(receiverId);
    console.warn("Email i chatit u kapërcye: marrësi nuk ka adresë.");
    return;
  }

  const copy = staff
    ? {
        subject: "Vanguard hat geantwortet",
        kicker: "Chat",
        title: "Der Inhaber hat geantwortet",
        lead: "Du hast eine Antwort erhalten, während der Chat geschlossen war.",
        button: "Chat öffnen",
      }
    : {
        subject: "Dikush të ka shkruar në Vanguard",
        kicker: "Inbox",
        title: "Dikush të ka shkruar",
        lead: `${who} të dërgoi një mesazh ndërsa inbox ishte i mbyllur.`,
        button: "Hap inbox",
      };

  const message = {
    from: process.env.SMTP_FROM || `Vanguard <${process.env.SMTP_USER || ADMIN}>`,
    to,
    replyTo: sender?.Email || undefined,
    subject: copy.subject,
    text: `${copy.title}\n\n${copy.lead}\n\n${preview}\n\n${copy.button}: ${link}`,
    html: emailHtml({ ...copy, preview, link }),
  };
  const ownInbox = addressOnly(to) === addressOnly(process.env.SMTP_USER || ADMIN);
  const send = ownInbox ? deliverToOwnInbox(message) : transport().sendMail(message);
  await send.catch((err) => {
    clearMailedWhileAway(receiverId);
    throw err;
  });
}
