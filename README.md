# ☕️ Digitale Stempelkarte für dein Café

Deine Gäste scannen einen QR-Code an der Theke und speichern die Stempelkarte in **Apple Wallet** oder **Google Wallet**. Sie brauchen keine App und müssen sich nicht registrieren. Dein Team stempelt mit dem Handy oder Tablet, und die Karte aktualisiert sich bei den Gästen automatisch.

**Was drin ist**
- 10 Stempel = 1 Gratis-Kaffee (frei einstellbar)
- **Empfehlungen:** Jeder Gast bekommt einen eigenen Einladungslink. Sobald der eingeladene Freund **zum ersten Mal gestempelt** wird, bekommen beide einen Bonus-Stempel. So lohnt es sich nicht, Fake-Karten anzulegen.
- **Team-Seite** (`/team`, mit PIN): QR-Code mit der Kamera scannen, dann +1 / +2 Stempel, Prämie einlösen oder versehentliches Stempeln rückgängig machen. Ein Schutz gegen Doppelscans ist eingebaut.
- **Statistik** (`/team/stats`) und ein **druckbarer QR-Aufsteller** für die Theke (`/team/aufsteller`)
- **Datensparsam:** keine Namen, E-Mails oder Telefonnummern, nur eine zufällige Kartennummer

---

## Überblick: Was du einrichten musst (ca. 1–2 Stunden)

| Schritt | Wo | Kosten |
|---|---|---|
| 1. Apple-Zertifikat für Wallet-Karten | Apple Developer (hast du schon) | im Account enthalten |
| 2. Google-Wallet-Konto | Google Pay & Wallet Console + Google Cloud | kostenlos |
| 3. Server online stellen | GitHub + Railway | ca. 5 $/Monat (Hobby-Plan) |
| 4. Testen, Aufsteller drucken, loslegen | – | – |

> **Wichtig vorab:** Lege die endgültige Adresse (z. B. `https://karte.deincafe.de`) fest, **bevor** Gäste Karten bekommen. Sie wird in jede Apple-Karte eingebaut. Änderst du sie später, bekommen bestehende Karten keine Updates mehr.

Für die Befehle unten brauchst du ein Terminal: auf dem Mac das Programm „Terminal“, unter Windows **Git Bash** (wird mit Git für Windows installiert).

---

## Schritt 1: Apple Wallet

1. **Pass Type ID anlegen:** [developer.apple.com/account](https://developer.apple.com/account) → *Certificates, IDs & Profiles* → *Identifiers* → **+** → **Pass Type IDs** → Beschreibung „Stempelkarte“, Identifier z. B. `pass.de.deincafe.stempelkarte`.
2. **Schlüssel + Anfrage erzeugen** (im Projektordner):
   ```bash
   bash scripts/apple-1-anfrage-erstellen.sh
   ```
   Das legt `certs/signerKey.pem` (geheim!) und `certs/anfrage.csr` an.
3. **Zertifikat erstellen:** Im Portal deine Pass Type ID anklicken → **Create Certificate** → `certs/anfrage.csr` hochladen → `pass.cer` herunterladen.
4. **Apple-Zwischenzertifikat laden:** [AppleWWDRCAG4.cer](https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer) herunterladen (Apple *Worldwide Developer Relations – G4*).
5. **Umwandeln:**
   ```bash
   bash scripts/apple-2-zertifikat-umwandeln.sh ~/Downloads/pass.cer ~/Downloads/AppleWWDRCAG4.cer
   ```
6. **Team ID notieren:** Developer-Portal → *Membership details* → *Team ID* (10 Zeichen).

Das Zertifikat ist ca. 1 Jahr gültig. Danach Schritte 3–5 wiederholen; der Schlüssel aus Schritt 2 kann bleiben.

---

## Schritt 2: Google Wallet

1. **Issuer-Konto:** [pay.google.com/business/console](https://pay.google.com/business/console) → Unternehmensprofil ausfüllen → **Google Wallet API** → Nutzungsbedingungen akzeptieren. Notiere die **Issuer ID** (lange Zahl oben auf der Seite).
2. **Google Cloud:** [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt → *APIs & Dienste* → **Google Wallet API** aktivieren.
3. **Dienstkonto:** *IAM & Verwaltung* → *Dienstkonten* → **Dienstkonto erstellen** (Name z. B. „stempelkarte“, keine Rollen nötig) → Tab *Schlüssel* → **Schlüssel hinzufügen → JSON**. Speichere die Datei als `certs/google-service-account.json`.
4. **Dienstkonto freischalten:** Zurück in der Pay & Wallet Console → *Benutzer* → die E-Mail des Dienstkontos (`…@….iam.gserviceaccount.com`) als **Entwickler** einladen.
5. **Demo-Modus:** Neue Konten sind zunächst im Demo-Modus. Dann können nur Admins, Entwickler und eingetragene Testkonten die Karte speichern, und sie zeigt „[TEST ONLY]“. Zum Testen trägst du deine eigene Google-Adresse unter *Testkonten einrichten* ein.
6. **Freigabe beantragen:** Wenn alles läuft (der Server legt die Kartenvorlage beim ersten Start automatisch an), in der Console auf **„Veröffentlichungszugriff anfordern“** klicken und Screenshots der Karte beilegen. Google prüft das und schickt dir eine E-Mail.

---

## Schritt 3: Online stellen mit Railway

1. **Code zu GitHub:** Neues **privates** Repository auf github.com anlegen und den Projektordner hochladen (*Add file → Upload files*). Der Ordner `certs/` wird durch `.gitignore` nicht hochgeladen. **Lade die Zertifikate niemals hoch.**
2. **Railway:** [railway.com](https://railway.com) → *New Project* → *Deploy from GitHub repo* → dein Repository auswählen.
3. **Volume (Speicher für die Datenbank):** Im Service → *Settings* → **Volumes** → *Add Volume*, Mount-Pfad `/data`.
4. **Domain:** *Settings* → *Networking* → **Generate Domain** (oder unter *Custom Domain* deine eigene, z. B. `karte.deincafe.de`, mit dem angezeigten DNS-Eintrag bei deinem Domain-Anbieter).
5. **Variablen:** Diesen Befehl im Projektordner ausführen:
   ```bash
   bash scripts/base64-fuer-railway.sh
   ```
   Kopiere die Ausgabe in Railway → *Variables* → **Raw Editor**. Ergänze dort außerdem (siehe `.env.example`):
   ```
   BASE_URL=https://deine-domain-aus-schritt-4
   DATA_DIR=/data
   STAFF_PIN=eine-pin-für-dein-team
   CAFE_NAME=Coffee Dream
   CAFE_ADDRESS=...
   PRIVACY_URL=https://www.deincafe.de/datenschutz
   APPLE_PASS_TYPE_ID=pass.de.deincafe.stempelkarte
   APPLE_TEAM_ID=ABCDE12345
   GOOGLE_ISSUER_ID=3388000000...
   ```
6. Railway startet den Server neu. Prüfe unter `https://deine-domain/health`: Dort muss `"apple":true,"google":true` stehen.

---

## Schritt 4: Testen und loslegen

1. Öffne `https://deine-domain/j` auf deinem iPhone und tippe auf **Zu Apple Wallet hinzufügen**. Mach dasselbe mit einem Android-Handy (Google-Konto als Testkonto eingetragen).
2. Auf einem zweiten Gerät `https://deine-domain/team` öffnen → PIN → **Kamera starten** → QR-Code der Karte scannen → **+1 Stempel**. Nach wenigen Sekunden aktualisiert sich die Karte in der Wallet, auf dem iPhone mit Mitteilung.
3. Teste die Empfehlung: Auf der Rückseite der Karte (iPhone: ••• → *Karteninformationen*) den Einladungslink öffnen und damit auf einem anderen Handy eine Karte holen. Beim ersten Stempel des neuen Gastes bekommen beide +1.
4. **Aufsteller drucken:** `/team/aufsteller` → Drucken. Stell ihn neben die Kasse.
5. **Fürs Team:** `/team` auf dem Kassen-Tablet oder Handy als Lesezeichen bzw. auf dem Home-Bildschirm speichern. Die Anmeldung bleibt 30 Tage aktiv.

### Datenschutz
Es werden nur zufällige Kartennummern, Stempelstände und Zeitpunkte gespeichert, keine personenbezogenen Daten wie Namen oder E-Mail-Adressen. Ergänze trotzdem einen kurzen Absatz in deiner Datenschutzerklärung (Hosting bei Railway, Apple/Google Wallet) und trage die Adresse als `PRIVACY_URL` ein.

---

## Anpassen

| Variable | Bedeutung | Standard |
|---|---|---|
| `STAMPS_REQUIRED` | Stempel bis zur Prämie | 10 |
| `REWARD_TEXT` | Text der Prämie | 1 Gratis-Kaffee |
| `REFERRAL_BONUS` | Bonus-Stempel pro Empfehlung (für beide) | 1 |
| `REFERRAL_MAX_PER_CUSTOMER` | Max. Empfehlungs-Boni pro Gast | 10 |
| `COLOR_*` | Farben der Karte | Kaffeebraun |

**Eigenes Logo:** Lege `assets/logo.png` (quer, z. B. 480×150 px, transparenter Hintergrund) und/oder `assets/icon.png` (quadratisch) ins Projekt. Ohne eigene Bilder wird ein Tassen-Symbol verwendet.

## Lokal ausprobieren (optional)
```bash
npm install
cp .env.example .env   # Werte eintragen, BASE_URL=http://localhost:3000
npm start
```
Lokal (ohne https) kann man Karten erzeugen, aber sie aktualisieren sich nicht automatisch. Das funktioniert erst auf dem Server mit https.

## Datensicherung
Alle Daten liegen in einer Datei: `/data/stempelkarte.db`. In Railway kannst du für das Volume Backups einstellen (*Volume → Backups*).

## Aufbau des Codes
```
src/server.js   Webseiten, Team-Bereich, Apple-Update-Schnittstelle
src/stamps.js   Stempel, Prämie, Empfehlungs-Bonus
src/apple.js    Apple-Wallet-Karte + Push-Updates
src/google.js   Google-Wallet-Karte + Updates
src/images.js   Stempel-Grafik, Icon, Logo
src/views.js    HTML der Seiten
src/db.js       SQLite-Datenbank
```
