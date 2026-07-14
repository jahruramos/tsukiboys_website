const crypto = require("crypto");

const TRASH_PASSWORD = "gang2026";

module.exports = (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const password = (req.body && req.body.password) || "";

  if (password === TRASH_PASSWORD) {
    const token = crypto.randomBytes(24).toString("hex");
    res.setHeader("Set-Cookie", `session=${token}; Path=/; SameSite=Lax`);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false });
};
