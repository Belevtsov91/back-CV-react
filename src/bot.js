const { Telegraf, Markup } = require("telegraf");
const { sendNotificationEmail, sendConfirmationEmail } = require("./utils/email");
const Message = require("./models/Message");

const mainKeyboard = Markup.keyboard([
  ["✉️ Send Message", "ℹ️ About Vitalii"],
]).resize();

// In-memory state: chatId → { step, name, email, subject, lastActivity }
const sessions = new Map();

const SESSION_TIMEOUT_MS  = 60 * 60 * 1000;      // 1 hour
const BOT_RATE_LIMIT_MAX  = 3;
const BOT_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const SUBJECT_MAP = {
  subj_job:       "Job Opportunity",
  subj_freelance: "Freelance Project",
  subj_collab:    "Collaboration",
  subj_other:     "Other",
};

// ── Persistent rate-limit via MongoDB ─────────────────────────────────────────
async function isBotRateLimited(chatId) {
  try {
    const since = new Date(Date.now() - BOT_RATE_LIMIT_WINDOW_MS);
    const count = await Message.countDocuments({
      telegramChatId: String(chatId),
      source: "telegram",
      createdAt: { $gte: since },
    });
    return count >= BOT_RATE_LIMIT_MAX;
  } catch (err) {
    console.error("[bot] rate-limit DB check failed:", err.message);
    return false; // fail open — don't block user if DB is unreachable
  }
}

// ── Cleanup: remove abandoned sessions every hour ─────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [chatId, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      sessions.delete(chatId);
    }
  }
}, SESSION_TIMEOUT_MS).unref();

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function createBot(env) {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  // ── Global bot error handler ───────────────────────────────────────────────
  bot.catch((err, ctx) => {
    console.error(
      "[bot] unhandled error:",
      err.message,
      "| update_id:", ctx?.update?.update_id ?? "n/a"
    );
  });

  // ── /start ─────────────────────────────────────────────────────────────────
  bot.start((ctx) => {
    sessions.delete(ctx.chat.id);
    ctx.reply(
      `👋 Hi! I'm Vitalii Belevtsov's CV bot.\n\n` +
        `I'm a Junior Frontend / Full-Stack Developer based in Brasov, Romania.\n\n` +
        `What would you like to do?`,
      mainKeyboard
    ).catch((err) => console.error("[bot] start reply error:", err.message));
  });

  // ── About ──────────────────────────────────────────────────────────────────
  bot.hears("ℹ️ About Vitalii", (ctx) => {
    ctx.reply(
      `👤 <b>Vitalii Belevtsov</b>\n` +
        `💼 Junior Frontend / Full-Stack Developer\n` +
        `📍 Brasov, Romania\n\n` +
        `🛠 Stack: React, Node.js, Express, JS/TS\n` +
        `🌐 <a href="https://belevtsov.dev">belevtsov.dev</a>\n` +
        `📧 vitaliybelevcov@gmail.com`,
      { parse_mode: "HTML" }
    ).catch((err) => console.error("[bot] about reply error:", err.message));
  });

  // ── Send Message ───────────────────────────────────────────────────────────
  bot.hears("✉️ Send Message", async (ctx) => {
    try {
      if (await isBotRateLimited(ctx.chat.id)) {
        await ctx.reply("⏳ You've reached the daily message limit (3 per day). Please try again tomorrow.");
        return;
      }
      sessions.set(ctx.chat.id, { step: "waiting_name", lastActivity: Date.now() });
      await ctx.reply("What's your name?", Markup.removeKeyboard());
    } catch (err) {
      console.error("[bot] send message handler error:", err.message);
    }
  });

  // ── Subject inline buttons ─────────────────────────────────────────────────
  bot.action(Object.keys(SUBJECT_MAP), async (ctx) => {
    try {
      const session = sessions.get(ctx.chat.id);
      if (!session || session.step !== "waiting_subject") {
        await ctx.answerCbQuery();
        return;
      }
      session.subject = SUBJECT_MAP[ctx.callbackQuery.data];
      session.step = "waiting_message";
      await ctx.answerCbQuery(`"${session.subject}" selected`);
      await ctx.reply(
        `📌 Subject: <b>${esc(session.subject)}</b>\n\nYour message?`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error("[bot] subject action error:", err.message);
    }
  });

  // ── Conversation text handler ──────────────────────────────────────────────
  bot.on("text", async (ctx) => {
    try {
      const session = sessions.get(ctx.chat.id);
      if (!session) return;

      const text = ctx.message.text.trim().slice(0, 2000);
      session.lastActivity = Date.now();

      if (session.step === "waiting_name") {
        session.name = text;
        session.step = "waiting_email";
        await ctx.reply("Your email address?");

      } else if (session.step === "waiting_email") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
          await ctx.reply("That doesn't look like a valid email. Try again:");
          return;
        }
        session.email = text;
        session.step = "waiting_subject";
        await ctx.reply(
          "What's the purpose of your message?",
          Markup.inlineKeyboard([
            [Markup.button.callback("💼 Job Opportunity",   "subj_job")],
            [Markup.button.callback("💻 Freelance Project", "subj_freelance")],
            [Markup.button.callback("🤝 Collaboration",     "subj_collab")],
            [Markup.button.callback("💬 Other",             "subj_other")],
          ])
        );

      } else if (session.step === "waiting_message") {
        session.message = text;
        sessions.delete(ctx.chat.id);

        const { name, email, subject, message } = session;
        const dateStr = new Date().toLocaleString("en-GB", { timeZone: "Europe/Bucharest" }) + " (Bucharest)";
        const tgUsername = ctx.from?.username ? `@${ctx.from.username}` : "no username";

        // ── Save to MongoDB ──────────────────────────────────────────────────
        let savedId = null;
        try {
          const saved = await Message.create({
            name, email, subject, message,
            source: "telegram",
            ip: "",
            geo: {},
            telegramChatId: String(ctx.chat.id),
            telegramUsername: ctx.from?.username || "",
          });
          savedId = saved._id.toString();
        } catch (dbErr) {
          console.error("[db] bot save failed:", dbErr.message);
        }

        // ── Notify owner via Telegram ────────────────────────────────────────
        const tgText =
          `📬 <b>New message from bot</b>\n\n` +
          `👤 <b>Name:</b> ${esc(name)}\n` +
          `✉️ <b>Email:</b> ${esc(email)}\n` +
          `📌 <b>Subject:</b> ${esc(subject)}\n\n` +
          `💬 <b>Message:</b>\n${esc(message)}\n\n` +
          `─────────────────────\n` +
          `🌍 via Telegram Bot\n` +
          `👾 TG: ${esc(tgUsername)}\n` +
          `🕐 ${dateStr}\n` +
          (savedId
            ? `🆔 DB: <code>${savedId}</code>`
            : `⚠️ DB: not saved`);

        bot.telegram
          .sendMessage(env.TELEGRAM_CHAT_ID, tgText, { parse_mode: "HTML" })
          .catch((err) => console.error("[telegram] owner notify failed:", err.message));

        // ── Notification email ───────────────────────────────────────────────
        sendNotificationEmail({
          smtpUser: env.BREVO_SMTP_USER,
          smtpKey: env.BREVO_SMTP_KEY,
          fromEmail: env.SMTP_FROM_EMAIL,
          toEmail: env.NOTIFY_EMAIL,
          name, email, subject, message,
          source: "Telegram bot",
        }).catch((err) => console.error("[email] notification failed:", err.message));

        // ── Confirmation email ───────────────────────────────────────────────
        sendConfirmationEmail({
          smtpUser: env.BREVO_SMTP_USER,
          smtpKey: env.BREVO_SMTP_KEY,
          fromEmail: env.SMTP_FROM_EMAIL,
          toEmail: email,
          name, subject, message,
        }).catch((err) => console.error("[email] confirmation failed:", err.message));

        await ctx.reply("✅ Thanks! Vitalii will get back to you soon.", mainKeyboard);
      }
    } catch (err) {
      console.error("[bot] text handler error:", err.message);
      ctx.reply("⚠️ Something went wrong. Please try again or use /start.")
        .catch(() => {});
    }
  });

  return bot;
}

module.exports = { createBot };
