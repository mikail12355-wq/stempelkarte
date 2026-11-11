// Zentrale Konfiguration – alles kommt aus Umgebungsvariablen (.env oder Railway "Variables").
require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function readSecret(envB64, file) {
  // Zertifikate/Schlüssel entweder als Base64-Variable (für Railway) oder als Datei im Ordner certs/
  if (process.env[envB64]) return Buffer.from(process.env[envB64], "base64");
  const p = path.join(ROOT, "certs", file);
  if (fs.existsSync(p)) return fs.readFileSync(p);
  return null;
}

const baseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");

const config = {
  port: Number(process.env.PORT || 3000),
  baseUrl,
  isHttps: baseUrl.startsWith("https://"),
  dataDir: process.env.DATA_DIR || path.join(ROOT, "data"),
  sessionSecret: process.env.SESSION_SECRET || "bitte-in-env-aendern",
  staffPin: process.env.STAFF_PIN || "",

  cafe: {
    name: process.env.CAFE_NAME || "Mein Café",
    address: process.env.CAFE_ADDRESS || "",
    website: process.env.CAFE_WEBSITE || "",
    privacyUrl: process.env.PRIVACY_URL || "",
    stampsRequired: Number(process.env.STAMPS_REQUIRED || 10),
    rewardText: process.env.REWARD_TEXT || "1 Gratis-Kaffee",
    referralBonus: Number(process.env.REFERRAL_BONUS || 1),
    referralMaxPerCustomer: Number(process.env.REFERRAL_MAX_PER_CUSTOMER || 10),
    colors: {
      background: process.env.COLOR_BACKGROUND || "#4a2c1f",
      text: process.env.COLOR_TEXT || "#ffffff",
      label: process.env.COLOR_LABEL || "#f3d9b1",
      stamp: process.env.COLOR_STAMP || "#f3d9b1",
    },
  },

  apple: {
    passTypeId: process.env.APPLE_PASS_TYPE_ID || "",
    teamId: process.env.APPLE_TEAM_ID || "",
    signerCert: readSecret("APPLE_SIGNER_CERT_B64", "signerCert.pem"),
    signerKey: readSecret("APPLE_SIGNER_KEY_B64", "signerKey.pem"),
    signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE || undefined,
    wwdr: readSecret("APPLE_WWDR_B64", "wwdr.pem"),
  },

  google: {
    issuerId: process.env.GOOGLE_ISSUER_ID || "",
    classSuffix: process.env.GOOGLE_CLASS_SUFFIX || "stempelkarte_v1",
    serviceAccount: (() => {
      const raw = readSecret("GOOGLE_SERVICE_ACCOUNT_B64", "google-service-account.json");
      try { return raw ? JSON.parse(raw.toString("utf8")) : null; } catch { return null; }
    })(),
  },
};

// Prüfen, ob in jeder Variable das Richtige steckt (häufiger Fehler: Werte vertauscht)
config.apple.problems = [];
const pemHas = (buf, marker) => buf && buf.toString("utf8").includes(marker);
if (!config.apple.passTypeId) config.apple.problems.push("APPLE_PASS_TYPE_ID fehlt");
if (!config.apple.teamId) config.apple.problems.push("APPLE_TEAM_ID fehlt");
if (!config.apple.signerCert) config.apple.problems.push("APPLE_SIGNER_CERT_B64 fehlt");
else if (!pemHas(config.apple.signerCert, "BEGIN CERTIFICATE")) config.apple.problems.push("APPLE_SIGNER_CERT_B64 enthält kein Zertifikat (Werte vertauscht?)");
if (!config.apple.signerKey) config.apple.problems.push("APPLE_SIGNER_KEY_B64 fehlt");
else if (!pemHas(config.apple.signerKey, "PRIVATE KEY")) config.apple.problems.push("APPLE_SIGNER_KEY_B64 enthält keinen privaten Schlüssel (Werte vertauscht?)");
if (!config.apple.wwdr) config.apple.problems.push("APPLE_WWDR_B64 fehlt");
else if (!pemHas(config.apple.wwdr, "BEGIN CERTIFICATE")) config.apple.problems.push("APPLE_WWDR_B64 enthält kein Zertifikat (Werte vertauscht?)");
config.apple.enabled = config.apple.problems.length === 0;
config.google.enabled = Boolean(config.google.issuerId && config.google.serviceAccount);

module.exports = config;
