import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { ignoraDoppioni } from "../../features/conti/api_calls";
import { selectDoppioni } from "../../features/conti/conto_slice";
import { showToast } from "../../features/ui/ui_slice";
import { linkMovimenti } from "../../features/conti/doppioni";
import { useI18n } from "../../i18n/use-i18n";
import { Card, CardTitle } from "../card/card";
import Amount from "../amount/amount";
import Button from "../button/button";
import "../saldi_check/saldi_check.scss";

/**
 * Movimenti uguali (stesso conto, giorno, tipo, importo e descrizione), gli
 * stessi che il controllo notturno segnala. Due uscite: guardare i Movimenti di
 * quel giorno (tutti, per capire se è davvero un doppione) e cancellare quello di
 * troppo, oppure dire "non è un doppione" (due caffè uguali nello stesso giorno
 * capitano) e il gruppo non torna più.
 */
export default function DoppioniCheck() {
  const { t, locale } = useI18n();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const gruppi = useAppSelector(selectDoppioni);
  const [busy, setBusy] = useState(false);

  if (gruppi.length === 0) return null;

  const dateLocale = locale === "it" ? "it-IT" : "en-US";

  const ignora = async (ids: string[]) => {
    setBusy(true);
    try {
      await dispatch(ignoraDoppioni({ ids })).unwrap();
      dispatch(showToast({ variant: "success", title: t("duplicates_ignored") }));
    } catch {
      // L'errore lo mostra il middleware.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="alert" className="saldi-check">
      <CardTitle>{t("duplicates_title")}</CardTitle>
      <p className="saldi-check__intro">{t("duplicates_text")}</p>

      <ul className="saldi-check__list">
        {gruppi.map((gruppo) => {
          const ids = gruppo.transazioni.map((tx) => String(tx.id));
          return (
            <li key={ids.join("-")} className="saldi-check__row">
              <div className="saldi-check__info">
                <span className="saldi-check__name">
                  {gruppo.descrizione || gruppo.tipo}
                </span>
                <span className="saldi-check__meta">
                  {new Date(gruppo.data).toLocaleDateString(dateLocale)} ·{" "}
                  {gruppo.transazioni.length} × <Amount value={gruppo.importo} />
                </span>
                <span className="saldi-check__meta">
                  <button
                    type="button"
                    className="saldi-check__link"
                    onClick={() => navigate(linkMovimenti(gruppo))}
                  >
                    {t("duplicates_open")}
                  </button>
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => ignora(ids)}
              >
                {t("duplicates_ignore")}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
