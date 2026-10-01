// Vercel normally supplies raw values. Trim accidental whitespace and one pair
// of wrapping quotes so a pasted secret cannot create an invalid HTTP header.
function secret(name: string) {
  return (process.env[name] || "").trim().replace(/^["']|["']$/g, "");
}

// Centralised, typed access to configuration. Integrations are optional:
// when credentials are missing, features show a configuration state instead of faking success.
export const env = {
  appUrl: (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, ""),
  encryptionKey: secret("ENCRYPTION_KEY"),
  cronSecret: secret("CRON_SECRET"),
  isProd: process.env.NODE_ENV === "production",
  email: {
    resendKey: secret("RESEND_API_KEY"),
    from: process.env.EMAIL_FROM || "FollowMyFuture <notifications@followmyfuture.com>",
  },
  stripe: {
    secretKey: secret("STRIPE_SECRET_KEY"),
    platformWebhookSecret: secret("STRIPE_PLATFORM_WEBHOOK_SECRET"),
    connectWebhookSecret: secret("STRIPE_CONNECT_WEBHOOK_SECRET"),
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || "",
    region: process.env.S3_REGION || "auto",
    bucket: process.env.S3_BUCKET || "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  },
};

export const integrations = {
  email: () => Boolean(env.email.resendKey),
  stripe: () => Boolean(env.stripe.secretKey),
  s3: () => Boolean(env.s3.bucket && env.s3.accessKeyId && env.s3.secretAccessKey),
  /** Vercel Blob (private store), configured by connecting a Blob store to the Vercel project. */
  blob: () => Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  // Always available: without S3 or Blob, files are kept in the database (smaller size limit).
  storage: () => true,
  googleDrive: () => Boolean(env.google.clientId && env.google.clientSecret),
};
