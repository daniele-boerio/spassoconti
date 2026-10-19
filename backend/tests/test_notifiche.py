"""Notifiche push: iscrizione dei dispositivi, invio, job dei budget e dei promemoria.

`webpush` è sostituito da un finto che registra le chiamate: il test verifica
cosa partirebbe e verso chi, non il servizio push di Apple o Google.
"""

from datetime import date, timedelta
from decimal import Decimal
import json

import pytest
from pywebpush import WebPushException

import models
import services
from scripts.genera_chiavi_vapid import genera

ENDPOINT = "https://push.example.com/abc"
CHIAVI = {"p256dh": "BPubblica", "auth": "segreto"}


class _Risposta:
    def __init__(self, status_code):
        self.status_code = status_code


class _Inviate(list):
    """Le notifiche partite; `risposte` fa rifiutare un endpoint con uno status."""

    risposte: dict


@pytest.fixture()
def inviate(monkeypatch):
    privata, pubblica = genera()
    monkeypatch.setenv("VAPID_PRIVATE_KEY", privata)
    monkeypatch.setenv("VAPID_PUBLIC_KEY", pubblica)
    chiamate = _Inviate()
    chiamate.risposte = {}

    def finto_webpush(subscription_info, data, **kwargs):
        stato = chiamate.risposte.get(subscription_info["endpoint"])
        if stato:
            raise WebPushException("rifiutata", response=_Risposta(stato))
        chiamate.append({"endpoint": subscription_info["endpoint"], **json.loads(data)})

    monkeypatch.setattr(services, "webpush", finto_webpush)
    return chiamate


def _iscrivi(api, headers, endpoint=ENDPOINT):
    r = api.post(
        "/notifiche/dispositivi", json={"endpoint": endpoint, "keys": CHIAVI}, headers=headers
    )
    assert r.status_code == 200, r.text
    return r.json()


def _user_id(api, username="mario"):
    db = api.session_factory()
    try:
        return db.query(models.User).filter(models.User.username == username).one().id
    finally:
        db.close()


def _spesa(api, user_id, importo, categoria_id=None, giorno=None):
    db = api.session_factory()
    try:
        db.add(
            models.Transazione(
                importo=Decimal(importo),
                importo_netto=Decimal(importo),
                tipo="USCITA",
                data=giorno or date.today(),
                user_id=user_id,
                categoria_id=categoria_id,
            )
        )
        db.commit()
    finally:
        db.close()


def test_senza_chiavi_vapid_le_notifiche_sono_spente(api, monkeypatch):
    monkeypatch.delenv("VAPID_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("VAPID_PUBLIC_KEY", raising=False)
    headers = api.registra()

    stato = api.get("/notifiche", headers=headers).json()
    assert stato["disponibili"] is False
    assert stato["vapid_public_key"] is None

    r = api.post(
        "/notifiche/dispositivi", json={"endpoint": ENDPOINT, "keys": CHIAVI}, headers=headers
    )
    assert r.status_code == 503


def test_iscrizione_idempotente_e_rimozione(api, inviate):
    headers = api.registra()

    assert _iscrivi(api, headers)["dispositivi"] == 1
    # Il FE la ripete a ogni avvio: niente doppioni.
    assert _iscrivi(api, headers)["dispositivi"] == 1

    r = api.request("DELETE", "/notifiche/dispositivi", json={"endpoint": ENDPOINT}, headers=headers)
    assert r.status_code == 200
    assert r.json()["dispositivi"] == 0


def test_lo_stesso_telefono_passa_al_nuovo_account(api, inviate):
    mario = api.registra("mario")
    luigi = api.registra("luigi")

    _iscrivi(api, mario)
    _iscrivi(api, luigi)

    assert api.get("/notifiche", headers=mario).json()["dispositivi"] == 0
    assert api.get("/notifiche", headers=luigi).json()["dispositivi"] == 1


def test_endpoint_non_https_rifiutato(api, inviate):
    headers = api.registra()
    r = api.post(
        "/notifiche/dispositivi",
        json={"endpoint": "http://127.0.0.1/interno", "keys": CHIAVI},
        headers=headers,
    )
    assert r.status_code == 400


def test_prova_e_dispositivo_disiscritto(api, inviate):
    headers = api.registra()
    _iscrivi(api, headers)
    _iscrivi(api, headers, "https://push.example.com/vecchio")
    inviate.risposte["https://push.example.com/vecchio"] = 410

    r = api.post("/notifiche/prova", headers=headers)

    assert r.json() == {"inviate": 1}
    assert [c["endpoint"] for c in inviate] == [ENDPOINT]
    # Il 410 dice che il dispositivo non c'è più: si toglie da solo.
    assert api.get("/notifiche", headers=headers).json()["dispositivi"] == 1


def test_preferenze_aggiornamento_parziale(api, inviate):
    headers = api.registra()

    r = api.put("/notifiche/preferenze", json={"budget": False}, headers=headers)

    assert r.json()["budget"] is False
    assert r.json()["ricorrenze"] is True


def test_budget_avvisa_una_volta_per_soglia(api, inviate):
    headers = api.registra()
    _iscrivi(api, headers)
    uid = _user_id(api)
    api.put("/monthlyBudget", json={"monthly_spending_budget": "100"}, headers=headers)

    _spesa(api, uid, "85")
    services.task_notifiche_budget()
    services.task_notifiche_budget()

    assert [c["title"] for c in inviate] == ["Budget del mese quasi finito"]
    assert inviate[0]["body"] == "Hai speso 85,00 € su 100,00 €."
    assert inviate[0]["url"] == "/analysis"

    _spesa(api, uid, "30")
    services.task_notifiche_budget()
    services.task_notifiche_budget()

    assert [c["title"] for c in inviate] == [
        "Budget del mese quasi finito",
        "Budget del mese superato",
    ]


def test_budget_di_categoria_e_mese_precedente_ignorato(api, inviate):
    headers = api.registra()
    _iscrivi(api, headers)
    uid = _user_id(api)
    db = api.session_factory()
    try:
        spesa = models.Categoria(nome="Spesa", user_id=uid, budget_mensile=Decimal("200"))
        db.add(spesa)
        db.commit()
        categoria_id = spesa.id
    finally:
        db.close()

    _spesa(api, uid, "500", categoria_id, giorno=date.today().replace(day=1) - timedelta(days=1))
    _spesa(api, uid, "250", categoria_id)
    services.task_notifiche_budget()

    assert [c["title"] for c in inviate] == ["Budget Spesa superato"]
    assert inviate[0]["body"] == "Hai speso 250,00 € su 200,00 €."


def test_budget_con_preferenza_spenta_non_avvisa(api, inviate):
    headers = api.registra()
    _iscrivi(api, headers)
    api.put("/notifiche/preferenze", json={"budget": False}, headers=headers)
    api.put("/monthlyBudget", json={"monthly_spending_budget": "10"}, headers=headers)
    _spesa(api, _user_id(api), "50")

    services.task_notifiche_budget()

    assert inviate == []


def test_promemoria_ricorrenze(api, inviate):
    headers = api.registra()
    _iscrivi(api, headers)
    uid = _user_id(api)
    oggi = date.today()
    db = api.session_factory()
    try:
        for nome, importo, quando, variabile in (
            ("Affitto", "650", oggi + timedelta(days=1), False),
            ("Netflix", "12.99", oggi + timedelta(days=1), False),
            ("Palestra", "40", oggi + timedelta(days=5), False),
            ("Bolletta luce", "0", oggi, True),
        ):
            db.add(
                models.Ricorrenza(
                    nome=nome,
                    importo=Decimal(importo),
                    tipo="USCITA",
                    frequenza="MENSILE",
                    prossima_esecuzione=quando,
                    importo_variabile=variabile,
                    attiva=True,
                    user_id=uid,
                )
            )
        db.commit()
    finally:
        db.close()

    services.task_promemoria_ricorrenze()
    services.task_promemoria_ricorrenze()

    assert [(c["title"], c["body"]) for c in inviate] == [
        ("Domani 2 uscite ricorrenti", "Affitto, Netflix: 662,99 € in tutto."),
        ("Importo da confermare", "Bolletta luce: scrivi l'importo per registrarla."),
    ]
