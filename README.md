# back-CV-react — Contact API for belevtsov.dev

Express backend that handles contact form submissions from [belevtsov.dev](https://belevtsov.dev).
On each submission it fires a **Telegram notification**, sends a **notification email** to the owner, and delivers a **confirmation email** to the sender.

**Frontend:** [CV-React](https://github.com/Belevtsov91/CV-React)

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js ≥ 20 |
| Framework | Express 5 |
| Validation | Zod |
| Security | Helmet, CORS, express-rate-limit |
| Telegram | Telegraf |
| Email | Nodemailer + Brevo SMTP |
| Database | MongoDB Atlas (Mongoose) |
| Geo lookup | geoip-lite (offline) |
| Logging | Morgan |
| API docs | Swagger UI (OpenAPI 3.0) |

---

## Features

- **Zod schema validation** — name, email, subject, message validated server-side with clear error messages
- **Honeypot bot protection** — `website` field present but silently accepted; bots that fill it get a fake `201` response
- **Two-layer rate limiting** — global (100 req / 15 min per IP) + per-route (10 msg / 10 min per IP)
- **Telegram notification** — formatted HTML message sent to owner's chat via bot
- **Dual email flow** — notification to owner + auto-confirmation to sender run in parallel; confirmation is fire-and-forget (won't fail the request if it errors)
- **MongoDB persistence** — every submission saved to Atlas with geo, source, and timestamps
- **Geo lookup** — offline IP → country/city via geoip-lite (no external API call)
- **Telegram bot** — interactive `/start` flow so anyone can message Vitalii directly via Telegram
- **Webhook / long-polling** — set `TELEGRAM_WEBHOOK_URL` for webhook mode (production), omit for long polling (dev)
- **Graceful shutdown** — SIGTERM/SIGINT handler closes HTTP server, stops bot, disconnects MongoDB cleanly
- **Swagger UI** — interactive API docs at `/api/docs`
- **Env validation at startup** — Zod parses all required env vars; server refuses to start if anything is missing

---

## API

### Health check
```
GET /api/health
→ 200 { status: "ok" | "degraded", db: "connected" | "disconnected" }
```

### Send contact message
```
POST /api/messages
Content-Type: application/json
```

Request body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Job Opportunity",
  "message": "I would like to discuss a frontend role."
}
```

Success:
```json
201 { "success": true, "data": { "receivedAt": "2025-03-17T12:00:00.000Z" } }
```

Error responses:

| Status | Reason |
|---|---|
| `400` | Validation failed (Zod) |
| `415` | Wrong Content-Type (not `application/json`) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
| `503` | DB save failed and all notifications failed |

**API docs (Swagger UI):** `GET /api/docs`
**OpenAPI JSON:** `GET /api/docs.json`

---

## Run locally

```bash
# 1. Clone and install
git clone https://github.com/Belevtsov91/back-CV-react.git
cd back-CV-react
npm install

# 2. Configure environment
cp .env.example .env
# Fill in Telegram and Brevo credentials (see Environment variables below)

# 3. Start dev server (nodemon)
npm run dev

# Production
npm start
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in the values.

| Variable | Description |
|---|---|
| `PORT` | Server port (default: `4000`) |
| `NODE_ENV` | `development` or `production` |
| `FRONTEND_ORIGIN` | Allowed CORS origin (e.g. `https://belevtsov.dev`) |
| `GLOBAL_RATE_LIMIT_WINDOW_MS` | Global rate limit window in ms (default: `900000` = 15 min) |
| `GLOBAL_RATE_LIMIT_MAX` | Max requests per window per IP (default: `100`) |
| `MESSAGE_RATE_LIMIT_WINDOW_MS` | Per-route rate limit window in ms (default: `86400000` = 24 h) |
| `MESSAGE_RATE_LIMIT_MAX` | Max messages per window per IP (default: `3`) |
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | Your personal chat ID to receive notifications |
| `BREVO_SMTP_USER` | Brevo SMTP login |
| `BREVO_SMTP_KEY` | Brevo SMTP API key |
| `NOTIFY_EMAIL` | Email address to receive notifications |
| `SMTP_FROM_EMAIL` | Sender address for outgoing emails |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `TELEGRAM_WEBHOOK_URL` | *(optional)* Public URL for Telegram webhook — omit to use long polling |

---

## Message flow

```
POST /api/messages
  → requireJson middleware (415 if wrong Content-Type)
  → messageLimiter (429 if rate limit exceeded)
  → validateBody(messageSchema) via Zod (400 if invalid)
  → honeypot check (website field) → silent 201 if bot
  → geo lookup (geoip-lite, offline)
  → save to MongoDB Atlas (non-blocking, logs error if fails)
  → Promise.allSettled([
      sendTelegramMessage → owner's Telegram chat,
      sendNotificationEmail → owner's inbox
    ])
  → if DB + both notifications failed → 503
  → sendConfirmationEmail → sender's inbox (fire-and-forget)
  → 201 { success: true, data: { receivedAt } }
```
