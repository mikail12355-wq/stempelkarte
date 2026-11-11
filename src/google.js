// Google Wallet: Treuekarten-Klasse + Objekt pro Kunde, "Zu Google Wallet hinzufügen"-Link, Updates.
const jwt = require("jsonwebtoken");
const { JWT } = require("google-auth-library");
const config = require("./config");
const { cardTexts } = require("./apple");

const G = config.google;
const CAFE = config.cafe;
const API = "https://walletobjects.googleapis.com/walletobjects/v1";

let client = null;
async function http() {
  if (!client) {
    client = new JWT({
      email: G.serviceAccount.client_email,
      key: G.serviceAccount.private_key,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
  }
  return client;
}

const classId = () => `${G.issuerId}.${G.classSuffix}`;
const objectId = (c) => `${G.issuerId}.${c.id}`;

function classBody() {
  return {
    id: classId(),
    issuerName: CAFE.name,
    programName: "Stempelkarte",
    programLogo: { sourceUri: { uri: `${config.baseUrl}/img/icon-660.png` }, contentDescription: { defaultValue: { language: "de", value: CAFE.name } } },
    hexBackgroundColor: CAFE.colors.background,
    reviewStatus: "UNDER_REVIEW",
    countryCode: "DE",
    ...(CAFE.website ? { homepageUri: { uri: CAFE.website, description: "Website" } } : {}),
  };
}

function objectBody(c) {
  const t = cardTexts(c);
  return {
    id: objectId(c),
    classId: classId(),
    state: "ACTIVE",
    accountId: c.card_code,
    accountName: `Karte ${c.card_code}`,
    loyaltyPoints: { label: "Stempel", balance: { string: t.progress } },
    secondaryLoyaltyPoints: { label: "Eingelöst", balance: { int: c.rewards_redeemed } },
    barcode: { type: "QR_CODE", value: c.card_code, alternateText: c.card_code },
    // Bild-URL ändert sich mit dem Stand, damit Google das neue Bild lädt
    heroImage: { sourceUri: { uri: `${config.baseUrl}/img/hero/${Math.min(c.stamps, CAFE.stampsRequired)}.png` }, contentDescription: { defaultValue: { language: "de", value: t.progress } } },
    textModulesData: [
      { id: "status", header: t.ready ? "Prämie" : "Nächste Prämie", body: t.status },
      { id: "how", header: "So funktioniert's", body: `Zeig die Karte beim Bezahlen. Pro Getränk ein Stempel, bei ${CAFE.stampsRequired} Stempeln gibt's ${CAFE.rewardText}.` },
    ],
    linksModuleData: {
      uris: [
        { id: "invite", uri: `${config.baseUrl}/j?ref=${c.ref_code}`, description: "Freunde einladen – Bonus-Stempel für euch beide" },
        { id: "card", uri: `${config.baseUrl}/k/${c.id}`, description: "Karte im Browser ansehen" },
      ],
    },
  };
}

async function ensureClass() {
  if (!G.enabled) return;
  const h = await http();
  try {
    await h.request({ url: `${API}/loyaltyClass/${classId()}`, method: "GET" });
  } catch (e) {
    if (e.response && e.response.status === 404) {
      await h.request({ url: `${API}/loyaltyClass`, method: "POST", data: classBody() });
      console.log("[Google] Treuekarten-Klasse angelegt:", classId());
    } else {
      throw e;
    }
  }
}

async function createObject(c) {
  const h = await http();
  try {
    await h.request({ url: `${API}/loyaltyObject`, method: "POST", data: objectBody(c) });
  } catch (e) {
    if (!(e.response && e.response.status === 409)) throw e; // 409 = existiert schon
  }
}

function saveUrl(c) {
  const token = jwt.sign(
    {
      iss: G.serviceAccount.client_email,
      aud: "google",
      typ: "savetowallet",
      origins: [config.baseUrl],
      payload: { loyaltyObjects: [{ id: objectId(c) }] },
    },
    G.serviceAccount.private_key,
    { algorithm: "RS256" }
  );
  return `https://pay.google.com/gp/v/save/${token}`;
}

async function updateObject(c) {
  if (!G.enabled || !c.google_object) return;
  const h = await http();
  const body = objectBody(c);
  try {
    await h.request({
      url: `${API}/loyaltyObject/${objectId(c)}`,
      method: "PATCH",
      data: { loyaltyPoints: body.loyaltyPoints, secondaryLoyaltyPoints: body.secondaryLoyaltyPoints, heroImage: body.heroImage, textModulesData: body.textModulesData },
    });
  } catch (e) {
    console.warn("[Google] Update fehlgeschlagen:", e.response ? e.response.status : e.message);
  }
}

module.exports = { ensureClass, createObject, saveUrl, updateObject };
