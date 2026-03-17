const mongoose = require("mongoose");

async function connectDB(uri) {
  mongoose.connection.on("error", (err) => {
    console.error("[MongoDB] connection error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[MongoDB] reconnected");
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  });

  console.log("[MongoDB] connected:", mongoose.connection.host);
}

module.exports = { connectDB };
