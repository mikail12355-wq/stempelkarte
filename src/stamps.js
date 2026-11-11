// Stempel vergeben, Prämien einlösen, Empfehlungs-Bonus – und danach die Wallet-Karten aktualisieren.
const { db, q } = require("./db");
const config = require("./config");
const apple = require("./apple");
const google = require("./google");

const CAFE = config.cafe;
const DOUBLE_SCAN_MS = 60 * 1000;

function touch(id) {
  db.prepare("UPDATE customers SET updated_at = ? WHERE id = ?").run(Date.now(), id);
}

function syncWallets(id) {
  // Im Hintergrund, damit die Theke nicht wartet
  const c = q.byId.get(id);
  if (!c) return;
  apple.notifyPassChanged(c.id).catch((e) => console.error("[Apple]", e.message));
  google.updateObject(c).catch((e) => console.error("[Google]", e.message));
}

// Gibt { customer, bonus, referrer } zurück oder { warning } bei Doppel-Scan
function addStamps(cardCode, count, force) {
  count = Math.max(1, Math.min(Number(count) || 1, 10));
  let result;
  const tx = db.transaction(() => {
    const c = q.byCardCode.get(cardCode);
    if (!c) { result = { error: "Karte nicht gefunden" }; return; }
    const now = Date.now();
    if (!force && c.last_stamp_at && now - c.last_stamp_at < DOUBLE_SCAN_MS) {
      result = { warning: `Diese Karte hat vor ${Math.round((now - c.last_stamp_at) / 1000)} Sekunden schon einen Stempel bekommen.` };
      return;
    }
    db.prepare("UPDATE customers SET stamps = stamps + ?, total_stamps = total_stamps + ?, last_stamp_at = ?, updated_at = ? WHERE id = ?")
      .run(count, count, now, now, c.id);
    q.event.run(c.id, "stamp", count, null, now);

    // Empfehlung: erst beim ersten echten Besuch des Geworbenen gibt's den Bonus – für beide
    let bonus = 0, referrer = null;
    if (c.referred_by && !c.referral_rewarded && c.total_stamps === 0 && CAFE.referralBonus > 0) {
      const ref = q.byId.get(c.referred_by);
      db.prepare("UPDATE customers SET referral_rewarded = 1 WHERE id = ?").run(c.id);
      if (ref) {
        const given = db.prepare("SELECT COUNT(*) n FROM events WHERE customer_id = ? AND type = 'bonus' AND note = 'Empfehlung'").get(ref.id).n;
        bonus = CAFE.referralBonus;
        db.prepare("UPDATE customers SET stamps = stamps + ?, total_stamps = total_stamps + ? WHERE id = ?").run(bonus, bonus, c.id);
        q.event.run(c.id, "bonus", bonus, "Willkommen über Empfehlung", now);
        if (given < CAFE.referralMaxPerCustomer) {
          db.prepare("UPDATE customers SET stamps = stamps + ?, total_stamps = total_stamps + ?, updated_at = ? WHERE id = ?").run(bonus, bonus, now, ref.id);
          q.event.run(ref.id, "bonus", bonus, "Empfehlung", now);
          referrer = ref.id;
        }
      }
    }
    result = { customer: q.byId.get(c.id), bonus, referrer };
  });
  tx();
  if (result.customer) {
    syncWallets(result.customer.id);
    if (result.referrer) syncWallets(result.referrer);
  }
  return result;
}

function redeem(cardCode) {
  const c = q.byCardCode.get(cardCode);
  if (!c) return { error: "Karte nicht gefunden" };
  if (c.stamps < CAFE.stampsRequired) return { error: `Erst ${c.stamps} von ${CAFE.stampsRequired} Stempeln` };
  const now = Date.now();
  db.prepare("UPDATE customers SET stamps = stamps - ?, rewards_redeemed = rewards_redeemed + 1, updated_at = ? WHERE id = ?")
    .run(CAFE.stampsRequired, now, c.id);
  q.event.run(c.id, "redeem", CAFE.stampsRequired, null, now);
  syncWallets(c.id);
  return { customer: q.byId.get(c.id) };
}

// Letzten Stempel zurücknehmen (falls versehentlich gestempelt)
function undo(cardCode) {
  const c = q.byCardCode.get(cardCode);
  if (!c) return { error: "Karte nicht gefunden" };
  const last = db.prepare("SELECT * FROM events WHERE customer_id = ? AND type = 'stamp' ORDER BY id DESC LIMIT 1").get(c.id);
  if (!last || Date.now() - last.created_at > 10 * 60 * 1000) return { error: "Kein Stempel aus den letzten 10 Minuten zum Zurücknehmen" };
  const n = Math.min(last.amount, c.stamps);
  db.prepare("UPDATE customers SET stamps = stamps - ?, total_stamps = total_stamps - ?, last_stamp_at = NULL, updated_at = ? WHERE id = ?")
    .run(n, n, Date.now(), c.id);
  db.prepare("DELETE FROM events WHERE id = ?").run(last.id);
  syncWallets(c.id);
  return { customer: q.byId.get(c.id) };
}

function stats() {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const weekAgo = Date.now() - 7 * 864e5;
  const one = (sql, ...a) => db.prepare(sql).get(...a).n || 0;
  return {
    customers: one("SELECT COUNT(*) n FROM customers"),
    activeCustomers: one("SELECT COUNT(*) n FROM customers WHERE total_stamps > 0"),
    viaReferral: one("SELECT COUNT(*) n FROM customers WHERE referred_by IS NOT NULL"),
    referralsVisited: one("SELECT COUNT(*) n FROM customers WHERE referral_rewarded = 1"),
    stampsToday: one("SELECT SUM(amount) n FROM events WHERE type='stamp' AND created_at >= ?", dayStart.getTime()),
    stampsWeek: one("SELECT SUM(amount) n FROM events WHERE type='stamp' AND created_at >= ?", weekAgo),
    rewardsTotal: one("SELECT COUNT(*) n FROM events WHERE type='redeem'"),
    newWeek: one("SELECT COUNT(*) n FROM customers WHERE created_at >= ?", weekAgo),
    appleDevices: one("SELECT COUNT(DISTINCT serial) n FROM apple_registrations"),
    googleCards: one("SELECT COUNT(*) n FROM customers WHERE google_object = 1"),
  };
}

module.exports = { addStamps, redeem, undo, stats, touch, syncWallets };
