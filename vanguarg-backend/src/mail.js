import nodemailer from "nodemailer";
import { getPool } from "./db.js";
import { isChatOpen } from "./presence.js";

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

function mailbox() {
  return addressOnly(process.env.SMTP_USER || ADMIN);
}

function deliverableAddress(to) {
  const target = addressOnly(to);
  const ours = mailbox();
  if (!target || target !== ours) return target;
  const at = ours.indexOf("@");
  if (at <= 0) return target;
  return `${ours.slice(0, at)}+chat${ours.slice(at)}`;
}

function siteInbox() {
  const origin = String(process.env.PUBLIC_SITE_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${origin}/posteingang`;
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
  if (isChatOpen(receiverId)) {
    console.log("Email i chatit u kapërcye: marrësi e ka dritaren e chatit hapur.");
    return;
  }

  const people = await getPool().query(
    `SELECT id AS "Id", full_name AS "FullName", email AS "Email", role AS "Role"
     FROM users WHERE id = $1 OR id = $2`,
    [senderId, receiverId]
  );
  const sender = people.rows.find((row) => Number(row.Id) === Number(senderId));
  const receiver = people.rows.find((row) => Number(row.Id) === Number(receiverId));
  const who = (sender?.FullName && String(sender.FullName).trim())
    || (sender?.Email && String(sender.Email).trim())
    || "Dikush";
  const preview = String(body || "").trim().slice(0, 500);
  const link = siteInbox();
  const receiverMail = String(receiver?.Email || "").trim();
  const adminMail = String(process.env.SMTP_ADMIN || ADMIN).trim();
  const toReceiver = staff || receiver?.Role === "client";
  const to = toReceiver ? receiverMail : (receiverMail || adminMail);
  if (!to.includes("@")) {
    console.warn("Email i chatit u kapërcye: marrësi nuk ka adresë.");
    return;
  }

  const copy = toReceiver
    ? {
        subject: "Vanguard hat geantwortet",
        kicker: "Chat",
        title: `${who} hat dir geschrieben`,
        lead: "Du hast eine neue Nachricht erhalten.",
        button: "Chat öffnen",
      }
    : {
        subject: "Dikush të ka shkruar në Vanguard",
        kicker: "Inbox",
        title: `${who} të ka shkruar`,
        lead: "Ke një mesazh të ri.",
        button: "Hap inbox",
      };

  const from = process.env.SMTP_FROM || `Vanguard <${mailbox()}>`;
  await transport().sendMail({
    from,
    to: deliverableAddress(to),
    envelope: { from: mailbox(), to: deliverableAddress(to) },
    replyTo: addressOnly(sender?.Email).includes("@") ? sender.Email : undefined,
    subject: copy.subject,
    text: `${copy.title}\n\n${copy.lead}\n\n${preview}\n\n${copy.button}: ${link}`,
    html: emailHtml({ ...copy, preview, link }),
  });
  console.log(`Email i chatit u dërgua nga ${mailbox()}.`);
}