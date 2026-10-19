"""Passkey: registrazione e login con un autenticatore software vero.

`_Autenticatore` fa quello che fa Face ID: genera una chiave P-256, firma la
sfida del server, e il server verifica con la libreria webauthn reale (niente
mock della crittografia). Così i test coprono anche origine, RP ID, flag di
verifica dell'utente e sfide monouso.
"""

import base64
import hashlib
import json
import os
import struct

import cbor2
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec

import models
from tests.test_two_factor import _attiva

ORIGINE = "http://localhost:5173"
RP_ID = "localhost"

FLAG_UP = 0x01  # utente presente
FLAG_UV = 0x04  # utente verificato (biometria/PIN)
FLAG_AT = 0x40  # dati della credenziale allegati


def _b64(dati: bytes) -> str:
    return base64.urlsafe_b64encode(dati).rstrip(b"=").decode()


class _Autenticatore:
    def __init__(self, verifica_utente=True, origine=ORIGINE):
        self.chiave = ec.generate_private_key(ec.SECP256R1())
        self.credential_id = os.urandom(16)
        self.contatore = 0
        self.flag_uv = FLAG_UV if verifica_utente else 0
        self.origine = origine

    def _client_data(self, tipo, challenge):
        return json.dumps(
            {"type": tipo, "challenge": challenge, "origin": self.origine}
        ).encode()

    def registra(self, options):
        numeri = self.chiave.public_key().public_numbers()
        cose = cbor2.dumps(
            {
                1: 2,  # kty: EC2
                3: -7,  # alg: ES256
                -1: 1,  # crv: P-256
                -2: numeri.x.to_bytes(32, "big"),
                -3: numeri.y.to_bytes(32, "big"),
            }
        )
        auth_data = (
            hashlib.sha256(options["rp"]["id"].encode()).digest()
            + bytes([FLAG_UP | self.flag_uv | FLAG_AT])
            + struct.pack(">I", self.contatore)
            + bytes(16)  # AAGUID
            + struct.pack(">H", len(self.credential_id))
            + self.credential_id
            + cose
        )
        attestazione = cbor2.dumps({"fmt": "none", "attStmt": {}, "authData": auth_data})
        return {
            "id": _b64(self.credential_id),
            "rawId": _b64(self.credential_id),
            "type": "public-key",
            "response": {
                "clientDataJSON": _b64(
                    self._client_data("webauthn.create", options["challenge"])
                ),
                "attestationObject": _b64(attestazione),
                "transports": ["internal", "hybrid"],
            },
            "clientExtensionResults": {},
        }

    def firma(self, options):
        client_data = self._client_data("webauthn.get", options["challenge"])
        auth_data = (
            hashlib.sha256(options["rpId"].encode()).digest()
            + bytes([FLAG_UP | self.flag_uv])
            + struct.pack(">I", self.contatore)
        )
        firma = self.chiave.sign(
            auth_data + hashlib.sha256(client_data).digest(), ec.ECDSA(hashes.SHA256())
        )
        return {
            "id": _b64(self.credential_id),
            "rawId": _b64(self.credential_id),
            "type": "public-key",
            "response": {
                "clientDataJSON": _b64(client_data),
                "authenticatorData": _b64(auth_data),
                "signature": _b64(firma),
                "userHandle": None,
            },
            "clientExtensionResults": {},
        }


def _registra(api, headers, autenticatore, nome=None):
    options = api.post("/auth/passkey/register/options", headers=headers).json()["options"]
    return api.post(
        "/auth/passkey/register/verify",
        json={"credential": autenticatore.registra(options), "nome": nome},
        headers=headers,
    )


def _accedi(api, autenticatore):
    api.cookies.clear()
    options = api.post("/auth/passkey/login/options").json()["options"]
    return api.post("/auth/passkey/login/verify", json={"credential": autenticatore.firma(options)})


def test_opzioni_di_registrazione(api):
    headers = api.registra()
    options = api.post("/auth/passkey/register/options", headers=headers).json()["options"]

    assert options["rp"] == {"name": "SpassoConti", "id": RP_ID}
    assert options["user"]["name"] == "mario@example.it"
    # Passkey "discoverable" e biometria obbligatoria.
    assert options["authenticatorSelection"]["residentKey"] == "required"
    assert options["authenticatorSelection"]["userVerification"] == "required"


def test_registrazione_e_login(api):
    headers = api.registra()
    face_id = _Autenticatore()

    r = _registra(api, headers, face_id, nome="iPhone di Mario")
    assert r.status_code == 200, r.text
    assert r.json()["nome"] == "iPhone di Mario"

    login = _accedi(api, face_id)
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    assert "refresh_token=" in login.headers.get("set-cookie", "")
    me = api.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["username"] == "mario"

    lista = api.get("/auth/passkey", headers=headers).json()
    assert lista[0]["last_used_at"] is not None


def test_nome_dal_dispositivo(api):
    headers = api.registra()
    options = api.post("/auth/passkey/register/options", headers=headers).json()["options"]
    r = api.post(
        "/auth/passkey/register/verify",
        json={"credential": _Autenticatore().registra(options)},
        headers={**headers, "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"},
    )
    assert r.json()["nome"] == "iPhone"


def test_la_passkey_salta_la_2fa(api):
    headers = api.registra()
    _attiva(api, headers)
    face_id = _Autenticatore()
    _registra(api, headers, face_id)

    login = _accedi(api, face_id)

    assert login.json()["access_token"]
    assert login.json()["mfa_required"] is False


def test_senza_verifica_biometrica_rifiutata(api):
    headers = api.registra()
    senza_uv = _Autenticatore(verifica_utente=False)

    assert _registra(api, headers, senza_uv).status_code == 400


def test_origine_sbagliata_rifiutata(api):
    headers = api.registra()
    phishing = _Autenticatore(origine="https://conti-spassocasa.example")

    assert _registra(api, headers, phishing).status_code == 400


def test_la_sfida_vale_una_volta(api):
    headers = api.registra()
    face_id = _Autenticatore()
    _registra(api, headers, face_id)

    api.cookies.clear()
    options = api.post("/auth/passkey/login/options").json()["options"]
    risposta = face_id.firma(options)

    primo = api.post("/auth/passkey/login/verify", json={"credential": risposta})
    replay = api.post("/auth/passkey/login/verify", json={"credential": risposta})

    assert primo.status_code == 200
    assert replay.status_code == 400


def test_passkey_sconosciuta_o_cancellata(api):
    headers = api.registra()
    face_id = _Autenticatore()
    _registra(api, headers, face_id)

    assert _accedi(api, _Autenticatore()).status_code == 400

    passkey_id = api.get("/auth/passkey", headers=headers).json()[0]["id"]
    assert api.delete(f"/auth/passkey/{passkey_id}", headers=headers).status_code == 204
    assert _accedi(api, face_id).status_code == 400


def test_non_si_cancella_la_passkey_di_un_altro(api):
    mario = api.registra("mario")
    luigi = api.registra("luigi")
    _registra(api, mario, _Autenticatore())
    passkey_id = api.get("/auth/passkey", headers=mario).json()[0]["id"]

    assert api.delete(f"/auth/passkey/{passkey_id}", headers=luigi).status_code == 404
    assert api.get("/auth/passkey", headers=luigi).json() == []


def test_sfide_scadute_pulite_dal_job(api):
    import services
    from datetime import datetime

    api.post("/auth/passkey/login/options")
    db = api.session_factory()
    try:
        db.query(models.WebauthnChallenge).one().expires_at = datetime(2000, 1, 1)
        db.commit()
    finally:
        db.close()

    services.task_pulizia_refresh_token()

    db = api.session_factory()
    try:
        assert db.query(models.WebauthnChallenge).count() == 0
    finally:
        db.close()
