import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/use-i18n";
import { Page, PageContent, PageHeader } from "../../components/page/page";
import EmptyState from "../../components/empty_state/empty_state";
import Button from "../../components/button/button";

/**
 * Indirizzo che non porta a nessuna schermata (un link vecchio, un errore di
 * battitura). Prima si tornava in Home in silenzio, e chi aveva seguito un
 * link non capiva perché fosse finito lì.
 */
export default function NotFoundPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <Page className="not-found">
      <PageHeader>
        <h1 className="page-title">{t("not_found_title")}</h1>
      </PageHeader>

      <PageContent>
        <EmptyState
          icon="ph-bold ph-compass"
          title={t("not_found_heading")}
          description={t("not_found_text")}
          actions={
            <Button size="sm" onClick={() => navigate("/", { replace: true })}>
              {t("not_found_home")}
            </Button>
          }
        />
      </PageContent>
    </Page>
  );
}
