const dotenv = require("dotenv");
dotenv.config();

const { parseEnv } = require("./config/env");
const { createApp, WEBHOOK_PATH } = require("./app");
const { createBot } = require("./bot");
const { connectDB } = require("./db/connect");
const mongoose = require("mongoose");

// ── Process-level safety net ──────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  process.exit(1);
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  const env = parseEnv();

  await connectDB(env.MONGODB_URI);

  // Bot must be created before app so the webhook route can be registered
  const bot = createBot(env);
  const app = createApp(env, bot);

  const server = app.listen(env.PORT, () => {
    console.log(`[server] listening on http://localhost:${env.PORT}`);
  });

  if (env.TELEGRAM_WEBHOOK_URL) {
    // Production: Telegram pushes updates — every button tap wakes the server
    const webhookFull = `${env.TELEGRAM_WEBHOOK_URL}${WEBHOOK_PATH}`;
    await bot.telegram.setWebhook(webhookFull);
    console.log("[bot] webhook mode →", webhookFull);
  } else {
    // Development: pull updates via long polling
    bot.launch().catch((err) => {
      console.error("[bot] launch error:", err.message);
    });
    console.log("[bot] long polling mode");
  }

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  async function shutdown(signal) {
    console.log(`[server] ${signal} received — shutting down gracefully...`);

    if (env.TELEGRAM_WEBHOOK_URL) {
      await bot.telegram.deleteWebhook().catch((err) => {
        console.error("[bot] deleteWebhook error:", err.message);
      });
    } else {
      bot.stop(signal);
    }

    server.close(async () => {
      try {
        await mongoose.disconnect();
        console.log("[MongoDB] disconnected");
      } catch (err) {
        console.error("[MongoDB] disconnect error:", err.message);
      }
      process.exit(0);
    });

    // Force exit if connections don't close in 10s
    setTimeout(() => {
      console.error("[server] forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("[startup] failed:", err.message);
  process.exit(1);
});
