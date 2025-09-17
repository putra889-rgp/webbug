// api/_shared_otp_store.js
// In-memory stores for testing. Serverless ephemeral (use Redis in production).

const otpStore = new Map();      // number -> { otp, expiresAt, tries }
const rateStore = new Map();     // number -> { count, windowStart }
const verifiedStore = new Map(); // number -> { verifiedUntil }

module.exports = { otpStore, rateStore, verifiedStore };
