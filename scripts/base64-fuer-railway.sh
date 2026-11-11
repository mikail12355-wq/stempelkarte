#!/usr/bin/env bash
# Gibt die Zertifikate als Base64-Zeilen aus – zum Einfügen in Railway → Variables (Raw Editor).
set -e
cd "$(dirname "$0")/.."
b64() { base64 < "$1" | tr -d '\n'; }
[ -f certs/signerCert.pem ] && echo "APPLE_SIGNER_CERT_B64=$(b64 certs/signerCert.pem)"
[ -f certs/signerKey.pem ] && echo "APPLE_SIGNER_KEY_B64=$(b64 certs/signerKey.pem)"
[ -f certs/wwdr.pem ] && echo "APPLE_WWDR_B64=$(b64 certs/wwdr.pem)"
[ -f certs/google-service-account.json ] && echo "GOOGLE_SERVICE_ACCOUNT_B64=$(b64 certs/google-service-account.json)"
echo "SESSION_SECRET=$(openssl rand -hex 32)"
