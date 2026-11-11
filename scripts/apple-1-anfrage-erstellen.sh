#!/usr/bin/env bash
# Schritt 1: Privaten Schlüssel + Zertifikatsanfrage (CSR) für Apple erzeugen.
# Danach: certs/anfrage.csr im Apple-Developer-Portal hochladen (siehe README).
set -e
cd "$(dirname "$0")/.."
mkdir -p certs
if [ -f certs/signerKey.pem ]; then
  echo "certs/signerKey.pem existiert schon – nichts überschrieben."; exit 1
fi
openssl req -new -newkey rsa:2048 -nodes \
  -keyout certs/signerKey.pem -out certs/anfrage.csr \
  -subj "/CN=Stempelkarte/C=DE"
echo "✅ Fertig: certs/anfrage.csr jetzt bei Apple hochladen. certs/signerKey.pem gut aufbewahren und niemals teilen!"
