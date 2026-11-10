import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/use-i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import Sheet from "../../components/sheet/sheet";
import Button from "../../components/button/button";
import Amount from "../../components/amount/amount";
import PickerSheet from "../../components/picker_sheet/picker_sheet";
import { showToast } from "../../features/ui/ui_slice";
import {
  createQuadratura,
  deleteQuadratura,
  getQuadrature,
} from "../../features/conti/api_calls";
import {
  selectContiConti,
  selectQuadrature,
} from "../../features/conti/conto_slice";
import { Quadratura } from "../../features/conti/interfaces";

const oggi = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/**
 * Sezione "Quadratura" delle Impostazioni: il saldo vero di un conto in un
 * giorno, preso dalla banca o dal portafoglio. Non cambia niente di quello che
 * l'app mostra: la prima è il punto di partenza, ogni successiva viene
 * confrontata con la precedente più i movimenti registrati in mezzo, e il
 * controllo notturno avvisa se non torna (un movimento dimenticato o un
 * importo sbagliato in quel periodo).
 */
export default function QuadratureSection() {
  const { t, locale } = useI18n();
  const dispatch = useAppDispatch();
  const quadrature = useAppSelector(selectQuadrature);
  const conti = useAppSelector(selectContiConti);

  const [listOpen, setListOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contoId, setContoId] = useState<string | null>(null);
  const [data, setData] = useState(oggi());
  const [importo, setImporto] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dispatch(getQuadrature());
  }, [dispatch]);

  const dateLocale = locale === "it" ? "it-IT" : "en-US";
  const giorno = (value: string) => new Date(value).toLocaleDateString(dateLocale);

  const ultime = quadrature.filter((q) => q.ultima && q.differenza !== null);
  const nonTornano = ultime.filter((q) => q.differenza !== 0).length;
  const rowHint =
    quadrature.length === 0
      ? t("reconcile_hint_empty")
      : ultime.length === 0
        ? t("reconcile_hint_start")
        : nonTornano > 0
          ? t("reconcile_hint_ko")
          : t("reconcile_hint_ok");

  const openForm = () => {
    const predefinito = conti.find((conto) => conto.default) ?? conti[0];
    setContoId(predefinito ? String(predefinito.id) : null);
    setData(oggi());
    setImporto("");
    setInvalid(false);
    setFormOpen(true);
  };

  const save = async () => {
    const parsed = Number(importo.trim().replace(",", "."));
    if (!contoId || !data || importo.trim() === "" || Number.isNaN(parsed) || data > oggi()) {
      setInvalid(true);
      return;
    }
    setBusy(true);
    try {
      await dispatch(
        createQuadratura({ conto_id: contoId, data, saldo_reale: parsed }),
      ).unwrap();
      dispatch(showToast({ variant: "success", title: t("save") }));
      setFormOpen(false);
    } catch {
      // Mostrato dall'errorMiddleware.
    } finally {
      setBusy(false);
    }
  };

  const remove = (q: Quadratura) => {
    dispatch(deleteQuadratura({ id: q.id }));
  };

  const stato = (q: Quadratura) => {
    if (q.differenza === null) return t("reconcile_start_point");
    if (q.differenza === 0) return t("reconcile_ok");
    return (
      <>
        {t("reconcile_expected")} <Amount value={q.atteso ?? 0} /> ·{" "}
        {t("reconcile_difference")} <Amount value={q.differenza} />
      </>
    );
  };

  const contoScelto = conti.find((conto) => String(conto.id) === contoId);

  return (
    <section className="settings-group">
      <h2 className="settings-group__title">{t("reconcile_title")}</h2>

      <div className="settings-card">
        <button
          type="button"
          className="settings-row settings-row--tappable"
          onClick={() => setListOpen(true)}
        >
          <span className="settings-row__text">
            <span className="settings-row__label">{t("reconcile_row")}</span>
            <span className="settings-row__hint">{rowHint}</span>
          </span>
          <i className="ph-bold ph-caret-right" aria-hidden="true" />
        </button>
      </div>

      <Sheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        title={t("reconcile_row")}
        className="two-factor"
        footer={
          <Button block onClick={openForm}>
            {t("reconcile_add")}
          </Button>
        }
      >
        <p className="two-factor__text">{t("reconcile_explain")}</p>

        {quadrature.length > 0 && (
          <div className="settings-card">
            {quadrature.map((q) => (
              <div key={q.id} className="settings-row">
                <span className="settings-row__text">
                  <span className="settings-row__label">
                    {giorno(q.data)} · <Amount value={q.saldo_reale} />
                    {conti.length > 1 && ` · ${q.conto_nome}`}
                  </span>
                  <span
                    className={`settings-row__hint ${
                      q.differenza ? "budget-field__hint--error" : ""
                    }`}
                  >
                    {stato(q)}
                    {q.precedente_data &&
                      ` · ${t("reconcile_since")} ${giorno(q.precedente_data)}`}
                  </span>
                </span>
                <button
                  type="button"
                  className="settings-page__back"
                  aria-label={t("delete")}
                  onClick={() => remove(q)}
                >
                  <i className="ph-bold ph-trash" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={t("reconcile_add")}
        className="two-factor"
        footer={
          <>
            <Button variant="neutral" block onClick={() => setFormOpen(false)}>
              {t("cancel")}
            </Button>
            <Button block disabled={busy} onClick={save}>
              {t("save")}
            </Button>
          </>
        }
      >
        {conti.length > 1 && (
          <div className="settings-card">
            <button
              type="button"
              className="settings-row settings-row--tappable"
              onClick={() => setPickerOpen(true)}
            >
              <span className="settings-row__text">
                <span className="settings-row__label">{t("reconcile_account")}</span>
              </span>
              <span className="settings-row__value">{contoScelto?.nome}</span>
              <i className="ph-bold ph-caret-right" aria-hidden="true" />
            </button>
          </div>
        )}

        <label className="two-factor__field">
          <span className="two-factor__label">{t("reconcile_date")}</span>
          <input
            className="two-factor__input"
            type="date"
            max={oggi()}
            value={data}
            onChange={(event) => {
              setData(event.target.value);
              setInvalid(false);
            }}
          />
        </label>

        <label className="budget-field">
          <input
            className="budget-field__input"
            type="text"
            inputMode="decimal"
            value={importo}
            placeholder="0,00"
            aria-label={t("reconcile_amount")}
            aria-invalid={invalid}
            onChange={(event) => {
              setImporto(event.target.value);
              setInvalid(false);
            }}
          />
          <span className="budget-field__currency">€</span>
        </label>

        <p className={`budget-field__hint ${invalid ? "budget-field__hint--error" : ""}`}>
          {invalid ? t("reconcile_invalid") : t("reconcile_amount_hint")}
        </p>
      </Sheet>

      <PickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t("reconcile_account")}
        options={conti.map((conto) => ({ id: String(conto.id), label: conto.nome }))}
        value={contoId}
        onSelect={(value) => {
          setContoId(value);
          setPickerOpen(false);
        }}
      />
    </section>
  );
}
