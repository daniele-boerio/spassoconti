import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { correggiSaldo } from "../../features/conti/api_calls";
import { selectSaldiFuoriSincrono } from "../../features/conti/conto_slice";
import { showToast } from "../../features/ui/ui_slice";
import { useI18n } from "../../i18n/use-i18n";
import { Card, CardTitle } from "../card/card";
import Amount from "../amount/amount";
import Button from "../button/button";
import "./saldi_check.scss";

/**
 * Conti il cui saldo non torna con i movimenti registrati.
 *
 * Succede solo se qualche operazione ha mosso il saldo senza un movimento (un
 * bug, o una modifica fatta fuori dall'app). Due uscite: "Correggi" porta il
 * saldo a quello dei movimenti; se invece il saldo giusto è quello attuale,
 * basta reimpostarlo dal conto, e il controllo lo prende come nuovo punto fermo.
 */
export default function SaldiCheck() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const righe = useAppSelector(selectSaldiFuoriSincrono);
  const [correcting, setCorrecting] = useState<string | null>(null);

  if (righe.length === 0) return null;

  const correggi = async (id: string) => {
    setCorrecting(id);
    try {
      await dispatch(correggiSaldo({ id })).unwrap();
      dispatch(showToast({ variant: "success", title: t("balance_check_fixed") }));
    } catch {
      // L'errore lo mostra il middleware.
    } finally {
      setCorrecting(null);
    }
  };

  return (
    <Card variant="alert" className="saldi-check">
      <CardTitle>{t("balance_check_title")}</CardTitle>
      <p className="saldi-check__intro">{t("balance_check_text")}</p>

      <ul className="saldi-check__list">
        {righe.map((riga) => (
          <li key={riga.conto_id} className="saldi-check__row">
            <div className="saldi-check__info">
              <span className="saldi-check__name">{riga.nome}</span>
              <span className="saldi-check__meta">
                {t("balance_check_now")} <Amount value={riga.saldo} /> ·{" "}
                {t("balance_check_expected")} <Amount value={riga.saldo_atteso} />
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={correcting !== null}
              onClick={() => correggi(riga.conto_id)}
            >
              {t("balance_check_fix")}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
