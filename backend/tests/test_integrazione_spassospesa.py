"""SpassoSpesa registra le spese della lista di casa: rotte server a server col token.

Lo scoping passa dalla mail: un conto o un movimento di un altro utente non si tocca,
e il movimento creato è lo stesso di POST /transazioni (saldo, idempotenza, verifica).
"""

from datetime import date

import pytest

TOKEN = "token-condiviso-di-test"
H = {"Authorization": f"Bearer {TOKEN}"}
BASE = "/integrazioni/spassospesa"


@pytest.fixture()
def token(monkeypatch):
    monkeypatch.setenv("SPASSOSPESA_TOKEN", TOKEN)


def _conto(api, headers, nome="Carta", saldo=500):
    r = api.post("/conti", json={"nome": nome, "saldo": saldo}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _uscita(conto, key="spassospesa-scontrino-1", **extra):
    return {
        "email": "mario@example.it",
        "tipo": "USCITA",
        "importo": "42.30",
        "data": str(date.today()),
        "descrizione": "Spesa Esselunga",
        "conto_id": conto["id"],
        "idempotency_key": key,
        **extra,
    }


def test_senza_token_configurato_non_esiste(api, monkeypatch):
    monkeypatch.delenv("SPASSOSPESA_TOKEN", raising=False)
    assert api.get(f"{BASE}/account", params={"email": "x@y.it"}, headers=H).status_code == 404


def test_token_sbagliato(api, token):
    r = api.get(f"{BASE}/account", params={"email": "x@y.it"}, headers={"Authorization": "Bearer no"})
    assert r.status_code == 401


def test_account_con_conti_e_categorie(api, token):
    headers = api.registra("mario")
    conto = _conto(api, headers)
    r = api.get(f"{BASE}/account", params={"email": "MARIO@example.it"}, headers=H).json()
    assert r["exists"] is True
    assert conto["id"] in [c["id"] for c in r["conti"]]
    assert api.get(f"{BASE}/account", params={"email": "nessuno@x.it"}, headers=H).json() == {"exists": False}


def test_uscita_idempotente_e_rimborso_con_saldi_in_ordine(api, token):
    headers = api.registra("mario")
    conto = _conto(api, headers)
    api.get("/conti/verifica-saldi", headers=headers)  # fotografa il punto di partenza
    a = api.post(f"{BASE}/transazioni", json=_uscita(conto), headers=H)
    assert a.status_code == 200, a.text
    b = api.post(f"{BASE}/transazioni", json=_uscita(conto), headers=H)
    assert a.json()["id"] == b.json()["id"]

    r = api.post(
        f"{BASE}/transazioni",
        json=_uscita(conto, key="spassospesa-debito-1-rimborso", tipo="RIMBORSO", importo="21.15", parent_transaction_id=a.json()["id"]),
        headers=H,
    )
    assert r.status_code == 200, r.text

    saldo = next(c for c in api.get("/conti", headers=headers).json() if c["id"] == conto["id"])["saldo"]
    assert float(saldo) == pytest.approx(500 - 42.30 + 21.15)
    padre = api.get(f"/transazioni/{a.json()['id']}", headers=headers).json()
    assert float(padre["importo_netto"]) == pytest.approx(21.15)
    assert api.get("/conti/verifica-saldi", headers=headers).json() == []


def test_il_conto_di_un_altro_non_si_tocca(api, token):
    api.registra("mario")
    altri = api.registra("luigi")
    conto_luigi = _conto(api, altri)
    r = api.post(f"{BASE}/transazioni", json=_uscita(conto_luigi), headers=H)
    assert r.status_code == 404


def test_rimborso_senza_padre(api, token):
    headers = api.registra("mario")
    conto = _conto(api, headers)
    r = api.post(f"{BASE}/transazioni", json=_uscita(conto, tipo="RIMBORSO"), headers=H)
    assert r.status_code == 400
