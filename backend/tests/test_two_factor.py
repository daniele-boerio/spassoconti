"""Verifica in due passaggi: attivazione, login in due tempi, codici di recupero.

Il punto delicato è che la password giusta, da sola, non apra più la sessione:
né via /login (niente access token, niente cookie) né riusando il token del
primo passo come access token.
"""

import time

import pyotp

import models


def _codice(segreto: str, passi_avanti: int = 0) -> str:
    return pyotp.TOTP(segreto).at(time.time() + 30 * passi_avanti)


def _attiva(api, headers):
    setup = api.post("/auth/2fa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    segreto = setup.json()["secret"]
    assert setup.json()["otpauth_uri"].startswith("otpauth://totp/SpassoConti")

    enable = api.post("/auth/2fa/enable", json={"code": _codice(segreto)}, headers=headers)
    assert enable.status_code == 200, enable.text
    return segreto, enable.json()["recovery_codes"]


def _login(api, username="mario"):
    api.cookies.clear()
    return api.post("/login", data={"username": username, "password": "password123"})


def test_attivazione_restituisce_i_codici_di_recupero(api):
    headers = api.registra()
    assert api.get("/auth/2fa", headers=headers).json() == {
        "enabled": False,
        "recovery_codes_remaining": 0,
    }

    _, codici = _attiva(api, headers)

    assert len(codici) == 10
    assert len(set(codici)) == 10
    assert api.get("/auth/2fa", headers=headers).json() == {
        "enabled": True,
        "recovery_codes_remaining": 10,
    }


def test_il_segreto_non_e_salvato_in_chiaro(api):
    headers = api.registra()
    segreto, _ = _attiva(api, headers)

    db = api.session_factory()
    try:
        salvato = db.query(models.User).one().totp_secret
    finally:
        db.close()
    assert salvato and segreto not in salvato


def test_attivazione_con_codice_sbagliato_non_attiva(api):
    headers = api.registra()
    api.post("/auth/2fa/setup", headers=headers)

    r = api.post("/auth/2fa/enable", json={"code": "000000"}, headers=headers)

    # 400 e non 401: per il FE un 401 vuol dire "sessione scaduta".
    assert r.status_code == 400
    assert api.get("/auth/2fa", headers=headers).json()["enabled"] is False


def test_login_con_2fa_non_apre_la_sessione_senza_codice(api):
    headers = api.registra()
    _attiva(api, headers)

    login = _login(api)

    assert login.status_code == 200
    corpo = login.json()
    assert corpo["mfa_required"] is True
    assert corpo["access_token"] is None
    assert corpo["mfa_token"]
    assert "refresh_token=" not in login.headers.get("set-cookie", "")


def test_il_token_del_primo_passo_non_vale_come_access_token(api):
    headers = api.registra()
    _attiva(api, headers)
    mfa_token = _login(api).json()["mfa_token"]

    r = api.get("/me", headers={"Authorization": f"Bearer {mfa_token}"})

    assert r.status_code == 401


def test_secondo_passo_con_il_codice_apre_la_sessione(api):
    headers = api.registra()
    segreto, _ = _attiva(api, headers)
    mfa_token = _login(api).json()["mfa_token"]

    sbagliato = api.post("/auth/2fa/verify", json={"mfa_token": mfa_token, "code": "123456"})
    assert sbagliato.status_code == 400

    # Il codice usato per attivare è bruciato: serve quello dell'intervallo dopo.
    r = api.post(
        "/auth/2fa/verify", json={"mfa_token": mfa_token, "code": _codice(segreto, 1)}
    )

    assert r.status_code == 200, r.text
    assert r.json()["access_token"]
    assert "refresh_token=" in r.headers.get("set-cookie", "")
    me = api.get("/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert me.status_code == 200


def test_lo_stesso_codice_non_vale_due_volte(api):
    headers = api.registra()
    segreto, _ = _attiva(api, headers)
    codice = _codice(segreto, 1)

    primo = api.post(
        "/auth/2fa/verify", json={"mfa_token": _login(api).json()["mfa_token"], "code": codice}
    )
    secondo = api.post(
        "/auth/2fa/verify", json={"mfa_token": _login(api).json()["mfa_token"], "code": codice}
    )

    assert primo.status_code == 200
    assert secondo.status_code == 400


def test_codice_di_recupero_vale_una_volta(api):
    headers = api.registra()
    _, codici = _attiva(api, headers)

    # Maiuscole e senza trattino: si accetta come l'utente lo scrive.
    scritto = codici[0].replace("-", "").upper()
    primo = api.post(
        "/auth/2fa/verify", json={"mfa_token": _login(api).json()["mfa_token"], "code": scritto}
    )
    secondo = api.post(
        "/auth/2fa/verify", json={"mfa_token": _login(api).json()["mfa_token"], "code": codici[0]}
    )

    assert primo.status_code == 200
    assert secondo.status_code == 400
    token = primo.json()["access_token"]
    stato = api.get("/auth/2fa", headers={"Authorization": f"Bearer {token}"}).json()
    assert stato["recovery_codes_remaining"] == 9


def test_logout_ovunque_invalida_il_token_del_primo_passo(api):
    headers = api.registra()
    segreto, _ = _attiva(api, headers)
    mfa_token = _login(api).json()["mfa_token"]

    api.post("/auth/logout-all", headers=headers)
    r = api.post(
        "/auth/2fa/verify", json={"mfa_token": mfa_token, "code": _codice(segreto, 1)}
    )

    assert r.status_code == 401


def test_disattivazione_chiede_password_e_codice(api):
    headers = api.registra()
    segreto, codici = _attiva(api, headers)

    senza_password = api.post(
        "/auth/2fa/disable",
        json={"password": "sbagliata", "code": _codice(segreto, 1)},
        headers=headers,
    )
    assert senza_password.status_code == 400

    r = api.post(
        "/auth/2fa/disable",
        json={"password": "password123", "code": codici[0]},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json() == {"enabled": False, "recovery_codes_remaining": 0}

    # Di nuovo login in un passo solo.
    assert _login(api).json()["access_token"]


def test_rigenerare_i_codici_invalida_i_vecchi(api):
    headers = api.registra()
    segreto, vecchi = _attiva(api, headers)

    r = api.post(
        "/auth/2fa/recovery-codes", json={"code": _codice(segreto, 1)}, headers=headers
    )
    assert r.status_code == 200
    nuovi = r.json()["recovery_codes"]
    assert len(nuovi) == 10 and not set(nuovi) & set(vecchi)

    vecchio = api.post(
        "/auth/2fa/verify", json={"mfa_token": _login(api).json()["mfa_token"], "code": vecchi[1]}
    )
    assert vecchio.status_code == 400
