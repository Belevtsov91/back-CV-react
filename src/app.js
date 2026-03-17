const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const swaggerUi = require("swagger-ui-express");
const { createHealthRouter } = require("./routes/health.routes");
const { createMessageRouter } = require("./routes/messages.routes");
const { notFoundHandler } = require("./middlewares/notFoundHandler");
const { errorHandler } = require("./middlewares/errorHandler");
const { openApiSpec } = require("./docs/openapi");

// ── Helmet CSP for Swagger UI (needs unsafe-inline for its own scripts/styles) ─
const docsCspDirectives = {
  ...helmet.contentSecurityPolicy.getDefaultDirectives(),
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src":  ["'self'", "'unsafe-inline'", "https:"],
};

// ── Strict CSP for all other routes ──────────────────────────────────────────
const appCspDirectives = {
  defaultSrc:              ["'self'"],
  scriptSrc:               ["'self'"],
  styleSrc:                ["'self'", "'unsafe-inline'"],
  imgSrc:                  ["'self'", "data:"],
  connectSrc:              ["'self'"],
  fontSrc:                 ["'self'"],
  objectSrc:               ["'none'"],
  frameSrc:                ["'none'"],
  frameAncestors:          ["'none'"],
  upgradeInsecureRequests: [],
};

const WEBHOOK_PATH = "/api/telegram";

// ── Reusable rate-limit error shape ──────────────────────────────────────────
function rateLimitMessage(msg) {
  return { success: false, error: { message: msg, code: "RATE_LIMIT" } };
}

function createApp(env, bot = null) {
  const app = express();

  app.disable("x-powered-by");

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: { directives: appCspDirectives },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy:   { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      referrerPolicy:            { policy: "strict-origin-when-cross-origin" },
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    })
  );

  // ── CORS ────────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      methods: ["GET", "POST"],
      optionsSuccessStatus: 204,
    })
  );

  // ── Global rate limit ───────────────────────────────────────────────────────
  app.use(
    rateLimit({
      windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
      max: env.GLOBAL_RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: rateLimitMessage("Too many requests. Please try again later."),
    })
  );

  // ── Stricter rate limit on health (prevent info-leak abuse) ────────────────
  const healthLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage("Too many requests. Please try again later."),
  });

  // ── Body parsing ────────────────────────────────────────────────────────────
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: false, limit: "10kb" }));

  // ── NoSQL injection prevention ──────────────────────────────────────────────
  // express-mongo-sanitize middleware tries to write req.query which is a
  // read-only getter in Express 5 — apply sanitize() manually to req.body only.
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = mongoSanitize.sanitize(req.body);
    }
    next();
  });

  // ── HTTP Parameter Pollution prevention ────────────────────────────────────
  // Collapses duplicate query params: ?name=a&name=b → name = "b"
  app.use(hpp());

  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/api/docs.json", (req, res) => {
    res.status(200).json(openApiSpec);
  });

  app.use("/api/docs", helmet.contentSecurityPolicy({ directives: docsCspDirectives }));
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      explorer: true,
      customSiteTitle: "CV React API Docs",
    })
  );

  app.use("/api", healthLimiter, createHealthRouter(env));
  app.use("/api", createMessageRouter(env));

  // Telegram webhook endpoint — registered only when bot + webhook URL are provided
  if (bot && env.TELEGRAM_WEBHOOK_URL) {
    app.use(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));
    console.log("[bot] webhook endpoint registered:", WEBHOOK_PATH);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, WEBHOOK_PATH };
