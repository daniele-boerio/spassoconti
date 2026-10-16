"""I percorsi che la misura della copertura ha trovato scoperti: modificare ed
eliminare movimenti (anche giroconti e rimborsi), dividerli, e aggiornare o
cancellare ricorrenze e debiti.

Ogni test sui soldi finisce con la verifica dei saldi vuota: un percorso che
sposta un saldo senza rispettare la regola di `applica_effetto_saldo` si vede lì.
"""

from datetime import date, timedelta
from decimal import Decimal


def _conto(api, headers, nome="A", saldo=1000):
    r = api.post("/conti", json={"nome": nome, "saldo": saldo}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _tx(api, headers, conto, **campi):
    payload = {
        "importo": 30,
        "tipo": "USCITA",
        "data": str(date.today()),
        "conto_id": conto["id"],
        **campi,
    }
    r = api.post("/transazioni", json=payload, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _put_tx(api, headers, tx_id, **campi):
    r = api.put(f"/transazioni/{tx_id}", json=campi, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _saldi(api, headers):
    return {
        c["id"]: Decimal(c["saldo"])
        for c in api.get("/conti", headers=headers).json()
        if c.get("deleted_at") is None
    }


def _di(saldi, *conti):
    """I saldi dei conti dati (alla registrazione c'è anche il conto invisibile)."""
    return tuple(saldi[c["id"]] for c in conti)


def _verifica_pulita(api, headers):
    r = api.get("/conti/verifica-saldi", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == [], r.json()


# --- Modificare un movimento ---------------------------------------------------


def test_modificare_importo_e_conto_sposta_i_soldi_giusti(api):
    h = api.registra()
    a, b = _conto(api, h, "A"), _conto(api, h, "B")
    tx = _tx(api, h, a, importo=30)

    _put_tx(
        api, h, tx["id"], importo=50, tipo="USCITA", data=tx["data"], conto_id=b["id"]
    )

    saldi = _saldi(api, h)
    assert saldi[a["id"]] == Decimal("1000.00")  # l'uscita è stata stornata da A
    assert saldi[b["id"]] == Decimal("950.00")  # e applicata a B con l'importo nuovo
    _verifica_pulita(api, h)


def test_cambiare_tipo_da_uscita_a_entrata_ribalta_il_segno(api):
    h = api.registra()
    a = _conto(api, h)
    tx = _tx(api, h, a, importo=30)

    _put_tx(api, h, tx["id"], importo=30, tipo="ENTRATA", data=tx["data"], conto_id=a["id"])

    assert _saldi(api, h)[a["id"]] == Decimal("1030.00")
    _verifica_pulita(api, h)


def test_giroconto_modificato_e_poi_eliminato(api):
    h = api.registra()
    a, b = _conto(api, h, "A"), _conto(api, h, "B")
    giro = _tx(api, h, a, importo=100, tipo="RICARICA", conto_destinazione_id=b["id"])
    assert _di(_saldi(api, h), a, b) == (Decimal("900.00"), Decimal("1100.00"))

    _put_tx(
        api,
        h,
        giro["id"],
        importo=40,
        tipo="RICARICA",
        data=giro["data"],
        conto_id=a["id"],
        conto_destinazione_id=b["id"],
    )
    assert _di(_saldi(api, h), a, b) == (Decimal("960.00"), Decimal("1040.00"))

    assert api.delete(f"/transazioni/{giro['id']}", headers=h).status_code == 200
    assert _di(_saldi(api, h), a, b) == (Decimal("1000.00"), Decimal("1000.00"))
    _verifica_pulita(api, h)


def test_eliminare_una_spesa_con_rimborso_storna_anche_il_rimborso(api):
    h = api.registra()
    a = _conto(api, h)
    spesa = _tx(api, h, a, importo=100)
    _tx(api, h, a, importo=40, tipo="RIMBORSO", parent_transaction_id=spesa["id"])
    assert _saldi(api, h)[a["id"]] == Decimal("940.00")

    assert api.delete(f"/transazioni/{spesa['id']}", headers=h).status_code == 200

    # Né la spesa né il suo rimborso pesano più sul conto
    assert _saldi(api, h)[a["id"]] == Decimal("1000.00")
    _verifica_pulita(api, h)


def test_non_si_modifica_ne_si_elimina_il_movimento_di_un_altro(api):
    mario, luigi = api.registra("mario"), api.registra("luigi")
    conto_mario = _conto(api, mario)
    tx = _tx(api, mario, conto_mario)
    conto_luigi = _conto(api, luigi)

    r = api.put(
        f"/transazioni/{tx['id']}",
        json={"importo": 1, "tipo": "USCITA", "data": tx["data"], "conto_id": conto_luigi["id"]},
        headers=luigi,
    )
    assert r.status_code == 404
    assert api.delete(f"/transazioni/{tx['id']}", headers=luigi).status_code == 404
    assert _saldi(api, mario)[conto_mario["id"]] == Decimal("970.00")


# --- Dividere un movimento ------------------------------------------------------


def test_dividere_una_spesa_non_cambia_il_saldo(api):
    h = api.registra()
    a = _conto(api, h)
    spesa = _tx(api, h, a, importo=90)

    r = api.post(
        f"/transazioni/{spesa['id']}/split",
        json={"parts": [{"importo": 60}, {"importo": 30}]},
        headers=h,
    )

    assert r.status_code == 200, r.text
    assert sorted(Decimal(p["importo"]) for p in r.json()) == [Decimal("30.00"), Decimal("60.00")]
    assert _saldi(api, h)[a["id"]] == Decimal("910.00")
    _verifica_pulita(api, h)


# --- Ricorrenze -----------------------------------------------------------------


def _ricorrenza(api, headers, conto, **campi):
    payload = {
        "nome": "Affitto",
        "importo": 650,
        "tipo": "USCITA",
        "frequenza": "MENSILE",
        "prossima_esecuzione": str(date.today() + timedelta(days=5)),
        "attiva": True,
        "conto_id": conto["id"],
        **campi,
    }
    r = api.post("/ricorrenze", json=payload, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_modificare_e_cancellare_una_ricorrenza(api):
    h = api.registra()
    conto = _conto(api, h)
    ric = _ricorrenza(api, h, conto)

    r = api.put(f"/ricorrenze/{ric['id']}", json={"importo": 700, "attiva": False}, headers=h)
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["importo"]) == Decimal("700.00")
    assert r.json()["attiva"] is False

    assert api.delete(f"/ricorrenze/{ric['id']}", headers=h).status_code == 204
    ids = [x["id"] for x in api.get("/ricorrenze", headers=h).json()]
    assert ric["id"] not in ids
    # Cancellare una ricorrenza non tocca il saldo
    assert _saldi(api, h)[conto["id"]] == Decimal("1000.00")


def test_ricorrenza_di_un_altro_utente_intoccabile(api):
    mario, luigi = api.registra("mario"), api.registra("luigi")
    ric = _ricorrenza(api, mario, _conto(api, mario))

    assert api.put(f"/ricorrenze/{ric['id']}", json={"importo": 1}, headers=luigi).status_code == 404
    assert api.delete(f"/ricorrenze/{ric['id']}", headers=luigi).status_code == 404


# --- Debiti ---------------------------------------------------------------------


def _debito(api, headers, ammontare=500):
    r = api.post("/debiti", json={"nome": "Prestito", "ammontare": ammontare}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_abbassare_l_ammontare_riporta_il_residuo_entro_il_totale(api):
    h = api.registra()
    debito = _debito(api, h, 500)

    r = api.put(f"/debiti/{debito['id']}", json={"ammontare": 300}, headers=h)

    assert r.status_code == 200, r.text
    assert Decimal(r.json()["residuo"]) == Decimal("300.00")


def test_cancellare_un_debito_aperto_richiede_force(api):
    h = api.registra()
    debito = _debito(api, h)

    assert api.delete(f"/debiti/{debito['id']}", headers=h).status_code == 400
    assert api.delete(f"/debiti/{debito['id']}?force=true", headers=h).status_code == 200
    assert api.delete(f"/debiti/{debito['id']}?force=true", headers=h).status_code == 404


def test_debito_di_un_altro_utente_intoccabile(api):
    mario, luigi = api.registra("mario"), api.registra("luigi")
    debito = _debito(api, mario)

    assert api.put(f"/debiti/{debito['id']}", json={"nome": "x"}, headers=luigi).status_code == 404
    assert api.delete(f"/debiti/{debito['id']}?force=true", headers=luigi).status_code == 404


def _residuo(api, headers, debito_id):
    debiti = api.get("/debiti", headers=headers).json()
    return Decimal(next(d for d in debiti if d["id"] == debito_id)["residuo"])


def test_il_residuo_del_debito_segue_il_movimento_collegato(api):
    """Una rata pagata e poi corretta: il residuo deve scendere dell'importo nuovo,
    e tornare intero se la rata viene eliminata o spostata su un altro debito."""
    h = api.registra()
    conto = _conto(api, h)
    prestito, mutuo = _debito(api, h, 500), _debito(api, h, 800)
    rata = _tx(api, h, conto, importo=100, debito_id=prestito["id"])
    assert _residuo(api, h, prestito["id"]) == Decimal("400.00")

    # Corretta a 150: il residuo scende di 150, non di 100 + 150
    _put_tx(
        api, h, rata["id"], importo=150, tipo="USCITA", data=rata["data"],
        conto_id=conto["id"], debito_id=prestito["id"],
    )
    assert _residuo(api, h, prestito["id"]) == Decimal("350.00")

    # Spostata sull'altro debito: il primo torna intero, il secondo scende
    _put_tx(
        api, h, rata["id"], importo=150, tipo="USCITA", data=rata["data"],
        conto_id=conto["id"], debito_id=mutuo["id"],
    )
    assert _residuo(api, h, prestito["id"]) == Decimal("500.00")
    assert _residuo(api, h, mutuo["id"]) == Decimal("650.00")

    # Eliminata: anche il secondo torna intero
    assert api.delete(f"/transazioni/{rata['id']}", headers=h).status_code == 200
    assert _residuo(api, h, mutuo["id"]) == Decimal("800.00")
    _verifica_pulita(api, h)
