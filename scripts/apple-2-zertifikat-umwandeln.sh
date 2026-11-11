#!/usr/bin/env bash
# Schritt 2: Das von Apple heruntergeladene pass.cer und das Apple-WWDR-G4-Zertifikat in PEM umwandeln.
# Aufruf: bash scripts/apple-2-zertifikat-umwandeln.sh ~/Downloads/pass.cer ~/Downloads/AppleWWDRCAG4.cer
set -e
cd "$(dirname "$0")/.."
PASS_CER="$1"; WWDR_CER="$2"
if [ -z "$PASS_CER" ] || [ -z "$WWDR_CER" ]; then
  echo "Aufruf: bash scripts/apple-2-zertifikat-umwandeln.sh <pass.cer> <AppleWWDRCAG4.cer>"; exit 1
fi
openssl x509 -inform DER -in "$PASS_CER" -out certs/signerCert.pem
openssl x509 -inform DER -in "$WWDR_CER" -out certs/wwdr.pem
# Prüfen, ob Zertifikat und Schlüssel zusammenpassen
A=$(openssl x509 -noout -modulus -in certs/signerCert.pem | openssl md5)
B=$(openssl rsa -noout -modulus -in certs/signerKey.pem | openssl md5)
if [ "$A" != "$B" ]; then echo "❌ Zertifikat passt nicht zum Schlüssel certs/signerKey.pem"; exit 1; fi
echo "✅ certs/signerCert.pem und certs/wwdr.pem erstellt – Zertifikat passt zum Schlüssel."
openssl x509 -noout -subject -enddate -in certs/signerCert.pem
