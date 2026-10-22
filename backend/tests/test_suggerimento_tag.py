"""Tag proposto dalla descrizione: solo con un indizio ricorrente e coerente.

Copre la domanda al salvataggio (tag esistente / nuovo con anteprima), le
frasi normalizzate, il peso delle transazioni recenti, "Non chiederlo più",
l'interruttore delle Impostazioni e la pulizia in blocco.
"""


def _tag(api, headers, nome):
    r = api.post("/tags", headers=headers, json={"nome": nome})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _spesa(api, headers, descrizione, tag_id=None, data="2026-10-01"):
    conto_id = api.get("/conti", headers=headers).json()[0]["id"]
    r = api.post(
        "/transazioni",
        headers=headers,
        json={
            "importo": "10.00",
            "tipo": "USCITA",
            "data": data,
            "conto_id": conto_id,
            "descrizione": descrizione,
            "tag_id": tag_id,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _suggerimento(api, headers, descrizione):
    r = api.get("/tags/suggerimento", headers=headers, params={"descrizione": descrizione})
    assert r.status_code == 200, r.text
    return r.json()


def test_frase_ricorrente_propone_il_tag_esistente(api):
    h = api.registra("mario")
    amici = _tag(api, h, "amici")
    for d in ["cena con gaia", "cinema con Gaia", "aperitivo con gaia", "pizza con gaia"]:
        _spesa(api, h, d, amici)

    s = _suggerimento(api, h, "Sushi con Gaia")
    assert s["tipo"] == "esistente"
    assert s["tag_id"] == amici
    assert s["frase"] == "con Gaia"
    assert s["occorrenze"] == 4
    assert s["transazioni"] == []


def test_varianti_articoli_accenti_plurale(api):
    h = api.registra("mario")
    ufficio = _tag(api, h, "ufficio")
    _spesa(api, h, "pranzo con la Gaia", ufficio)
    _spesa(api, h, "caffè con Gaia", ufficio)
    _spesa(api, h, "snack col gaia", ufficio)
    # "con la Gaia" = "con gaia" = "col gaia"
    s = _suggerimento(api, h, "panino con gaia")
    assert s["tag_id"] == ufficio

    lavoro = _tag(api, h, "spese lavoro")
    for d in ["pranzo al lavoro", "caffè a lavoro", "taxi alla lavori"]:
        _spesa(api, h, d, lavoro)
    # "al lavoro" = "a lavoro" = "alla lavori": plurale e articolo non contano.
    s = _suggerimento(api, h, "Treno a Lavoro")
    assert s["tag_id"] == lavoro
    assert s["frase"] == "a Lavoro"


def test_nome_del_tag_nella_descrizione(api):
    h = api.registra("mario")
    gaia = _tag(api, h, "gaia")

    s = _suggerimento(api, h, "Cena con Gaia")
    assert s["tipo"] == "esistente"
    assert s["tag_id"] == gaia
    assert s["occorrenze"] == 0


def test_poche_volte_o_frase_ambigua_non_propongono(api):
    h = api.registra("mario")
    amici = _tag(api, h, "amici")
    lavoro = _tag(api, h, "lavoro")
    _spesa(api, h, "cena con gaia", amici)
    _spesa(api, h, "cinema con gaia", amici)
    assert _suggerimento(api, h, "pizza con gaia") is None

    # "pizza" con tag diversi o senza: nessun indizio.
    for tag_id in [amici, amici, amici, lavoro, None, None]:
        _spesa(api, h, "pizza", tag_id)
    assert _suggerimento(api, h, "pizza") is None
    assert _suggerimento(api, h, "a") is None


def test_tag_nuovo_con_anteprima(api):
    h = api.registra("mario")
    ids = [
        _spesa(api, h, d)
        for d in ["pizza con Paolo", "cena con paolo", "bar con Paolo"]
    ]
    _spesa(api, h, "benzina")

    s = _suggerimento(api, h, "Sushi con Paolo")
    assert s["tipo"] == "nuovo"
    assert s["tag_id"] is None
    assert s["nome"] == "paolo"
    assert s["frase"] == "con Paolo"
    assert s["occorrenze"] == 3
    assert sorted(t["id"] for t in s["transazioni"]) == sorted(ids)
    assert s["transazioni"][0]["importo"] == "10.00"


def test_applica_crea_il_tag_e_non_tocca_quelli_gia_taggati(api):
    h = api.registra("mario")
    amici = _tag(api, h, "amici")
    liberi = [_spesa(api, h, "pizza con paolo"), _spesa(api, h, "cena con paolo")]
    gia_taggata = _spesa(api, h, "bar con paolo", amici)

    luigi = api.registra("luigi")
    altrui = _spesa(api, luigi, "pizza con paolo")

    r = api.post(
        "/tags/applica",
        headers=h,
        json={"nome": "paolo", "transazione_ids": liberi + [gia_taggata, altrui]},
    )
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["aggiornate"] == 2
    assert corpo["tag"]["nome"] == "paolo"
    assert corpo["tag"]["n_transazioni"] == 2

    per_id = {t["id"]: t for t in api.get("/transazioni", headers=h).json()}
    assert str(per_id[gia_taggata]["tag_id"]) == str(amici)
    assert api.get("/transazioni", headers=luigi).json()[0]["tag_id"] is None

    # Un tag di un altro utente non si usa.
    r = api.post(
        "/tags/applica",
        headers=luigi,
        json={"tag_id": corpo["tag"]["id"], "transazione_ids": [altrui]},
    )
    assert r.status_code == 404


def test_non_chiederlo_piu(api):
    h = api.registra("mario")
    for d in ["pizza con paolo", "cena con paolo", "bar con paolo"]:
        _spesa(api, h, d)
    s = _suggerimento(api, h, "sushi con paolo")

    r = api.post(
        "/tags/proposte/rifiuta",
        headers=h,
        json={"chiave": s["chiave"], "nome": s["nome"]},
    )
    assert r.status_code == 204
    assert _suggerimento(api, h, "sushi con paolo") is None
    # Anche la pulizia in blocco non la ripropone.
    assert api.get("/tags/proposte", headers=h).json() == []


def test_le_abitudini_recenti_pesano_di_piu(api):
    h = api.registra("mario")
    amici = _tag(api, h, "amici")
    # Due anni fa "con gaia" era #amici; da qualche mese non ha più tag.
    for d in ["cena con gaia", "cinema con gaia", "bar con gaia"]:
        _spesa(api, h, d, amici, data="2024-09-01")
    for d in ["pizza con gaia", "sushi con gaia", "gelato con gaia"]:
        _spesa(api, h, d, data="2026-10-01")

    s = _suggerimento(api, h, "pranzo con gaia")
    assert s["tipo"] == "nuovo"
    assert s["nome"] == "gaia"


def test_interruttore_nelle_impostazioni(api):
    h = api.registra("mario")
    gaia = _tag(api, h, "gaia")
    assert api.get("/me", headers=h).json()["suggerimenti_tag"] is True

    r = api.put("/me/preferenze", headers=h, json={"suggerimenti_tag": False})
    assert r.status_code == 200
    assert r.json()["suggerimenti_tag"] is False
    assert _suggerimento(api, h, "cena con gaia") is None

    api.put("/me/preferenze", headers=h, json={"suggerimenti_tag": True})
    assert _suggerimento(api, h, "cena con gaia")["tag_id"] == gaia


def test_pulizia_in_blocco(api):
    h = api.registra("mario")
    lavoro = _tag(api, h, "lavoro")
    # Gruppo nuovo: "con paolo" quattro volte senza tag.
    for d in ["pizza con Paolo", "cena con paolo", "bar con paolo", "cinema con paolo"]:
        _spesa(api, h, d)
    # Gruppo verso un tag che esiste: "a lavoro" già usato con #lavoro.
    _spesa(api, h, "pranzo a lavoro", lavoro)
    _spesa(api, h, "caffè a lavoro", lavoro)
    for d in ["taxi a lavoro", "treno a lavoro", "snack a lavoro"]:
        _spesa(api, h, d)
    # Troppo poche: niente gruppo.
    _spesa(api, h, "regalo per mamma")

    proposte = api.get("/tags/proposte", headers=h).json()
    per_chiave = {p["chiave"]: p for p in proposte}
    assert set(per_chiave) == {"con paol", "a lavor"}

    paolo = per_chiave["con paol"]
    assert paolo["tipo"] == "nuovo"
    assert paolo["occorrenze"] == 4
    assert proposte[0]["chiave"] == "con paol"  # il gruppo più grosso prima

    gruppo_lavoro = per_chiave["a lavor"]
    assert gruppo_lavoro["tipo"] == "esistente"
    assert gruppo_lavoro["tag_id"] == lavoro
    assert gruppo_lavoro["occorrenze"] == 3


def test_la_storia_degli_altri_non_conta(api):
    mario = api.registra("mario")
    amici = _tag(api, mario, "amici")
    for d in ["cena con gaia", "cinema con gaia", "pizza con gaia"]:
        _spesa(api, mario, d, amici)

    luigi = api.registra("luigi")
    assert _suggerimento(api, luigi, "pizza con gaia") is None
    assert api.get("/tags/proposte", headers=luigi).json() == []
