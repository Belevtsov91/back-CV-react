"use strict";

const request = require("supertest");

// ── Mock all side-effect dependencies ─────────────────────────────────────────
jest.mock("../models/Message", () => ({ create: jest.fn() }));
jest.mock("../utils/telegram", () => ({ sendTelegramMessage: jest.fn() }));
jest.mock("../utils/email", () => ({
  sendNotificationEmail: jest.fn(),
  sendConfirmationEmail: jest.fn(),
}));
jest.mock("../utils/geo", () => ({ getGeoFromIp: jest.fn() }));
jest.mock("mongoose", () => ({ connection: { readyState: 1 } }));

const { createApp } = require("../app");
const Message = require("../models/Message");
const { sendTelegramMessage } = require("../utils/telegram");
const { sendNotificationEmail, sendConfirmationEmail } = require("../utils/email");
const { getGeoFromIp } = require("../utils/geo");

// ── Test environment ───────────────────────────────────────────────────────────
const BASE_ENV = {
  NODE_ENV: "test",
  PORT: 4001,
  FRONTEND_ORIGIN: "http://localhost:5173",
  GLOBAL_RATE_LIMIT_WINDOW_MS: 900_000,
  GLOBAL_RATE_LIMIT_MAX: 1_000,
  MESSAGE_RATE_LIMIT_WINDOW_MS: 600_000,
  MESSAGE_RATE_LIMIT_MAX: 100,
  TELEGRAM_BOT_TOKEN: "test-token",
  TELEGRAM_CHAT_ID: "123456",
  BREVO_SMTP_KEY: "test-key",
  BREVO_SMTP_USER: "test-user",
  NOTIFY_EMAIL: "notify@test.com",
  SMTP_FROM_EMAIL: "from@test.com",
};

const VALID_BODY = {
  name: "John Doe",
  email: "john@example.com",
  subject: "Job Opportunity",
  message: "Hello, I would like to discuss a frontend role.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildApp(envOverrides = {}) {
  return createApp({ ...BASE_ENV, ...envOverrides });
}

function post(app, body, contentType = "application/json") {
  return request(app)
    .post("/api/messages")
    .set("Content-Type", contentType)
    .send(body);
}

// ── Suite ──────────────────────────────────────────────────────────────────────
describe("POST /api/messages", () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Message.create.mockResolvedValue({ _id: { toString: () => "test-id-123" } });
    sendTelegramMessage.mockResolvedValue({});
    sendNotificationEmail.mockResolvedValue({});
    sendConfirmationEmail.mockResolvedValue({});
    getGeoFromIp.mockReturnValue({ country: "RO", city: "Bucharest" });
  });

  // ── 201 happy path ──────────────────────────────────────────────────────────
  it("201 — returns receivedAt for valid payload", async () => {
    const res = await post(app, VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.receivedAt).toBe("string");
  });

  it("201 — calls Message.create, Telegram, and notification email", async () => {
    await post(app, VALID_BODY);

    expect(Message.create).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
  });

  // ── 415 wrong Content-Type ──────────────────────────────────────────────────
  it("415 — rejects text/plain", async () => {
    const res = await post(app, "hello", "text/plain");

    expect(res.status).toBe(415);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("415 — rejects form-urlencoded", async () => {
    const res = await request(app)
      .post("/api/messages")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("name=John&email=john@example.com");

    expect(res.status).toBe(415);
  });

  // ── 400 validation ──────────────────────────────────────────────────────────
  it("400 — missing required fields", async () => {
    const res = await post(app, { name: "John" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it("400 — invalid email", async () => {
    const res = await post(app, { ...VALID_BODY, email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d) => d.field === "email")).toBe(true);
  });

  it("400 — name too short", async () => {
    const res = await post(app, { ...VALID_BODY, name: "A" });

    expect(res.status).toBe(400);
  });

  it("400 — message too short", async () => {
    const res = await post(app, { ...VALID_BODY, message: "short" });

    expect(res.status).toBe(400);
  });

  // ── Honeypot ────────────────────────────────────────────────────────────────
  it("201 (honeypot) — silently accepts when website field is filled", async () => {
    const res = await post(app, { ...VALID_BODY, website: "http://spam-bot.com" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // No real processing should happen
    expect(Message.create).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  // ── 429 rate limit ──────────────────────────────────────────────────────────
  it("429 — returns rate limit error after exceeding per-route limit", async () => {
    const limitedApp = buildApp({ MESSAGE_RATE_LIMIT_MAX: 2 });

    await post(limitedApp, VALID_BODY);
    await post(limitedApp, VALID_BODY);
    const res = await post(limitedApp, VALID_BODY);

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("RATE_LIMIT");
  });

  // ── 503 total failure ───────────────────────────────────────────────────────
  it("503 — when DB save and all notifications fail", async () => {
    Message.create.mockRejectedValue(new Error("DB down"));
    sendTelegramMessage.mockRejectedValue(new Error("Telegram down"));
    sendNotificationEmail.mockRejectedValue(new Error("Email down"));

    const res = await post(app, VALID_BODY);

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  // ── Partial failures — still 201 if at least one channel worked ────────────
  it("201 — DB fails but Telegram succeeds", async () => {
    Message.create.mockRejectedValue(new Error("DB down"));

    const res = await post(app, VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("201 — DB fails but email succeeds", async () => {
    Message.create.mockRejectedValue(new Error("DB down"));
    sendTelegramMessage.mockRejectedValue(new Error("Telegram down"));

    const res = await post(app, VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("201 — DB saves but all notifications fail", async () => {
    sendTelegramMessage.mockRejectedValue(new Error("Telegram down"));
    sendNotificationEmail.mockRejectedValue(new Error("Email down"));

    const res = await post(app, VALID_BODY);

    // savedId is set (DB succeeded) so 503 condition is NOT met
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ── Health endpoint ────────────────────────────────────────────────────────────
describe("GET /api/health", () => {
  it("200 ok — db connected (readyState 1)", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.db).toBe("connected");
    expect(typeof res.body.data.uptime).toBe("number");
  });

  it("200 degraded — db disconnected (readyState 0)", async () => {
    // Override the mongoose mock for this test only
    const mongoose = require("mongoose");
    const original = mongoose.connection.readyState;
    mongoose.connection.readyState = 0;

    const app = buildApp();
    const res = await request(app).get("/api/health");

    mongoose.connection.readyState = original; // restore

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("degraded");
    expect(res.body.data.db).toBe("disconnected");
  });
});
