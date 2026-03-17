const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { validateBody } = require("../middlewares/validateBody");
const { requireJson } = require("../middlewares/requireJson");
const { sendTelegramMessage } = require("../utils/telegram");
const { sendNotificationEmail, sendConfirmationEmail } = require("../utils/email");
const { getGeoFromIp } = require("../utils/geo");
const Message = require("../models/Message");

const messageSchema = z.object({
  name:    z.string().trim().min(2).max(100),
  email:   z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(100),
  message: z.string().trim().min(10).max(2000),
  website: z.string().optional(),
});

// Escape HTML special chars for Telegram HTML mode
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildTelegramText({ name, email, subject, message, geoStr, dateStr, savedId }) {
  return (
    `📬 <b>New message from CV</b>\n\n` +
    `👤 <b>Name:</b> ${esc(name)}\n` +
    `✉️ <b>Email:</b> ${esc(email)}\n` +
    `📌 <b>Subject:</b> ${esc(subject)}\n\n` +
    `💬 <b>Message:</b>\n${esc(message)}\n\n` +
    `─────────────────────\n` +
    `🌍 ${geoStr}\n` +
    `🕐 ${dateStr}\n` +
    (savedId
      ? `🆔 DB: <code>${savedId}</code>`
      : `⚠️ DB: not saved`)
  );
}

function createMessageRouter(env) {
  const router = Router();

  const messageLimiter = rateLimit({
    windowMs: env.MESSAGE_RATE_LIMIT_WINDOW_MS,
    max: env.MESSAGE_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        message: "Too many requests from this IP. Please try again later.",
        code: "RATE_LIMIT",
      },
    },
  });

  router.post(
    "/messages",
    requireJson,
    messageLimiter,
    validateBody(messageSchema),
    async (req, res, next) => {
      try {
        const { name, email, subject, message, website } = req.body;

        // Honeypot — silent accept for bots
        if (website) {
          return res.status(201).json({ success: true, data: { receivedAt: new Date().toISOString() } });
        }

        // ── Geo lookup ──────────────────────────────────────────────────────
        const ip = (
          req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
          req.ip ||
          ""
        );
        const geo = getGeoFromIp(ip);
        const geoStr = [geo.city, geo.country].filter(Boolean).join(", ") || "Unknown location";
        const dateStr = new Date().toLocaleString("en-GB", { timeZone: "Europe/Bucharest" }) + " (Bucharest)";

        // ── Save to MongoDB ─────────────────────────────────────────────────
        let savedId = null;
        try {
          const saved = await Message.create({ name, email, subject, message, source: "web", ip, geo });
          savedId = saved._id.toString();
        } catch (dbErr) {
          console.error("[db] save failed:", dbErr.message);
        }

        // ── Telegram + notification email (concurrent, non-blocking) ────────
        const text = buildTelegramText({ name, email, subject, message, geoStr, dateStr, savedId });

        const [tgResult, emailResult] = await Promise.allSettled([
          sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, text),
          sendNotificationEmail({
            apiKey: env.BREVO_API_KEY,
            fromEmail: env.SMTP_FROM_EMAIL,
            toEmail: env.NOTIFY_EMAIL,
            name, email, subject, message,
            source: "CV website form",
          }),
        ]);

        if (tgResult.status === "rejected") {
          console.error("[telegram] notification failed:", tgResult.reason?.message);
        }
        if (emailResult.status === "rejected") {
          console.error("[email] notification failed:", emailResult.reason?.message);
        }

        // If DB save failed AND both notifications failed — nothing was delivered
        if (!savedId && tgResult.status === "rejected" && emailResult.status === "rejected") {
          const err = new Error("Message could not be delivered. Please try again later.");
          err.statusCode = 503;
          return next(err);
        }

        // ── Confirmation email — fire-and-forget ────────────────────────────
        sendConfirmationEmail({
          apiKey: env.BREVO_API_KEY,
          fromEmail: env.SMTP_FROM_EMAIL,
          toEmail: email,
          name, subject, message,
        }).catch((err) => {
          console.error("[email] confirmation failed:", err.message);
        });

        return res.status(201).json({
          success: true,
          data: { receivedAt: new Date().toISOString() },
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  return router;
}

module.exports = { createMessageRouter };
