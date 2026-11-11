const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const QRCode = require("qrcode");
const config = require("./config");
const { db, q, createCustomer } = require("./db");
const apple = require("./apple");
const google = require("./google");
const images = require("./images");
const stamps = require("./stamps");
const views = require("./views");

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser(config.sessionSecret));

const CAFE = config.cafe;
const YEAR = 365 * 864e5;

// ---------------------------------------------------------------- Bilder
app.get("/img/hero/:n.png", async (req, res) => {
  const n = Math.max(0, Math.min(Number(req.params.n) || 0, CAFE.stampsRequired));
  res.type("png").set("Cache-Control", "public, max-age=86400").send(await images.googleHero(n));
});
app.get("/img/icon-:size.png", async (req, res) => {
  const size = [180, 660].includes(Number(req.params.size)) ? Number(req.params.size) : 180;
  res.type("png").set("Cache-Control", "public, max-age=86400").send(await images.icon(size));
});

// ---------------------------------------------------------------- Gäste
app.get("/", (req, res) => res.redirect("/j"));

app.get("/j", (req, res) => {
  const ref = req.query.ref ? q.byRefCode.get(String(req.query.ref).toUpperCase()) : null;
  const existing = req.signedCookies.kid && q.byId.get(req.signedCookies.kid) ? req.signedCookies.kid : null;
  res.send(views.joinPage({ referrer: ref ? ref.ref_code : null, existing }));
});

app.post("/j", async (req, res, next) => {
  try {
    const platform = req.body.platform === "google" ? "google" : "apple";
    // Wer schon eine Karte auf diesem Handy hat, bekommt dieselbe wieder (kein Doppel-Anlegen)
    let c = req.signedCookies.kid ? q.byId.get(req.signedCookies.kid) : null;
    if (!c) {
      const ref = req.body.ref ? q.byRefCode.get(String(req.body.ref).toUpperCase()) : null;
      c = createCustomer(ref ? ref.id : null);
      res.cookie("kid", c.id, { signed: true, httpOnly: true, sameSite: "lax", maxAge: 5 * YEAR, secure: config.isHttps });
    }
    res.redirect(303, platform === "google" ? `/k/${c.id}/google` : `/k/${c.id}?add=apple`);
  } catch (e) { next(e); }
});

app.get("/k/:id", (req, res) => {
  const c = q.byId.get(req.params.id);
  if (!c) return res.status(404).send(views.layout("Nicht gefunden", "<h1>Karte nicht gefunden</h1><p><a href='/j'>Neue Karte holen</a></p>"));
  let html = views.cardPage(c, apple.cardTexts(c));
  // Direkt nach der Anmeldung automatisch den Apple-Wallet-Dialog öffnen
  if (req.query.add === "apple" && config.apple.enabled) {
    html = html.replace("</body>", `<script>setTimeout(function(){location.href='/k/${c.id}/karte.pkpass'},300)</script></body>`);
  }
  res.send(html);
});

app.get("/k/:id/karte.pkpass", async (req, res, next) => {
  try {
    const c = q.byId.get(req.params.id);
    if (!c) return res.sendStatus(404);
    const buf = await apple.buildPass(c);
    res.set({ "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": `attachment; filename="stempelkarte.pkpass"`, "Last-Modified": new Date(c.updated_at).toUTCString() });
    res.send(buf);
  } catch (e) { next(e); }
});

app.get("/k/:id/google", async (req, res, next) => {
  try {
    const c = q.byId.get(req.params.id);
    if (!c || !config.google.enabled) return res.sendStatus(404);
    await google.createObject(c);
    db.prepare("UPDATE customers SET google_object = 1 WHERE id = ?").run(c.id);
    res.redirect(google.saveUrl(c));
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------- Apple Wallet Webservice
// Apple ruft diese Adressen selbst auf (webServiceURL + /v1/...), um Karten aktuell zu halten.
function appleAuth(req, res, next) {
  const c = q.byId.get(req.params.serial);
  const token = (req.get("Authorization") || "").replace(/^ApplePass\s+/i, "");
  if (!c || req.params.passType !== config.apple.passTypeId) return res.sendStatus(401);
  const a = Buffer.from(token), b = Buffer.from(c.auth_token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.sendStatus(401);
  req.customer = c;
  next();
}

app.post("/apple/v1/devices/:deviceId/registrations/:passType/:serial", appleAuth, (req, res) => {
  const pushToken = req.body && req.body.pushToken;
  if (!pushToken) return res.sendStatus(400);
  const exists = db.prepare("SELECT 1 FROM apple_registrations WHERE device_id = ? AND serial = ?").get(req.params.deviceId, req.params.serial);
  db.prepare(`INSERT INTO apple_registrations (device_id, serial, push_token, created_at) VALUES (?, ?, ?, ?)
              ON CONFLICT(device_id, serial) DO UPDATE SET push_token = excluded.push_token`)
    .run(req.params.deviceId, req.params.serial, pushToken, Date.now());
  res.sendStatus(exists ? 200 : 201);
});

app.delete("/apple/v1/devices/:deviceId/registrations/:passType/:serial", appleAuth, (req, res) => {
  db.prepare("DELETE FROM apple_registrations WHERE device_id = ? AND serial = ?").run(req.params.deviceId, req.params.serial);
  res.sendStatus(200);
});

app.get("/apple/v1/devices/:deviceId/registrations/:passType", (req, res) => {
  if (req.params.passType !== config.apple.passTypeId) return res.sendStatus(404);
  const since = Number(req.query.passesUpdatedSince || 0);
  const rows = db.prepare(`SELECT c.id, c.updated_at FROM apple_registrations r JOIN customers c ON c.id = r.serial
                           WHERE r.device_id = ? AND c.updated_at > ?`).all(req.params.deviceId, since);
  if (!rows.length) return res.sendStatus(204);
  res.json({ serialNumbers: rows.map((r) => r.id), lastUpdated: String(Math.max(...rows.map((r) => r.updated_at))) });
});

app.get("/apple/v1/passes/:passType/:serial", appleAuth, async (req, res, next) => {
  try {
    const c = req.customer;
    const ims = req.get("If-Modified-Since");
    if (ims && Math.floor(c.updated_at / 1000) <= Math.floor(new Date(ims).getTime() / 1000)) return res.sendStatus(304);
    const buf = await apple.buildPass(c);
    res.set({ "Content-Type": "application/vnd.apple.pkpass", "Last-Modified": new Date(c.updated_at).toUTCString() });
    res.send(buf);
  } catch (e) { next(e); }
});

app.post("/apple/v1/log", (req, res) => {
  console.log("[Apple Wallet Log]", JSON.stringify(req.body && req.body.logs));
  res.sendStatus(200);
});

// ---------------------------------------------------------------- Team (Personal)
const loginTries = new Map();
app.get("/team/login", (req, res) => res.send(views.loginPage(config.staffPin ? null : "STAFF_PIN ist nicht gesetzt – bitte in den Einstellungen festlegen.")));
app.post("/team/login", (req, res) => {
  const ip = req.ip;
  const t = loginTries.get(ip) || { n: 0, until: 0 };
  if (Date.now() < t.until) return res.send(views.loginPage("Zu viele Versuche – bitte 5 Minuten warten."));
  const pin = String(req.body.pin || "");
  const ok = config.staffPin && pin.length === config.staffPin.length && crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(config.staffPin));
  if (!ok) {
    t.n++; if (t.n >= 5) { t.n = 0; t.until = Date.now() + 5 * 60 * 1000; }
    loginTries.set(ip, t);
    return res.send(views.loginPage("Falsche PIN."));
  }
  loginTries.delete(ip);
  res.cookie("team", "1", { signed: true, httpOnly: true, sameSite: "lax", maxAge: 30 * 864e5, secure: config.isHttps });
  res.redirect("/team");
});

function team(req, res, next) {
  if (req.signedCookies.team === "1") return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Nicht angemeldet" });
  res.redirect("/team/login");
}

app.get("/team", team, (req, res) => res.send(views.staffPage()));
app.get("/team/stats", team, (req, res) => res.send(views.statsPage(stamps.stats())));
app.get("/team/aufsteller", team, async (req, res) => {
  const svg = await QRCode.toString(`${config.baseUrl}/j`, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  res.send(views.posterPage(svg));
});

function cardJson(c) {
  const t = apple.cardTexts(c);
  return { card_code: c.card_code, stamps: c.stamps, required: CAFE.stampsRequired, rewards_redeemed: c.rewards_redeemed, progress: t.progress, status: t.status, ready: t.ready };
}
const code = (req) => String(req.params.code || "").trim().toUpperCase();

app.get("/api/team/karte/:code", team, (req, res) => {
  const c = q.byCardCode.get(code(req));
  if (!c) return res.json({ error: "Karte nicht gefunden – ist das eine Karte von uns?" });
  res.json({ card: cardJson(c) });
});
app.post("/api/team/karte/:code/stempel", team, (req, res) => {
  const r = stamps.addStamps(code(req), req.body.count, req.body.force);
  if (!r.customer) return res.json(r);
  res.json({ card: cardJson(r.customer), bonus: r.bonus });
});
app.post("/api/team/karte/:code/einloesen", team, (req, res) => {
  const r = stamps.redeem(code(req));
  res.json(r.customer ? { card: cardJson(r.customer) } : r);
});
app.post("/api/team/karte/:code/rueckgaengig", team, (req, res) => {
  const r = stamps.undo(code(req));
  res.json(r.customer ? { card: cardJson(r.customer) } : r);
});

app.get("/health", (req, res) => res.json({ ok: true, apple: config.apple.enabled, google: config.google.enabled }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(views.layout("Fehler", "<h1>Da ist etwas schiefgelaufen</h1><p>Bitte versuch es gleich noch einmal.</p>"));
});

app.listen(config.port, async () => {
  console.log(`Stempelkarte läuft auf ${config.baseUrl} (Port ${config.port})`);
  console.log(`  Apple Wallet:  ${config.apple.enabled ? "aktiv" : "NICHT eingerichtet"}${config.apple.enabled && !config.isHttps ? " (Updates erst mit HTTPS)" : ""}`);
  console.log(`  Google Wallet: ${config.google.enabled ? "aktiv" : "NICHT eingerichtet"}`);
  if (!config.staffPin) console.warn("  ⚠️  STAFF_PIN fehlt – Team-Bereich ist gesperrt.");
  if (config.sessionSecret === "bitte-in-env-aendern") console.warn("  ⚠️  SESSION_SECRET ist noch der Standardwert.");
  try { await google.ensureClass(); } catch (e) { console.error("[Google] Klasse konnte nicht angelegt werden:", e.response ? JSON.stringify(e.response.data) : e.message); }
});
