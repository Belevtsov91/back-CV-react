let geoip;
try {
  geoip = require("geoip-lite");
} catch {
  geoip = null;
  console.warn("[geo] geoip-lite not available — location lookup disabled");
}

function getGeoFromIp(ip) {
  if (!geoip || !ip) return {};
  try {
    const clean = ip.replace(/^::ffff:/, "").trim();
    if (clean === "127.0.0.1" || clean === "::1" || clean === "localhost") {
      return { country: "DEV", city: "localhost", region: "", timezone: "UTC" };
    }
    const geo = geoip.lookup(clean);
    if (!geo) return {};
    return {
      country:  geo.country  || "",
      city:     geo.city     || "",
      region:   geo.region   || "",
      timezone: geo.timezone || "",
    };
  } catch (err) {
    console.warn("[geo] lookup error:", err.message);
    return {};
  }
}

module.exports = { getGeoFromIp };
