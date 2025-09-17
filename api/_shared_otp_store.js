// api/_shared_otp_store.js
// Simple in-memory store for OTPs and rate limiting.
// WARNING: ephemeral. Serverless cold starts will reset Map().
// For production use Redis or other persistent store.

const otpStore = new Map(); // number -> { otp, expiresAt, tries }
const rateStore = new Map(); // number -> { count, windowStart }

module.exports = { otpStore, rateStore };
