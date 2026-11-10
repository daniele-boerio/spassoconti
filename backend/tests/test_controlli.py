"""Doppioni e quadrature: niente sposta saldi, tutto viene segnalato."""

from datetime import date, timedelta

import models
import services


def _conto(api, h, nome="Banca", saldo=100):
    r = api.post("/conti", json={"nome": nome, "saldo": saldo}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def _tx(api, h, conto, **campi):
    payload = {"importo": 15, "tipo": "USCITA", "data": "2026-05-28",
               "conto_id": conto["id"], "descrizione": "Parrucchiere", **campi}
    r = api.post("/transazioni", json=payload, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def test_doppioni_trovati_e_ignorati(api):
    h = api.registra("mario")
    conto = _conto(api, h)
    a = _tx(api, h, conto)
    b = _tx(api, h, conto, descrizione=" parrucchiere ")
    _tx(api, h, conto, importo=16)  # importo diverso: non è un doppione

    gruppi = api.get("/controlli/doppioni", headers=h).json()
    assert len(gruppi) == 1
    assert [t["id"] for t in gruppi[0]["transazioni"]] == [a["id"], b["id"]]
    assert gruppi[0]["importo"] == "15.00"

    r = api.post("/controlli/doppioni/ignora", json={"ids": [a["id"], b["id"]]}, headers=h)
    assert r.status_code == 204
    assert api.get("/controlli/doppioni", headers=h).json() == []


def test_doppioni_di_un_altro_utente_non_si_toccano(api):
    luigi = api.registra("luigi")
    conto = _conto(api, luigi)
    a = _tx(api, luigi, conto)
    _tx(api, luigi, conto)
    mario = api.registra("mario")
    assert api.get("/controlli/doppioni", headers=mario).json() == []
    api.post("/controlli/doppioni/ignora", json={"ids": [a["id"]]}, headers=mario)
    assert len(api.get("/controlli/doppioni", headers=luigi).json()) == 1


def test_simili_per_l_avviso_prima_di_salvare(api):
    h = api.registra("mario")
    conto = _conto(api, h)
    _tx(api, h, conto, descrizione="Penny con Gaia", importo=12)
    r = api.get("/controlli/simili", params={"data": "2026-05-28", "tipo": "USCITA", "importo": "12"}, headers=h)
    assert [t["descrizione"] for t in r.json()] == ["Penny con Gaia"]
    r = api.get("/controlli/simili", params={"data": "2026-05-29", "tipo": "USCITA", "importo": "12"}, headers=h)
    assert r.json() == []


def _quadra(api, h, conto, giorno, reale):
    r = api.post("/controlli/quadrature",
                 json={"conto_id": conto["id"], "data": str(giorno), "saldo_reale": reale}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def test_quadratura_confronta_con_la_precedente_e_non_sposta_il_saldo(api):
    h = api.registra("mario")
    conto = _conto(api, h, saldo=1000)
    oggi = date.today()

    # La prima è solo il punto di partenza: che l'app dica 1000 e il vero 1200 non conta.
    prima = _quadra(api, h, conto, oggi - timedelta(days=10), 1200)
    assert (prima["differenza"], prima["atteso"], prima["ultima"]) == (None, None, True)

    _tx(api, h, conto, importo=50, data=str(oggi - timedelta(days=5)), descrizione="Spesa")
    _tx(api, h, conto, importo=100, data=str(oggi), descrizione="Dopo")  # dopo la seconda: fuori dal periodo

    # Dal punto di partenza 1200 - 50 registrati = 1150 attesi, ma ieri c'erano 1140.
    q = _quadra(api, h, conto, oggi - timedelta(days=1), 1140)
    assert (q["movimenti_periodo"], q["atteso"], q["differenza"], q["ultima"]) == ("-50.00", "1150.00", "10.00", True)
    assert q["precedente_data"] == str(oggi - timedelta(days=10))
    elenco = api.get("/controlli/quadrature", headers=h).json()
    assert [x["id"] for x in elenco] == [q["id"], prima["id"]]
    assert elenco[1]["ultima"] is False
    assert api.get("/conti", headers=h).json()[0]["saldo"] == "850.00"  # le quadrature non toccano il saldo

    # L'uscita dimenticata, registrata con la sua data: i conti tornano.
    _tx(api, h, conto, importo=10, data=str(oggi - timedelta(days=3)), descrizione="Caffè")
    assert api.get("/controlli/quadrature", headers=h).json()[0]["differenza"] == "0.00"
    assert api.get("/conti/verifica-saldi", headers=h).json() == []

    assert api.delete(f"/controlli/quadrature/{q['id']}", headers=h).status_code == 204
    assert [x["id"] for x in api.get("/controlli/quadrature", headers=h).json()] == [prima["id"]]


def test_quadratura_validazioni(api):
    h = api.registra("mario")
    conto = _conto(api, h)
    domani = str(date.today() + timedelta(days=1))
    r = api.post("/controlli/quadrature", json={"conto_id": conto["id"], "data": domani, "saldo_reale": 1}, headers=h)
    assert r.status_code == 400
    altro = api.registra("luigi")
    r = api.post("/controlli/quadrature", json={"conto_id": conto["id"], "data": "2026-01-01", "saldo_reale": 1}, headers=altro)
    assert r.status_code == 404


def test_job_notturno_conta_doppioni_e_quadrature(api):
    h = api.registra("mario")
    conto = _conto(api, h, saldo=50)
    _tx(api, h, conto)
    _tx(api, h, conto)
    _quadra(api, h, conto, date.today() - timedelta(days=1), 50)  # solo il punto di partenza
    assert services.task_controllo_conti() == 1  # i doppioni
    _quadra(api, h, conto, date.today(), 50)  # 50 attesi, ma il 28/05 è prima: tornano
    assert services.task_controllo_conti() == 1
    _tx(api, h, conto, data=str(date.today()), descrizione="Oggi")
    assert services.task_controllo_conti() == 2  # ora mancano 15 € fra le due quadrature

    with api.session_factory() as db:
        riga = db.query(models.JobRun).filter(models.JobRun.nome == "controllo_conti").one()
        assert riga.problemi == 2
        assert riga.esito == "ok"
