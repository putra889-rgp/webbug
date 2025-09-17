// api/status.js
module.exports = async (req, res) => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM } = process.env;
  const ready = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_SMS_FROM || TWILIO_WHATSAPP_FROM));
  return res.status(200).json({ connected: ready });
};
