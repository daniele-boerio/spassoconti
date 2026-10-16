"""I job notturni lasciano traccia, e /api/health/jobs dice quando qualcosa non va.

Un job che fallisce di notte finiva solo nei log: qui si verifica che ogni giro
registri il suo esito in `job_runs` e che l'endpoint risponda 503 (e quindi il
monitor del mattino mandi la mail) quando un job è fallito, ha loggato errori, è
in ritardo, o quando la verifica saldi ha trovato conti sfasati.
"""

import logging
from datetime import datetime, timedelta, timezone

import pytest

import main
import models
import services
from services import task_verifica_saldi, traccia_job


@pytest.fixture(autouse=True)
def scheduler_acceso(monkeypatch):
    # In CI RUN_SCHEDULER=false: qui serve il comportamento di produzione.
    monkeypatch.setattr(main, "RUN_SCHEDULER", True)


def _conto(api, headers, saldo=1000):
    r = api.post("/conti", json={"nome": "Principale", "saldo": saldo}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _riga(api, nome):
    db = api.session_factory()
    try:
        return db.get(models.JobRun, nome)
    finally:
        db.close()


def test_mai_partiti_sono_in_attesa_non_un_guasto(api):
    r = api.get("/health/jobs")

    assert r.status_code == 200, r.text
    assert r.json()["jobs"]["verifica_saldi"] == {"esito": "in_attesa"}


def test_verifica_pulita_registra_ok_e_zero_problemi(api):
    headers = api.registra()
    _conto(api, headers)

    assert task_verifica_saldi() == 0

    riga = _riga(api, "verifica_saldi")
    assert (riga.esito, riga.errori, riga.problemi) == ("ok", 0, 0)
    assert api.get("/health/jobs").status_code == 200


def test_saldo_sfasato_fa_rispondere_503(api, caplog):
    headers = api.registra()
    conto = _conto(api, headers)
    task_verifica_saldi()  # prima foto della base

    db = api.session_factory()
    db.get(models.Conto, conto["id"]).saldo += 5  # soldi comparsi dal nulla
    db.commit()
    db.close()

    with caplog.at_level(logging.ERROR, logger="services"):
        assert task_verifica_saldi() == 1

    assert any("Saldo fuori sincrono" in m for m in caplog.messages)
    r = api.get("/health/jobs")
    assert r.status_code == 503, r.text
    assert "verifica_saldi: 1 da controllare" in r.json()["problemi"]


def test_job_che_solleva_risulta_fallito(api):
    @traccia_job("prova_fallito")
    def job():
        raise RuntimeError("boom")

    assert job() is None

    riga = _riga(api, "prova_fallito")
    assert (riga.esito, riga.messaggio) == ("fallito", "RuntimeError")


def test_job_che_logga_errori_risulta_con_errori(api):
    @traccia_job("prova_errori")
    def job():
        services.logger.error("una riga non è andata")
        return None

    job()

    riga = _riga(api, "prova_errori")
    assert (riga.esito, riga.errori) == ("errori", 1)


def test_job_fallito_o_in_ritardo_fa_rispondere_503(api):
    db = api.session_factory()
    db.merge(
        models.JobRun(
            nome="transazioni_ricorrenti",
            ultimo_avvio=datetime.now(timezone.utc) - timedelta(hours=30),
            esito="ok",
            errori=0,
        )
    )
    db.merge(
        models.JobRun(
            nome="ricarica_automatica",
            ultimo_avvio=datetime.now(timezone.utc),
            esito="fallito",
            errori=1,
        )
    )
    db.commit()
    db.close()

    r = api.get("/health/jobs")

    assert r.status_code == 503
    problemi = r.json()["problemi"]
    assert "transazioni_ricorrenti: in ritardo" in problemi
    assert "ricarica_automatica: fallito" in problemi


def test_scheduler_spento_non_segnala_niente(api, monkeypatch):
    monkeypatch.setattr(main, "RUN_SCHEDULER", False)

    r = api.get("/health/jobs")

    assert r.status_code == 200
    assert r.json()["scheduler"] == "disabled"
