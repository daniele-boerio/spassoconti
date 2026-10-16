"""Input con limiti, reset password senza segreti in chiaro, avvio che non parte
con la configurazione incompleta, aggiornamenti "di servizio" scoped per utente.
"""

import pytest

import main
import models
from routers import auth as auth_router
from routers.transazioni import update_category_usage


# --- Paginazione e ordinamento ------------------------------------------------


def test_paginazione_rifiuta_pagine_e_dimensioni_assurde(api):
    headers = api.registra()

    assert api.get("/transazioni/paginated?page=0", headers=headers).status_code == 422
    assert (
        api.get("/transazioni/paginated?size=100000", headers=headers).status_code
        == 422
    )
    assert api.get("/transazioni/paginated?size=25", headers=headers).status_code == 200


def test_sort_by_su_un_campo_che_non_e_una_colonna_non_va_in_500(api):
    headers = api.registra()

    for campo in ("user", "metadata", "registry", "inesistente"):
        r = api.get(f"/transazioni/paginated?sort_by={campo}:desc", headers=headers)
        assert r.status_code == 200, (campo, r.text)


def test_la_ricerca_testuale_cerca_i_jolly_alla_lettera(api):
    headers = api.registra()
    conto = api.post(
        "/conti", json={"nome": "Principale", "saldo": 100}, headers=headers
    ).json()
    for descrizione in ("sconto 100%", "spesa"):
        api.post(
            "/transazioni",
            json={
                "importo": 1,
                "tipo": "USCITA",
                "data": "2026-10-01",
                "conto_id": conto["id"],
                "descrizione": descrizione,
            },
            headers=headers,
        )

    r = api.get("/transazioni/paginated?descrizione=%25", headers=headers)

    assert [t["descrizione"] for t in r.json()["data"]] == ["sconto 100%"]


# --- Reset password -------------------------------------------------------------


@pytest.fixture()
def link_inviati(monkeypatch):
    inviati = []
    monkeypatch.setattr(
        auth_router, "send_reset_email", lambda email, link: inviati.append(link)
    )
    return inviati


def test_reset_password_salva_solo_l_impronta_del_token(api, link_inviati):
    api.registra("mario")

    # Maiuscole nell'email: in DB è salvata in minuscolo
    r = api.post("/auth/forgot-password", json={"email": "Mario@Example.it"})
    assert r.status_code == 200
    assert len(link_inviati) == 1
    token = link_inviati[0].split("token=")[1]

    db = api.session_factory()
    user = db.query(models.User).filter(models.User.username == "mario").one()
    assert user.reset_token != token  # in DB solo lo SHA-256
    assert user.reset_token == auth_router._hash_reset_token(token)
    db.close()

    r = api.post(
        "/auth/reset-password", json={"token": token, "new_password": "nuova-password-1"}
    )
    assert r.status_code == 200, r.text

    # Il token è monouso
    r = api.post(
        "/auth/reset-password", json={"token": token, "new_password": "altra-password-2"}
    )
    assert r.status_code == 400


def test_senza_smtp_in_produzione_il_link_non_finisce_nei_log(monkeypatch, caplog):
    for nome in ("SMTP_SERVER", "SMTP_USERNAME", "SMTP_PASSWORD"):
        monkeypatch.delenv(nome, raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")

    auth_router.send_reset_email("a@b.it", "https://x/reset-password?token=SEGRETO")

    assert "SEGRETO" not in caplog.text
    assert "NON inviata" in caplog.text


# --- Configurazione all'avvio ---------------------------------------------------


@pytest.fixture()
def config_completa(monkeypatch):
    valori = {
        "DB_USER": "u",
        "DB_PASSWORD": "p",
        "DB_HOST": "h",
        "DB_PORT": "5432",
        "DB_NAME": "d",
        "SECRET_KEY": "x" * 40,
        "ALGORITHM": "HS256",
        "FRONTEND_URL": "https://conti.example",
    }
    for nome, valore in valori.items():
        monkeypatch.setenv(nome, valore)
    return monkeypatch


def test_configurazione_completa_passa(config_completa):
    main.verifica_configurazione()


def test_variabile_mancante_ferma_l_avvio(config_completa):
    config_completa.delenv("SECRET_KEY")

    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        main.verifica_configurazione()


def test_algoritmo_jwt_sconosciuto_ferma_l_avvio(config_completa):
    config_completa.setenv("ALGORITHM", "none")

    with pytest.raises(RuntimeError, match="ALGORITHM"):
        main.verifica_configurazione()


# --- Aggiornamenti di servizio scoped per utente ------------------------------


def test_update_category_usage_non_tocca_categorie_altrui(db_session):
    altro = models.User(username="altro", email="altro@x.it", hashed_password="x")
    io = models.User(username="io", email="io@x.it", hashed_password="x")
    db_session.add_all([altro, io])
    db_session.flush()
    sua = models.Categoria(nome="Sua", user_id=altro.id)
    db_session.add(sua)
    db_session.commit()
    prima = sua.lastImport

    update_category_usage(db_session, io.id, sua.id)
    db_session.commit()
    db_session.refresh(sua)

    assert sua.lastImport == prima

    # Con il proprietario giusto invece si aggiorna
    update_category_usage(db_session, altro.id, sua.id)
    db_session.commit()
    db_session.refresh(sua)
    assert sua.lastImport != prima
