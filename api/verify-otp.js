// api/verify-otp.js
const { otpStore } = require("./_shared_otp_store");
const MAX_VERIFY_ATTEMPTS = parseInt(process.env.MAX_VERIFY_ATTEMPTS || "3", 10);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { number, otp } = req.body || {};
  if (!number || !otp) return res.status(400).json({ error: "Missing number or otp" });

  const rec = otpStore.get(number);
  if (!rec) return res.status(400).json({ ok: false, reason: "No OTP requested for this number" });

  if (Date.now() > rec.expiresAt) {
    otpStore.delete(number);
    return res.status(400).json({ ok: false, reason: "OTP expired" });
  }

  rec.tries = (rec.tries || 0) + 1;
  otpStore.set(number, rec);
  if (rec.tries > MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(number);
    return res.status(429).json({ ok: false, reason: "Too many verification attempts" });
  }

  if (String(rec.otp) !== String(otp).trim()) {
    return res.status(400).json({ ok: false, reason: "OTP mismatch" });
  }

  // success: consume OTP
  otpStore.delete(number);
  return res.status(200).json({ ok: true, message: "OTP valid" });
};
