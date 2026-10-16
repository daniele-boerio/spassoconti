"""Le statistiche filtrano per intervallo di date (indicizzabile) invece che con
extract(): i confini devono restare quelli di prima.
"""


def _conto(api, headers):
    r = api.post("/conti", json={"nome": "Principale", "saldo": 1000}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _uscita(api, headers, conto, data, importo):
    r = api.post(
        "/transazioni",
        json={"importo": importo, "tipo": "USCITA", "data": data, "conto_id": conto["id"]},
        headers=headers,
    )
    assert r.status_code == 200, r.text


def test_anno_e_mese_contano_fino_all_ultimo_giorno_e_non_oltre(api):
    headers = api.registra()
    conto = _conto(api, headers)
    _uscita(api, headers, conto, "2025-12-31", 10)  # ultimo giorno dell'anno
    _uscita(api, headers, conto, "2026-01-01", 20)  # primo dell'anno dopo
    _uscita(api, headers, conto, "2025-11-30", 5)  # fine del mese prima

    anno = api.get("/statistics/yearDetails?year=2025", headers=headers).json()
    assert abs(float(anno["totale_uscita"])) == 15

    dicembre = api.get(
        "/statistics/monthDetails?year=2025&month=12", headers=headers
    ).json()
    assert abs(float(dicembre["totale_uscita"])) == 10

    gennaio = api.get("/statistics/monthDetails?year=2026&month=1", headers=headers).json()
    assert abs(float(gennaio["totale_uscita"])) == 20


def test_mese_fuori_range_rifiutato(api):
    headers = api.registra()

    r = api.get("/statistics/monthDetails?year=2026&month=13", headers=headers)

    assert r.status_code == 422
