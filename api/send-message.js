// api/send-message.js
const twilio = require("twilio");
const { verifiedStore, rateStore } = require("./_shared_otp_store");

const RATE_LIMIT_PER_HOUR = parseInt(process.env.RATE_LIMIT_PER_HOUR || "20", 10);
function now(){ return Date.now(); }

function isVerified(number){
  const rec = verifiedStore.get(number);
  if(!rec) return false;
  if(now() > rec.verifiedUntil){ verifiedStore.delete(number); return false; }
  return true;
}

module.exports = async (req, res) => {
  if(req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { number, message, channel } = req.body || {};
  if(!number || !message) return res.status(400).json({ error: "Missing number or message" });

  // require verification
  if(!isVerified(number)){
    return res.status(403).json({ error: "Number not verified. Please verify via OTP first." });
  }

  // rate limiting per number (hour window)
  const windowMs = 60*60*1000;
  const r = rateStore.get(number) || { count: 0, windowStart: now() };
  if(now() - r.windowStart > windowMs){
    r.count = 0;
    r.windowStart = now();
  }
  if(r.count >= RATE_LIMIT_PER_HOUR){
    return res.status(429).json({ error: "Rate limit exceeded for this number (hourly)" });
  }
  r.count++;
  rateStore.set(number, r);

  // Twilio config
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM,
    TWILIO_WHATSAPP_FROM,
    DEFAULT_CHANNEL
  } = process.env;

  if(!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN){
    return res.status(500).json({ error: "Twilio not configured" });
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const bodyText = message;

  try {
    if((channel && channel.toLowerCase()==="whatsapp") || DEFAULT_CHANNEL === "whatsapp"){
      if(!TWILIO_WHATSAPP_FROM) return res.status(500).json({ error: "TWILIO_WHATSAPP_FROM not set" });
      const to = number.startsWith("whatsapp:") ? number : `whatsapp:${number}`;
      await client.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body: bodyText });
    } else {
      if(!TWILIO_SMS_FROM) return res.status(500).json({ error: "TWILIO_SMS_FROM not set" });
      await client.messages.create({ from: TWILIO_SMS_FROM, to: number, body: bodyText });
    }
    return res.status(200).json({ success: true, message: "Message sent" });
  } catch (err) {
    console.error("send-message error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Failed to send message" });
  }
};
