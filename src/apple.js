// Apple Wallet: Karte (.pkpass) erzeugen, Update-Webservice-Logik und Push über APNs.
const http2 = require("http2");
const { PKPass } = require("passkit-generator");
const config = require("./config");
const images = require("./images");
const { db } = require("./db");

const A = config.apple;
const CAFE = config.cafe;

function cardTexts(c) {
  const req = CAFE.stampsRequired;
  const ready = c.stamps >= req;
  const missing = Math.max(req - c.stamps, 0);
  return {
    progress: `${Math.min(c.stamps, req)} / ${req}`,
    status: ready ? `🎉 ${CAFE.rewardText} wartet auf dich!` : `Noch ${missing} Stempel – dann gibt's ${CAFE.rewardText}`,
    ready,
  };
}

async function buildPass(c) {
  if (!A.enabled) throw new Error("Apple Wallet ist nicht konfiguriert");
  const t = cardTexts(c);
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: A.passTypeId,
    teamIdentifier: A.teamId,
    serialNumber: c.id,
    organizationName: CAFE.name,
    description: `${CAFE.name} Stempelkarte`,
    logoText: CAFE.name,
    backgroundColor: hexToRgb(CAFE.colors.background),
    foregroundColor: hexToRgb(CAFE.colors.text),
    labelColor: hexToRgb(CAFE.colors.label),
    sharingProhibited: true,
    storeCard: {
      headerFields: [{ key: "stamps", label: "STEMPEL", value: t.progress, changeMessage: "Neuer Stand: %@ ☕️" }],
      secondaryFields: [{ key: "status", label: t.ready ? "PRÄMIE" : "NÄCHSTE PRÄMIE", value: t.status }],
      auxiliaryFields: [{ key: "redeemed", label: "EINGELÖST", value: String(c.rewards_redeemed) }],
      backFields: [
        { key: "invite", label: "Freunde einladen", value: `Teile deinen Link – ihr bekommt beide einen Bonus-Stempel, sobald dein Freund das erste Mal da war:\n${config.baseUrl}/j?ref=${c.ref_code}`, attributedValue: `<a href="${config.baseUrl}/j?ref=${c.ref_code}">Einladungslink öffnen</a>` },
        { key: "card", label: "Deine Karte", value: `${config.baseUrl}/k/${c.id}`, attributedValue: `<a href="${config.baseUrl}/k/${c.id}">Karte im Browser ansehen</a>` },
        { key: "how", label: "So funktioniert's", value: `Zeig die Karte beim Bezahlen an der Theke. Pro Getränk gibt's einen Stempel. Bei ${CAFE.stampsRequired} Stempeln bekommst du ${CAFE.rewardText}.` },
        ...(CAFE.address ? [{ key: "address", label: "Adresse", value: CAFE.address }] : []),
        ...(CAFE.website ? [{ key: "web", label: "Website", value: CAFE.website }] : []),
        { key: "code", label: "Kartennummer", value: c.card_code },
      ],
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: c.card_code, messageEncoding: "iso-8859-1", altText: c.card_code }],
  };
  // Updates funktionieren nur über HTTPS (also erst, wenn der Server online ist)
  if (config.isHttps) {
    passJson.webServiceURL = `${config.baseUrl}/apple`;
    passJson.authenticationToken = c.auth_token;
  }

  const files = {
    "pass.json": Buffer.from(JSON.stringify(passJson)),
    "icon.png": await images.icon(29),
    "icon@2x.png": await images.icon(58),
    "icon@3x.png": await images.icon(87),
    "logo.png": await images.appleLogo(1),
    "logo@2x.png": await images.appleLogo(2),
    "logo@3x.png": await images.appleLogo(3),
    "strip.png": await images.appleStrip(c.stamps, 1),
    "strip@2x.png": await images.appleStrip(c.stamps, 2),
    "strip@3x.png": await images.appleStrip(c.stamps, 3),
  };
  const pass = new PKPass(files, {
    wwdr: A.wwdr,
    signerCert: A.signerCert,
    signerKey: A.signerKey,
    signerKeyPassphrase: A.signerKeyPassphrase,
  });
  return pass.getAsBuffer();
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// ---------- Push an alle Geräte, die diese Karte gespeichert haben ----------
let session = null;
function apns() {
  if (session && !session.closed && !session.destroyed) return session;
  session = http2.connect("https://api.push.apple.com:443", {
    cert: A.signerCert,
    key: A.signerKey,
    passphrase: A.signerKeyPassphrase,
  });
  session.on("error", (e) => { console.error("[APNs]", e.message); session = null; });
  session.setTimeout(5 * 60 * 1000, () => { session && session.close(); session = null; });
  return session;
}

function pushOne(token) {
  return new Promise((resolve) => {
    const req = apns().request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      "apns-topic": A.passTypeId,
      "content-type": "application/json",
    });
    let status = 0, body = "";
    req.on("response", (h) => { status = h[":status"]; });
    req.on("data", (d) => (body += d));
    req.on("end", () => resolve({ status, body }));
    req.on("error", (e) => resolve({ status: 0, body: e.message }));
    req.end("{}");
  });
}

async function notifyPassChanged(serial) {
  if (!A.enabled || !config.isHttps) return;
  const regs = db.prepare("SELECT device_id, push_token FROM apple_registrations WHERE serial = ?").all(serial);
  for (const r of regs) {
    const res = await pushOne(r.push_token);
    if (res.status === 410 || (res.status === 400 && res.body.includes("BadDeviceToken"))) {
      db.prepare("DELETE FROM apple_registrations WHERE device_id = ? AND serial = ?").run(r.device_id, serial);
    } else if (res.status !== 200) {
      console.warn(`[APNs] Push an Gerät fehlgeschlagen (${res.status}): ${res.body}`);
    }
  }
}

module.exports = { buildPass, notifyPassChanged, cardTexts };
