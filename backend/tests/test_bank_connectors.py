"""Connettore bancario e import dell'estratto conto: tassonomia scoped, file con
un tetto, sync che non si ferma al primo conto rotto.

L'Open Banking oggi non è in uso, ma questi percorsi restano raggiungibili: devono
comportarsi bene quando lo si riaccende.
"""

import io

import pytest

import models
import services
from services import task_sync_bank_connectors


def _conto(api, headers, nome="Banca"):
    r = api.post("/conti", json={"nome": nome, "saldo": 100}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _imposta_provider(api, conto_id, provider):
    db = api.session_factory()
    db.get(models.Conto, conto_id).bank_connector_provider = provider
    db.commit()
    db.close()


def _proposte(api, conto_id):
    db = api.session_factory()
    try:
        return (
            db.query(models.BankTransactionProposal)
            .filter(models.BankTransactionProposal.conto_id == conto_id)
            .order_by(models.BankTransactionProposal.id)
            .all()
        )
    finally:
        db.close()


def test_la_sync_non_si_ferma_a_un_conto_rotto(api):
    headers = api.registra()
    rotto = _conto(api, headers, "Rotto")
    buono = _conto(api, headers, "Buono")
    _imposta_provider(api, rotto["id"], "PROVIDER_INESISTENTE")
    _imposta_provider(api, buono["id"], "MOCK")

    task_sync_bank_connectors()

    assert len(_proposte(api, buono["id"])) == 3
    db = api.session_factory()
    assert "Unsupported" in db.get(models.Conto, rotto["id"]).bank_connector_last_error
    assert db.get(models.Conto, buono["id"]).bank_connector_last_error is None
    db.close()


def test_import_proposta_con_categoria_altrui_rifiutato(api):
    mario = api.registra("mario")
    luigi = api.registra("luigi")
    conto = _conto(api, mario)
    _imposta_provider(api, conto["id"], "MOCK")
    task_sync_bank_connectors()
    proposta = _proposte(api, conto["id"])[0]

    sua = api.post("/categorie", json={"nome": "Di Luigi"}, headers=luigi).json()
    mia = api.post("/categorie", json={"nome": "Mia"}, headers=mario).json()
    url = f"/conti/{conto['id']}/bank-connector/proposals/{proposta.id}/import"

    r = api.post(url, json={"categoria_id": sua["id"]}, headers=mario)
    assert r.status_code == 400, r.text

    r = api.post(url, json={"categoria_id": mia["id"]}, headers=mario)
    assert r.status_code == 200, r.text
    assert str(r.json()["categoria_id"]) == str(mia["id"])


def test_estratto_conto_troppo_grande_rifiutato(api):
    headers = api.registra()
    conto = _conto(api, headers)
    grosso = io.BytesIO(b"x" * (5 * 1024 * 1024 + 1))

    r = api.post(
        f"/conti/{conto['id']}/bank-connector/import-statement",
        files={"file": ("estratto.csv", grosso, "text/csv")},
        headers=headers,
    )

    assert r.status_code == 413, r.text


def test_foglio_con_troppe_righe_rifiutato(monkeypatch):
    openpyxl = pytest.importorskip("openpyxl")
    monkeypatch.setattr(services, "MAX_STATEMENT_ROWS", 2)
    wb = openpyxl.Workbook()
    for i in range(5):
        wb.active.append([f"2026-10-0{i + 1}", "Spesa", -10])
    buf = io.BytesIO()
    wb.save(buf)

    with pytest.raises(ValueError, match="righe"):
        services._read_xlsx_rows(buf.getvalue())
