const https = require("https");

function sendTelegramMessage(botToken, chatId, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    });

    const options = {
      hostname: "api.telegram.org",
      path: `/bot${botToken}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok) {
            reject(new Error(`Telegram API error: ${parsed.description}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error("Failed to parse Telegram response"));
        }
      });
    });

    req.setTimeout(5_000, () => {
      req.destroy(new Error("Telegram request timed out"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sendTelegramMessage };
