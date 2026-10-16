"""Token JWT con PyJWT (al posto di python-jose).

Il token d'accesso deve passare solo se firmato con la nostra chiave e con
l'algoritmo configurato: niente `alg: none`, niente firme con un'altra chiave.
Il JWT per Enable Banking (RS256) deve verificarsi con la chiave pubblica.
"""

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

import auth
import services


def _me(api, token):
    return api.get("/me", headers={"Authorization": f"Bearer {token}"})


def test_token_valido_accettato_e_manomessi_rifiutati(api):
    headers = api.registra("mario")
    assert api.get("/me", headers=headers).status_code == 200

    valido = headers["Authorization"].split()[1]
    payload = jwt.decode(valido, options={"verify_signature": False})

    # Stessi dati, ma senza firma (alg: none) o firmati con un'altra chiave
    senza_firma = jwt.encode(payload, key=None, algorithm="none")
    altra_chiave = jwt.encode(payload, "chiave-di-qualcun-altro-abbastanza-lunga", algorithm="HS256")

    assert _me(api, senza_firma).status_code == 401
    assert _me(api, altra_chiave).status_code == 401


def test_token_d_accesso_contiene_user_id_e_scadenza(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-di-almeno-trentadue-caratteri")
    monkeypatch.setenv("ALGORITHM", "HS256")

    token = auth.create_access_token({"user_id": 7, "token_version": 1})
    payload = jwt.decode(token, "test-secret-key-di-almeno-trentadue-caratteri", algorithms=["HS256"])

    assert payload["user_id"] == 7
    assert "exp" in payload


def test_jwt_enable_banking_firmato_rs256(monkeypatch):
    chiave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = chiave.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    monkeypatch.setenv("ENABLE_BANKING_APP_ID", "app-di-prova")
    monkeypatch.setattr(services, "_enable_banking_private_key", lambda: pem)

    token = services.get_enable_banking_jwt()

    assert jwt.get_unverified_header(token)["kid"] == "app-di-prova"
    payload = jwt.decode(
        token,
        chiave.public_key(),
        algorithms=["RS256"],
        audience="api.enablebanking.com",
        issuer="enablebanking.com",
    )
    assert payload["exp"] > payload["iat"]
