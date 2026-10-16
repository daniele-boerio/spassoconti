"""Ogni scrittura che muove un saldo carica i conti con SELECT ... FOR UPDATE.

Il saldo si rilegge e si riscrive in Python: senza il lock sulla riga, due
richieste concorrenti sullo stesso conto (la coda offline che invia tre movimenti
insieme, un job notturno) partono dallo stesso valore e una somma va persa.

SQLite ignora FOR UPDATE, quindi qui la concorrenza non si può riprodurre: si
controlla invece che le SELECT sui conti escano *con* il lock, intercettandole a
livello ORM (il flag vive nello statement, indipendente dal dialetto). Se qualcuno
toglie un `.with_for_update()`, questi test lo dicono.
"""

from datetime import date

from sqlalchemy import event

from models import Conto


def _conto(api, headers, nome="Principale", saldo=1000):
    r = api.post("/conti", json={"nome": nome, "saldo": saldo}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


class _SelectSuiConti:
    """Raccoglie, per ogni SELECT sui conti, se è uscita con FOR UPDATE."""

    def __init__(self, session_factory):
        self.session_factory = session_factory
        self.lock = []

    def __enter__(self):
        event.listen(self.session_factory, "do_orm_execute", self._on_execute)
        return self

    def __exit__(self, *exc):
        event.remove(self.session_factory, "do_orm_execute", self._on_execute)

    def _on_execute(self, state):
        if not state.is_select:
            return
        tabelle = {d.get("entity") for d in state.statement.column_descriptions}
        if Conto in tabelle:
            self.lock.append(state.statement._for_update_arg is not None)


def test_creare_un_movimento_blocca_il_conto(api):
    headers = api.registra()
    conto = _conto(api, headers)

    with _SelectSuiConti(api.session_factory) as spia:
        r = api.post(
            "/transazioni",
            json={
                "importo": 20,
                "tipo": "USCITA",
                "data": str(date.today()),
                "conto_id": conto["id"],
            },
            headers=headers,
        )

    assert r.status_code == 200, r.text
    assert spia.lock and spia.lock[0], spia.lock


def test_giroconto_blocca_sorgente_e_destinazione(api):
    headers = api.registra()
    a = _conto(api, headers, "A")
    b = _conto(api, headers, "B")

    with _SelectSuiConti(api.session_factory) as spia:
        r = api.post(
            "/transazioni",
            json={
                "importo": 30,
                "tipo": "RICARICA",
                "data": str(date.today()),
                "conto_id": a["id"],
                "conto_destinazione_id": b["id"],
            },
            headers=headers,
        )

    assert r.status_code == 200, r.text
    assert len(spia.lock) >= 2 and all(spia.lock[:2]), spia.lock


def test_modificare_ed_eliminare_bloccano_il_conto(api):
    headers = api.registra()
    conto = _conto(api, headers)
    tx = api.post(
        "/transazioni",
        json={
            "importo": 20,
            "tipo": "USCITA",
            "data": str(date.today()),
            "conto_id": conto["id"],
        },
        headers=headers,
    ).json()

    with _SelectSuiConti(api.session_factory) as spia:
        r = api.put(
            f"/transazioni/{tx['id']}",
            json={
                "importo": 25,
                "tipo": "USCITA",
                "data": str(date.today()),
                "conto_id": conto["id"],
            },
            headers=headers,
        )
    assert r.status_code == 200, r.text
    assert spia.lock and spia.lock[0], spia.lock

    with _SelectSuiConti(api.session_factory) as spia:
        r = api.delete(f"/transazioni/{tx['id']}", headers=headers)
    assert r.status_code == 200, r.text
    assert spia.lock and spia.lock[0], spia.lock


def test_pagare_un_debito_blocca_il_conto(api):
    headers = api.registra()
    conto = _conto(api, headers)
    debito = api.post(
        "/debiti", json={"nome": "Prestito", "ammontare": 500}, headers=headers
    ).json()

    with _SelectSuiConti(api.session_factory) as spia:
        r = api.post(
            f"/debiti/{debito['id']}/pay",
            json={"importo": 80, "conto_id": conto["id"]},
            headers=headers,
        )

    assert r.status_code == 200, r.text
    assert spia.lock and all(spia.lock), spia.lock
