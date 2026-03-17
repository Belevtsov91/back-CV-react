const { Schema, model } = require("mongoose");

const geoSchema = new Schema(
  {
    country:  { type: String, default: "" },
    city:     { type: String, default: "" },
    region:   { type: String, default: "" },
    timezone: { type: String, default: "" },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    name:             { type: String, required: true, trim: true },
    email:            { type: String, required: true, trim: true, lowercase: true },
    subject:          { type: String, required: true, trim: true },
    message:          { type: String, required: true, trim: true },
    source:           { type: String, enum: ["web", "telegram"], default: "web" },
    ip:               { type: String, default: "" },
    geo:              { type: geoSchema, default: () => ({}) },
    telegramChatId:   { type: String, default: "" },
    telegramUsername: { type: String, default: "" },
  },
  { timestamps: true }
);

messageSchema.index({ email: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = model("Message", messageSchema);
