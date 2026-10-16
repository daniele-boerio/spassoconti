import { ReactNode, useState } from "react";
import Sheet from "../../sheet/sheet";
import Button from "../../button/button";
import Toggle from "../../toggle/toggle";
import PickerSheet from "../../picker_sheet/picker_sheet";
import "./account_dialog.scss";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { createConto, updateConto } from "../../../features/conti/api_calls";
import { useI18n } from "../../../i18n/use-i18n";
import { Conto } from "../../../features/conti/interfaces";
import { selectContiConti } from "../../../features/conti/conto_slice";
import { toIsoDate } from "../../../services/dates";

interface AccountDialogProps {
  visible: boolean;
  onHide: () => void;
  account?: Conto | null;
  loading?: boolean;
}

/**
 * I quattro tipi di conto del design. Non sono un'etichetta: decidono quali
 * campi ha senso chiedere — un salvadanaio ha un obiettivo, una carta si
 * ricarica, un conto e i contanti no.
 */
const TIPI = [
  { value: "conto", icon: "ph-bold ph-bank", labelKey: "account_type_bank" },
  { value: "carta", icon: "ph-bold ph-credit-card", labelKey: "account_type_card" },
  { value: "salvadanaio", icon: "ph-bold ph-wallet", labelKey: "account_type_goal" },
  { value: "contanti", icon: "ph-bold ph-money", labelKey: "account_type_cash" },
] as const;

const DEFAULT_TIPO = "conto";

/**
 * Il tipo di un conto creato prima che i tipi esistessero si deduce dai campi
 * che ha: chi ha un obiettivo è un salvadanaio, chi si ricarica una carta.
 */
const tipoOf = (account: Conto) => {
  if (account.tipo) return account.tipo;
  if (account.budget_obiettivo) return "salvadanaio";
  if (account.ricarica_automatica) return "carta";
  return DEFAULT_TIPO;
};

export default function AccountDialog({
  visible,
  onHide,
  account,
  loading,
}: AccountDialogProps) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const conti = useAppSelector(selectContiConti);

  const [tipo, setTipo] = useState(() =>
    account ? tipoOf(account) : DEFAULT_TIPO,
  );
  const [nome, setNome] = useState(account?.nome ?? "");
  const [saldo, setSaldo] = useState(account?.saldo.toString() ?? "");
  const [predefinito, setPredefinito] = useState(account?.default ?? false);
  const [obiettivo, setObiettivo] = useState(
    account?.budget_obiettivo?.toString() ?? "",
  );
  const [ricarica, setRicarica] = useState(
    account?.ricarica_automatica ?? false,
  );
  const [soglia, setSoglia] = useState(account?.soglia_minima?.toString() ?? "");
  const [sorgenteId, setSorgenteId] = useState<string | null>(
    account?.conto_sorgente_id ?? null,
  );
  const [frequenza, setFrequenza] = useState<string | null>(
    account?.frequenza_controllo ?? null,
  );
  const [prossimoControllo, setProssimoControllo] = useState<Date | null>(() =>
    account?.prossimo_controllo ? new Date(account.prossimo_controllo) : null,
  );

  const [picker, setPicker] = useState<null | "sorgente" | "frequenza">(null);

  const isSalvadanaio = tipo === "salvadanaio";
  const isCarta = tipo === "carta";

  // Il saldo può essere negativo (una carta in rosso), l'obiettivo e la soglia no.
  const onNumber =
    (set: (value: string) => void, allowNegative = false) =>
    (raw: string) => {
      const cleaned = raw.replace(",", ".");
      const pattern = allowNegative ? /^-?\d*\.?\d{0,2}$/ : /^\d*\.?\d{0,2}$/;

      if (cleaned === "" || pattern.test(cleaned)) set(cleaned);
    };

  const numberOr = (value: string, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const frequenze = [
    { id: "SETTIMANALE", label: t("weekly") },
    { id: "MENSILE", label: t("monthly") },
  ];

  const sorgenti = conti.filter(
    (item) => !item.virtuale && String(item.id) !== String(account?.id),
  );

  const save = async () => {
    if (!nome.trim()) return;

    // Ogni tipo porta con sé solo i suoi campi: un conto corrente non deve
    // trascinarsi dietro la soglia di ricarica di quando era una carta.
    const ricaricaAttiva = isCarta && ricarica;

    const payload = {
      nome: nome.trim(),
      saldo: numberOr(saldo),
      tipo,
      default: predefinito,
      budget_obiettivo: isSalvadanaio ? numberOr(obiettivo) : 0,
      ricarica_automatica: ricaricaAttiva,
      soglia_minima: ricaricaAttiva ? numberOr(soglia) : 0,
      conto_sorgente_id: ricaricaAttiva ? (sorgenteId ?? undefined) : undefined,
      frequenza_controllo: ricaricaAttiva ? (frequenza ?? undefined) : undefined,
      prossimo_controllo:
        ricaricaAttiva && prossimoControllo
          ? toIsoDate(prossimoControllo)
          : undefined,
    };

    try {
      if (account?.id) {
        await dispatch(updateConto({ id: account.id, ...payload })).unwrap();
      } else {
        await dispatch(createConto(payload)).unwrap();
      }

      onHide();
    } catch {
      // L'errore arriva dal middleware.
    }
  };

  return (
    <>
      <Sheet
        open={visible}
        onClose={onHide}
        title={account ? t("edit_account") : t("add_account")}
        className="account-sheet"
        footer={
          <Button block disabled={!nome.trim() || loading} onClick={save}>
            {account ? t("save_changes") : t("create_account")}
          </Button>
        }
      >
        <section className="account-sheet__section">
          <span className="account-sheet__label">{t("account_type")}</span>

          <div
            className="account-sheet__types"
            role="radiogroup"
            aria-label={t("account_type")}
          >
            {TIPI.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={option.value === tipo}
                className="account-sheet__type"
                onClick={() => setTipo(option.value)}
              >
                <i className={option.icon} aria-hidden="true" />
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </section>

        <Field label={t("account_name")}>
          <input
            value={nome}
            placeholder={t("account_placeholder")}
            aria-label={t("account_name")}
            onChange={(event) => setNome(event.target.value)}
          />
        </Field>

        <Field label={t("account_initial_balance")}>
          <input
            value={saldo}
            inputMode="decimal"
            placeholder="0,00"
            aria-label={t("account_initial_balance")}
            onChange={(event) => onNumber(setSaldo, true)(event.target.value)}
          />
          <span className="account-sheet__suffix">€</span>
        </Field>

        {isSalvadanaio && (
          <Field label={t("target_budget")}>
            <input
              value={obiettivo}
              inputMode="decimal"
              placeholder="0,00"
              aria-label={t("target_budget")}
              onChange={(event) => onNumber(setObiettivo)(event.target.value)}
            />
            <span className="account-sheet__suffix">€</span>
          </Field>
        )}

        <label className="account-sheet__switch">
          <span className="account-sheet__switch-text">
            <span>{t("account_default")}</span>
            <span className="account-sheet__hint">
              {t("account_default_hint")}
            </span>
          </span>
          <Toggle checked={predefinito} onChange={setPredefinito} />
        </label>

        {isCarta && (
          <>
            <label className="account-sheet__switch">
              <span className="account-sheet__switch-text">
                <span>{t("automatic_recharge")}</span>
                <span className="account-sheet__hint">
                  {t("account_recharge_hint")}
                </span>
              </span>
              <Toggle checked={ricarica} onChange={setRicarica} />
            </label>

            {ricarica && (
              <>
                <Field label={t("minimum_threshold")}>
                  <input
                    value={soglia}
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={t("minimum_threshold")}
                    onChange={(event) =>
                      onNumber(setSoglia)(event.target.value)
                    }
                  />
                  <span className="account-sheet__suffix">€</span>
                </Field>

                <Row
                  label={t("source_account")}
                  value={
                    sorgenti.find(
                      (item) => String(item.id) === String(sorgenteId),
                    )?.nome
                  }
                  placeholder={t("select_source")}
                  onClick={() => setPicker("sorgente")}
                />

                <Row
                  label={t("frequency")}
                  value={
                    frequenze.find((item) => item.id === frequenza)?.label
                  }
                  placeholder={t("select_frequency")}
                  onClick={() => setPicker("frequenza")}
                />

                <Field label={t("next_check")}>
                  <input
                    type="date"
                    value={prossimoControllo ? toIsoDate(prossimoControllo) : ""}
                    aria-label={t("next_check")}
                    onChange={(event) => {
                      const [year, month, day] = event.target.value
                        .split("-")
                        .map(Number);

                      setProssimoControllo(
                        year ? new Date(year, month - 1, day) : null,
                      );
                    }}
                  />
                </Field>
              </>
            )}
          </>
        )}
      </Sheet>

      <PickerSheet
        open={picker === "sorgente"}
        onClose={() => setPicker(null)}
        title={t("source_account")}
        options={sorgenti.map((item) => ({ id: item.id, label: item.nome }))}
        value={sorgenteId}
        onSelect={setSorgenteId}
      />

      <PickerSheet
        open={picker === "frequenza"}
        onClose={() => setPicker(null)}
        title={t("frequency")}
        options={frequenze}
        value={frequenza}
        onSelect={setFrequenza}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="account-sheet__field">
      <span className="account-sheet__label">{label}</span>
      <span className="account-sheet__control">{children}</span>
    </label>
  );
}

function Row({
  label,
  value,
  placeholder,
  onClick,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="account-sheet__row" onClick={onClick}>
      <span className="account-sheet__row-text">
        <span className="account-sheet__label">{label}</span>
        <span
          className={`account-sheet__value${value ? "" : " account-sheet__value--empty"}`}
        >
          {value ?? placeholder}
        </span>
      </span>

      <i className="ph-bold ph-caret-right" aria-hidden="true" />
    </button>
  );
}
