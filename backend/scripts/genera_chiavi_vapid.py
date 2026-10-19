"""Genera la coppia di chiavi VAPID per le notifiche push.

    venv/Scripts/python.exe scripts/genera_chiavi_vapid.py

Le due righe stampate vanno nelle variabili d'ambiente del backend (Coolify).
Si generano UNA volta: cambiarle invalida tutte le iscrizioni dei dispositivi,
che vanno riattivate dalle Impostazioni.

Formato: chiave privata P-256 grezza (32 byte) e pubblica non compressa (65
byte), entrambe in base64url senza padding — quello che pywebpush e
`PushManager.subscribe({applicationServerKey})` si aspettano.
"""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64url(dati: bytes) -> str:
    return base64.urlsafe_b64encode(dati).rstrip(b"=").decode("ascii")


def genera() -> tuple[str, str]:
    chiave = ec.generate_private_key(ec.SECP256R1())
    privata = chiave.private_numbers().private_value.to_bytes(32, "big")
    pubblica = chiave.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return _b64url(privata), _b64url(pubblica)


if __name__ == "__main__":
    privata, pubblica = genera()
    print(f"VAPID_PRIVATE_KEY={privata}")
    print(f"VAPID_PUBLIC_KEY={pubblica}")
