const { Router } = require("express");
const mongoose = require("mongoose");

function createHealthRouter(env) {
  const router = Router();

  router.get("/health", (req, res) => {
    const dbReady = mongoose.connection.readyState === 1;
    const status = dbReady ? "ok" : "degraded";
    res.status(200).json({
      success: true,
      data: {
        status,
        db: dbReady ? "connected" : "disconnected",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
      },
    });
  });

  return router;
}

module.exports = { createHealthRouter };
