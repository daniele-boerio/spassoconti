import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/use-i18n";
import { Page, PageContent, PageHeader } from "../../components/page/page";
import { Card } from "../../components/card/card";
import ListRow, { List } from "../../components/list_row/list_row";
import "./altro_page.scss";

/**
 * Le destinazioni secondarie: ricorrenze e debiti, la tassonomia con cui
 * leggi i movimenti e le preferenze dell'app. Stava dentro Conti, che non c'entrava
 * niente — un conto è un posto dove ci sono dei soldi, non un menu.
 */
export default function AltroPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <Page className="more">
      <PageHeader>
        <h1 className="page-title">{t("nav_more")}</h1>
      </PageHeader>

      <PageContent>
        {/* Movimenti che si ripetono o che devi ancora fare: si aprono anche
            dall'intestazione dei Movimenti, ma lì sono due icone senza nome. */}
        <Card className="more__menu">
          <List>
            <ListRow
              icon="ph-bold ph-arrows-clockwise"
              iconShape="square"
              title={t("nav_recurrings")}
              meta={t("more_recurrings_hint")}
              chevron
              onClick={() => navigate("/recurrings")}
            />

            <ListRow
              icon="ph-bold ph-receipt"
              iconShape="square"
              title={t("nav_debts")}
              meta={t("more_debts_hint")}
              chevron
              onClick={() => navigate("/debts")}
            />
          </List>
        </Card>

        <Card className="more__menu">
          <List>
            <ListRow
              icon="ph-bold ph-tag-simple"
              iconShape="square"
              title={t("taxonomy_title")}
              meta={t("more_taxonomy_hint")}
              chevron
              onClick={() => navigate("/categories")}
            />

            <ListRow
              icon="ph-bold ph-gear"
              iconShape="square"
              title={t("nav_settings")}
              meta={t("more_settings_hint")}
              chevron
              onClick={() => navigate("/settings")}
            />
          </List>
        </Card>
      </PageContent>
    </Page>
  );
}
