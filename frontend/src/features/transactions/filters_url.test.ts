import { describe, it, expect } from "vitest";
import { decodeFilters, encodeFilters } from "./filters_url";
import { periodRange } from "./period";

describe("encodeFilters", () => {
  it("non scrive niente per la vista di partenza", () => {
    // Tutto il periodo e nessun filtro: l'URL resta pulito.
    expect(encodeFilters({ ...periodRange("all") }, "all").toString()).toBe("");
  });

  it("scrive il mese corrente, che è una scelta come le altre", () => {
    expect(encodeFilters({ ...periodRange("month") }, "month").get("periodo")).toBe(
      "month",
    );
  });

  it("scrive il periodo ma non le date che ne derivano", () => {
    const params = encodeFilters({ ...periodRange("year") }, "year");

    expect(params.get("periodo")).toBe("year");
    // Le date di un preset si ricalcolano: fissarle renderebbe il link scaduto.
    expect(params.get("da")).toBeNull();
    expect(params.get("a")).toBeNull();
  });

  it("scrive le date solo per il periodo personalizzato", () => {
    const params = encodeFilters(
      { data_inizio: "2026-03-01", data_fine: "2026-03-15" },
      "custom",
    );

    expect(params.get("da")).toBe("2026-03-01");
    expect(params.get("a")).toBe("2026-03-15");
  });

  it("serializza liste, importi e ricerca", () => {
    const params = encodeFilters(
      {
        conto_id: ["1", "2"],
        categoria_id: ["7"],
        sottocategoria_id: ["71", "72"],
        tag_id: ["3"],
        tipo: "USCITA",
        importo_min: 0,
        importo_max: 500,
        descrizione: "esselunga",
      },
      "month",
    );

    expect(params.get("conti")).toBe("1,2");
    expect(params.get("categorie")).toBe("7");
    expect(params.get("sottocategorie")).toBe("71,72");
    expect(params.get("tag")).toBe("3");
    expect(params.get("tipo")).toBe("USCITA");
    expect(params.get("min")).toBe("0");
    expect(params.get("max")).toBe("500");
    expect(params.get("q")).toBe("esselunga");
  });
});

describe("decodeFilters", () => {
  it("parte senza periodo quando l'URL è vuoto", () => {
    const { period, filters } = decodeFilters(new URLSearchParams());

    expect(period).toBe("all");
    // Nessuna data al BE: la lista non parte già tagliata.
    expect(filters.data_inizio).toBeUndefined();
    expect(filters.data_fine).toBeUndefined();
  });

  it("ricalcola le date del preset invece di fidarsi dell'URL", () => {
    const { filters } = decodeFilters(
      new URLSearchParams("periodo=year&da=1999-01-01"),
    );

    expect(filters.data_inizio).toBe(periodRange("year").data_inizio);
  });

  it("ricade sulla vista di partenza se il periodo non esiste", () => {
    expect(decodeFilters(new URLSearchParams("periodo=domani")).period).toBe(
      "all",
    );
  });

  it("legge le liste separate da virgola", () => {
    const { filters } = decodeFilters(new URLSearchParams("conti=1,2,3"));

    expect(filters.conto_id).toEqual(["1", "2", "3"]);
  });

  it("ignora liste e numeri malformati invece di filtrare a vuoto", () => {
    const { filters } = decodeFilters(new URLSearchParams("conti=,,&min=abc"));

    expect(filters.conto_id).toBeUndefined();
    expect(filters.importo_min).toBeUndefined();
  });

  it("fa il giro completo con i filtri personalizzati", () => {
    const original = {
      data_inizio: "2026-03-01",
      data_fine: "2026-03-15",
      tipo: "ENTRATA",
      conto_id: ["4"],
      importo_min: 10,
      importo_max: 90,
      descrizione: "affitto",
    };

    const { period, filters } = decodeFilters(
      encodeFilters(original, "custom"),
    );

    expect(period).toBe("custom");
    expect(filters).toMatchObject(original);
  });
});

// Il filtro per sottocategoria è arrivato dopo gli altri: sta nell'URL come
// loro, altrimenti un refresh sui Movimenti riporterebbe indietro solo lui.
// La Home apre i Movimenti con questo indirizzo quando si tocca "Entrate" o
// "Uscite" (vedi pages/home_page). È un contratto fra due schermate che non si
// parlano: se una chiave cambiasse da una parte sola il tocco aprirebbe la
// lista senza filtri, e nessuno se ne accorgerebbe.
describe("il link delle metriche della Home", () => {
  it("apre i Movimenti sul mese corrente e sul tipo scelto", () => {
    const { period, filters } = decodeFilters(
      new URLSearchParams("periodo=month&tipo=ENTRATA"),
    );

    expect(period).toBe("month");
    expect(filters.tipo).toBe("ENTRATA");
    expect(filters.data_inizio).toBe(periodRange("month").data_inizio);
    expect(filters.data_fine).toBe(periodRange("month").data_fine);
  });

  it("vale allo stesso modo per le uscite", () => {
    expect(
      decodeFilters(new URLSearchParams("periodo=month&tipo=USCITA")).filters
        .tipo,
    ).toBe("USCITA");
  });
});

describe("filtro per sottocategoria", () => {
  it("fa il giro completo insieme alla sua categoria", () => {
    const original = {
      categoria_id: ["7"],
      sottocategoria_id: ["71"],
    };

    const { filters } = decodeFilters(encodeFilters(original, "all"));

    expect(filters).toMatchObject(original);
  });

  it("resta fuori dall'URL finché nessuna è scelta", () => {
    expect(
      encodeFilters({ categoria_id: ["7"] }, "all").get("sottocategorie"),
    ).toBeNull();
  });
});

describe("filtro senza categoria", () => {
  it("finisce nell'URL solo quando è acceso", () => {
    expect(
      encodeFilters({ senza_categoria: true }, "all").get("senza_categoria"),
    ).toBe("1");

    expect(encodeFilters({ senza_categoria: false }, "all").toString()).toBe(
      "",
    );
  });

  it("torna indietro come booleano, o sparisce", () => {
    expect(
      decodeFilters(new URLSearchParams("senza_categoria=1")).filters
        .senza_categoria,
    ).toBe(true);

    expect(
      decodeFilters(new URLSearchParams()).filters.senza_categoria,
    ).toBeUndefined();
  });
});

describe("andata e ritorno", () => {
  // La pagina Movimenti decodifica la query string nello store e poi
  // ricodifica lo store nella query string. Se il secondo passaggio non
  // restituisse la stessa stringa, i due effetti che chiudono il cerchio si
  // rimbalzerebbero addosso una richiesta a testa senza fermarsi.
  const stabile = (search: string) => {
    const { filters, period } = decodeFilters(new URLSearchParams(search));
    return encodeFilters(filters, period).toString();
  };

  it("un link con categoria, sottocategoria e anno resta sé stesso", () => {
    // È il link che l'Analisi costruisce toccando una riga delle uscite.
    const link = encodeFilters(
      {
        data_inizio: "2026-01-01",
        data_fine: "2026-12-31",
        categoria_id: ["14"],
        sottocategoria_id: ["49"],
      },
      "custom",
    ).toString();

    expect(stabile(link)).toBe(link);
  });

  it("vale anche per il link senza categoria e per quello vuoto", () => {
    const link = encodeFilters(
      { data_inizio: "2026-01-01", data_fine: "2026-12-31", senza_categoria: true },
      "custom",
    ).toString();

    expect(stabile(link)).toBe(link);
    expect(stabile("")).toBe("");
  });
});
