const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite"); // in Node eingebaut – kein Maschinencode nötig
const config = require("./config");

fs.mkdirSync(config.dataDir, { recursive: true });
const db = new DatabaseSync(path.join(config.dataDir, "stempelkarte.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
// Kleiner Helfer für Transaktionen (alles oder nichts)
db.transaction = (fn) => () => {
  db.exec("BEGIN");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { db.exec("ROLLBACK"); throw e; }
};

db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,               -- geheime ID (Seriennummer der Karte)
  card_code TEXT UNIQUE NOT NULL,    -- steht im QR-Code der Karte, wird vom Personal gescannt
  ref_code TEXT UNIQUE NOT NULL,     -- öffentlicher Empfehlungscode
  auth_token TEXT NOT NULL,          -- für Apples Update-Webservice
  referred_by TEXT,                  -- customers.id des Werbers
  referral_rewarded INTEGER NOT NULL DEFAULT 0,
  stamps INTEGER NOT NULL DEFAULT 0,
  total_stamps INTEGER NOT NULL DEFAULT 0,
  rewards_redeemed INTEGER NOT NULL DEFAULT 0,
  last_stamp_at INTEGER,
  google_object INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS apple_registrations (
  device_id TEXT NOT NULL,
  serial TEXT NOT NULL,
  push_token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (device_id, serial)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL,                -- stamp | bonus | redeem | join
  amount INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
`);

// Gut lesbare Codes ohne Verwechslungsgefahr (kein 0/O, 1/I)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function shortCode(len) {
  const bytes = crypto.randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

const q = {
  byId: db.prepare("SELECT * FROM customers WHERE id = ?"),
  byCardCode: db.prepare("SELECT * FROM customers WHERE card_code = ?"),
  byRefCode: db.prepare("SELECT * FROM customers WHERE ref_code = ?"),
  insert: db.prepare(`INSERT INTO customers (id, card_code, ref_code, auth_token, referred_by, created_at, updated_at)
                      VALUES (@id, @card_code, @ref_code, @auth_token, @referred_by, @now, @now)`),
  event: db.prepare("INSERT INTO events (customer_id, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?)"),
};

function createCustomer(referredBy) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = {
      id: crypto.randomBytes(12).toString("hex"),
      card_code: shortCode(8),
      ref_code: shortCode(6),
      auth_token: crypto.randomBytes(24).toString("hex"),
      referred_by: referredBy || null,
      now: Date.now(),
    };
    try {
      q.insert.run(row);
      q.event.run(row.id, "join", 0, referredBy ? "via Empfehlung" : null, row.now);
      return q.byId.get(row.id);
    } catch (e) {
      if (!String(e.message).includes("UNIQUE")) throw e;
    }
  }
  throw new Error("Konnte keinen eindeutigen Code erzeugen");
}

module.exports = { db, q, createCustomer };
