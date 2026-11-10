"""Server MCP: OAuth (registrazione → autorizzazione → token) e strumenti in sola lettura."""

import base64
import hashlib
import json
from datetime import date
from urllib.parse import parse_qs, urlparse

import pytest

import models
from routers import mcp

REDIRECT = "https://claude.ai/api/mcp/auth_callback"
VERIFIER = "verificatore-segreto-lungo-abbastanza-per-pkce-0123456789"
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).rstrip(b"=").decode()


@pytest.fixture(autouse=True)
def _pulisci_codici():
    mcp._codici_usati.clear()


def _client(api):
    r = api.post("/mcp/oauth/register", json={"client_name": "Claude", "redirect_uris": [REDIRECT]})
    assert r.status_code == 201, r.text
    return r.json()


def _login_blob(api, client):
    r = api.get(
        "/mcp/oauth/authorize",
        params={
            "response_type": "code",
            "client_id": client["client_id"],
            "redirect_uri": REDIRECT,
            "code_challenge": CHALLENGE,
            "code_challenge_method": "S256",
            "state": "xyz",
        },
    )
    assert r.status_code == 200, r.text
    assert "form-action 'self' https://claude.ai" in r.headers["content-security-policy"]
    inizio = r.text.index('name="login" value="') + len('name="login" value="')
    return r.text[inizio : r.text.index('"', inizio)]


def _codice(api, client, username="mario", password="password123", codice=""):
    r = api.post(
        "/mcp/oauth/authorize",
        data={"login": _login_blob(api, client), "username": username, "password": password, "codice": codice},
        follow_redirects=False,
    )
    return r


def _token(api, username="mario"):
    client = _client(api)
    r = _codice(api, client, username=username)
    assert r.status_code == 302, r.text
    q = parse_qs(urlparse(r.headers["location"]).query)
    assert q["state"] == ["xyz"]
    r = api.post(
        "/mcp/oauth/token",
        data={
            "grant_type": "authorization_code",
            "code": q["code"][0],
            "redirect_uri": REDIRECT,
            "code_verifier": VERIFIER,
            "client_id": client["client_id"],
            "client_secret": client["client_secret"],
        },
    )
    assert r.status_code == 200, r.text
    return client, q["code"][0], r.json()


def _rpc(api, token, method, params=None, id_=1):
    r = api.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": id_, "method": method, "params": params or {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _tool(api, token, nome, **args):
    risposta = _rpc(api, token, "tools/call", {"name": nome, "arguments": args})
    risultato = risposta["result"]
    assert not risultato.get("isError"), risultato
    return json.loads(risultato["content"][0]["text"])


def test_scoperta_alla_radice(api):
    base = "http://testserver"
    r = api.get(base + "/.well-known/oauth-protected-resource/api/mcp")
    assert r.status_code == 200
    assert r.json()["resource"].endswith("/api/mcp")
    r = api.get(base + "/.well-known/oauth-authorization-server")
    assert r.json()["code_challenge_methods_supported"] == ["S256"]


def test_senza_token_401_con_resource_metadata(api):
    r = api.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "initialize"})
    assert r.status_code == 401
    assert "resource_metadata=" in r.headers["www-authenticate"]
    r = api.post("/mcp", json={}, headers={"Authorization": "Bearer falso.falso"})
    assert r.status_code == 401


def test_flusso_completo_e_strumenti(api):
    mario = api.registra("mario")
    conto = api.post("/conti", json={"nome": "Banca", "saldo": 1000}, headers=mario).json()
    cat = api.post("/categorie", json={"nome": "Spesa"}, headers=mario).json()
    oggi = str(date.today())
    for importo, tipo in ((30, "USCITA"), (20, "USCITA"), (500, "ENTRATA")):
        r = api.post(
            "/transazioni",
            json={"importo": importo, "tipo": tipo, "data": oggi, "conto_id": conto["id"],
                  "categoria_id": cat["id"], "descrizione": "Esselunga"},
            headers=mario,
        )
        assert r.status_code == 200, r.text

    _, _, token = _token(api)
    access = token["access_token"]

    init = _rpc(api, access, "initialize", {"protocolVersion": "2025-06-18"})
    assert init["result"]["serverInfo"]["name"] == "spassoconti"
    nomi = {t["name"] for t in _rpc(api, access, "tools/list")["result"]["tools"]}
    assert {"conti", "movimenti", "totali_per_categoria", "budget"} <= nomi

    conti = _tool(api, access, "conti")
    assert conti["conti"][0]["saldo"] == "1450.00"

    mov = _tool(api, access, "movimenti", categoria="spesa", tipo="USCITA")
    assert mov["numero_movimenti"] == 2
    assert mov["totali_per_tipo"]["USCITA"]["somma"] == "50.00"

    # Netto per categoria, come la pagina Analisi: 500 - 50 = entrata netta.
    uscite = _tool(api, access, "totali_per_categoria")
    assert uscite["categorie"] == []
    entrate = _tool(api, access, "totali_per_categoria", lato="entrate")
    assert entrate["categorie"][0]["totale"] == "450.00"

    andamento = _tool(api, access, "andamento_mensile", mesi=2)
    assert andamento["mesi"][-1]["uscite"] == "50.00"
    assert andamento["mesi"][-1]["risparmio"] == "450.00"

    for nome in ("categorie", "budget", "ricorrenze"):
        _tool(api, access, nome)

    # Notifica: nessuna risposta.
    r = api.post("/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"},
                 headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 202


def test_dati_di_un_altro_utente_non_si_vedono(api):
    luigi = api.registra("luigi")
    api.post("/conti", json={"nome": "Di Luigi", "saldo": 999}, headers=luigi)
    api.registra("mario")
    _, _, token = _token(api, "mario")
    nomi = [c["nome"] for c in _tool(api, token["access_token"], "conti")["conti"]]
    assert "Di Luigi" not in nomi
    errore = _rpc(api, token["access_token"], "tools/call",
                  {"name": "movimenti", "arguments": {"conto": "Di Luigi"}})
    assert errore["result"]["isError"]


def test_conti_e_movimenti_cancellati_esclusi(api):
    mario = api.registra("mario")
    conto = api.post("/conti", json={"nome": "Vecchio", "saldo": 10}, headers=mario).json()
    assert api.delete(f"/conti/{conto['id']}", headers=mario).status_code in (200, 204)
    _, _, token = _token(api)
    assert _tool(api, token["access_token"], "conti")["conti"] == [] or all(
        c["nome"] != "Vecchio" for c in _tool(api, token["access_token"], "conti")["conti"]
    )


def test_password_errata_e_codice_monouso(api):
    api.registra("mario")
    client = _client(api)
    r = _codice(api, client, password="sbagliata")
    assert r.status_code == 401
    assert "Credenziali non valide" in r.text

    client, codice, _ = _token(api)
    r = api.post(
        "/mcp/oauth/token",
        data={"grant_type": "authorization_code", "code": codice, "code_verifier": VERIFIER,
              "client_id": client["client_id"], "client_secret": client["client_secret"]},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "invalid_grant"


def test_pkce_sbagliato_rifiutato(api):
    api.registra("mario")
    client = _client(api)
    r = _codice(api, client)
    codice = parse_qs(urlparse(r.headers["location"]).query)["code"][0]
    r = api.post(
        "/mcp/oauth/token",
        data={"grant_type": "authorization_code", "code": codice, "code_verifier": "altro",
              "client_id": client["client_id"], "client_secret": client["client_secret"]},
    )
    assert r.status_code == 400


def test_redirect_non_registrato_rifiutato(api):
    client = _client(api)
    r = api.get("/mcp/oauth/authorize", params={
        "response_type": "code", "client_id": client["client_id"],
        "redirect_uri": "https://cattivo.example/cb", "code_challenge": CHALLENGE,
    })
    assert r.status_code == 400
    r = api.post("/mcp/oauth/register", json={"redirect_uris": ["http://cattivo.example/cb"]})
    assert r.status_code == 400


def test_refresh_e_revoca_con_token_version(api):
    api.registra("mario")
    client, _, token = _token(api)
    dati = {"grant_type": "refresh_token", "refresh_token": token["refresh_token"],
            "client_id": client["client_id"], "client_secret": client["client_secret"]}
    r = api.post("/mcp/oauth/token", data=dati)
    assert r.status_code == 200
    nuovo = r.json()["access_token"]
    assert _rpc(api, nuovo, "ping")["result"] == {}

    # "Esci da tutti i dispositivi" (o cambio password) alza token_version.
    with api.session_factory() as db:
        user = db.query(models.User).one()
        user.token_version += 1
        db.commit()
    r = api.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"},
                 headers={"Authorization": f"Bearer {nuovo}"})
    assert r.status_code == 401
    assert api.post("/mcp/oauth/token", data=dati).status_code == 400


def test_utente_bannato_non_autorizza(api):
    from datetime import datetime, timezone

    api.registra("mario")
    with api.session_factory() as db:
        db.query(models.User).one().banned_at = datetime.now(timezone.utc)
        db.commit()
    r = _codice(api, _client(api))
    assert r.status_code == 401
    assert "disattivato" in r.text


def test_2fa_richiede_il_codice(api):
    import time

    import pyotp

    headers = api.registra("mario")
    segreto = api.post("/auth/2fa/setup", headers=headers).json()["secret"]
    r = api.post("/auth/2fa/enable", json={"code": pyotp.TOTP(segreto).now()}, headers=headers)
    assert r.status_code == 200, r.text
    client = _client(api)
    r = _codice(api, client)
    assert r.status_code == 401
    assert "codice" in r.text
    # Il codice del passo appena usato per attivare non vale due volte: il successivo sì.
    r = _codice(api, client, codice=pyotp.TOTP(segreto).at(time.time() + 30))
    assert r.status_code == 302, r.text
