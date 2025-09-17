// api/send-otp.js
const twilio = require("twilio");
const { otpStore, rateStore } = require("./_shared_otp_store");

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || "6", 10);
const OTP_TTL_MS = parseInt(process.env.OTP_TTL_SECONDS || "300", 10) * 1000;
const RATE_LIMIT_PER_HOUR = parseInt(process.env.RATE_LIMIT_PER_HOUR || "5", 10);

function now() { return Date.now(); }
function genOTP(len = OTP_LENGTH) {
  const min = Math.pow(10, len - 1);
  const num = Math.floor(min + Math.random() * 9 * min);
  return String(num).slice(0, len);
}

function isAllowedNumber(number) {
  const env = process.env.ALLOWED_NUMBERS || "";
  if (!env) return true;
  const arr = env.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.includes(number);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { number, channel } = req.body || {};
  if (!number) return res.status(400).json({ error: "Missing number" });

  if (!isAllowedNumber(number)) {
    return res.status(403).json({ error: "Number not allowed for testing" });
  }

  // rate limiting
  const windowMs = 60 * 60 * 1000;
  const r = rateStore.get(number) || { count: 0, windowStart: now() };
  if (now() - r.windowStart > windowMs) {
    r.count = 0;
    r.windowStart = now();
  }
  if (r.count >= RATE_LIMIT_PER_HOUR) {
    return res.status(429).json({ error: "Rate limit exceeded for this number (hourly)" });
  }
  r.count++;
  rateStore.set(number, r);

  // generate OTP
  const otp = genOTP();
  otpStore.set(number, { otp, expiresAt: now() + OTP_TTL_MS, tries: 0 });

  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM,
    TWILIO_WHATSAPP_FROM,
    DEFAULT_CHANNEL
  } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return res.status(500).json({ error: "Twilio not configured" });
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const bodyText = `Kode verifikasi Anda: ${otp}\nBerlaku ${Math.round(OTP_TTL_MS/60000)} menit. Jika tidak meminta, abaikan.`;

  try {
    if ((channel && channel.toLowerCase() === "whatsapp") || DEFAULT_CHANNEL === "whatsapp") {
      if (!TWILIO_WHATSAPP_FROM) return res.status(500).json({ error: "TWILIO_WHATSAPP_FROM not set" });
      const to = number.startsWith("whatsapp:") ? number : `whatsapp:${number}`;
      await client.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body: bodyText });
    } else {
      if (!TWILIO_SMS_FROM) return res.status(500).json({ error: "TWILIO_SMS_FROM not set" });
      await client.messages.create({ from: TWILIO_SMS_FROM, to: number, body: bodyText });
    }
    return res.status(200).json({ success: true, message: "OTP dikirim" });
  } catch (err) {
    console.error("send-otp error:", err && err.message ? err.message : err);
    otpStore.delete(number);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
};
