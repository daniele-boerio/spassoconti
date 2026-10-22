"""Area admin: lista utenti, ban (accesso bloccato, sessioni chiuse, dati
conservati) e chiusura delle iscrizioni con REGISTRATION_ENABLED."""

from models import Transazione, User


def _login(api, username):
    return api.post("/login", data={"username": username, "password": "password123"})


def _admin(api, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "capo@example.it")
    return api.registra("capo")


def _id(api, username):
    with api.session_factory() as db:
        return db.query(User).filter(User.username == username).one().id


def test_solo_l_admin_vede_gli_utenti(api, monkeypatch):
    admin = _admin(api, monkeypatch)
    mario = api.registra("mario")

    assert api.get("/me", headers=admin).json()["is_admin"] is True
    assert api.get("/me", headers=mario).json()["is_admin"] is False

    r = api.get("/admin/users", headers=admin)
    assert r.status_code == 200
    righe = {u["username"]: u for u in r.json()}
    assert righe["mario"]["email"] == "mario@example.it"
    assert righe["mario"]["banned_at"] is None
    assert righe["capo"]["is_admin"] is True

    assert api.get("/admin/users", headers=mario).status_code == 403


def test_senza_admin_configurato_nessuno_entra(api, monkeypatch):
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("OPEN_BANKING_ADMIN_EMAIL", raising=False)
    mario = api.registra("mario")
    assert api.get("/admin/users", headers=mario).status_code == 403


def test_ban_chiude_le_sessioni_e_blocca_il_login(api, monkeypatch):
    admin = _admin(api, monkeypatch)
    mario = api.registra("mario")
    # Il cookie di refresh di mario (registrazione) va tenuto da parte: il
    # client lo sovrascriverebbe al login successivo.
    refresh_mario = api.cookies.get("refresh_token")
    api.cookies.clear()

    r = api.post(f"/admin/users/{_id(api, 'mario')}/ban", headers=admin)
    assert r.status_code == 200
    assert r.json()["banned_at"] is not None

    # Access token già emesso: non vale più.
    assert api.get("/me", headers=mario).status_code == 401
    # Refresh della sessione aperta: rifiutato.
    api.cookies.set("refresh_token", refresh_mario, path="/api/auth")
    assert api.post("/auth/refresh").status_code == 401
    api.cookies.clear()
    # Nuovo login con la password giusta: rifiutato.
    r = _login(api, "mario")
    assert r.status_code == 403
    assert "disabled" in r.json()["detail"]


def test_il_ban_non_cancella_i_dati_e_si_puo_togliere(api, monkeypatch):
    admin = _admin(api, monkeypatch)
    mario = api.registra("mario")
    conto_id = api.get("/conti", headers=mario).json()[0]["id"]
    r = api.post(
        "/transazioni",
        headers=mario,
        json={
            "importo": "12.50",
            "tipo": "USCITA",
            "data": "2026-10-01",
            "conto_id": conto_id,
            "descrizione": "pizza",
        },
    )
    assert r.status_code == 200, r.text
    mario_id = _id(api, "mario")

    api.post(f"/admin/users/{mario_id}/ban", headers=admin)
    with api.session_factory() as db:
        assert db.query(User).filter(User.id == mario_id).count() == 1
        assert db.query(Transazione).filter(Transazione.user_id == mario_id).count() == 1

    r = api.post(f"/admin/users/{mario_id}/unban", headers=admin)
    assert r.status_code == 200
    assert r.json()["banned_at"] is None
    r = _login(api, "mario")
    assert r.status_code == 200
    nuovo = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert len(api.get("/transazioni", headers=nuovo).json()) == 1


def test_l_admin_non_si_banna(api, monkeypatch):
    admin = _admin(api, monkeypatch)
    r = api.post(f"/admin/users/{_id(api, 'capo')}/ban", headers=admin)
    assert r.status_code == 400
    assert api.get("/me", headers=admin).status_code == 200


def test_utente_inesistente(api, monkeypatch):
    admin = _admin(api, monkeypatch)
    assert api.post("/admin/users/9999/ban", headers=admin).status_code == 404


def test_registrazione_chiusa_dal_flag(api, monkeypatch):
    api.registra("mario")
    monkeypatch.setenv("REGISTRATION_ENABLED", "false")

    assert api.get("/auth/registration").json() == {"enabled": False}
    r = api.post(
        "/register",
        json={"username": "luigi", "email": "luigi@example.it", "password": "password123"},
    )
    assert r.status_code == 403
    # Chi ha già un account entra lo stesso.
    assert _login(api, "mario").status_code == 200

    monkeypatch.setenv("REGISTRATION_ENABLED", "true")
    assert api.get("/auth/registration").json() == {"enabled": True}
