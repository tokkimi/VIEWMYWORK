import crypto from "crypto";

function key() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!secret) throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}

export function decrypt(payload) {
  const [ivText, tagText, dataText] = payload.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}
