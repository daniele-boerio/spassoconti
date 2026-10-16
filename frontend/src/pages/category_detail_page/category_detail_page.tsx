import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useI18n } from "../../i18n/use-i18n";
import { getLocale } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { Page, PageContent, PageHeader } from "../../components/page/page";
import { Card } from "../../components/card/card";
import ListRow, { List } from "../../components/list_row/list_row";
import SectionHeader from "../../components/section_header/section_header";
import Amount from "../../components/amount/amount";
import Chip from "../../components/chip/chip";
import EmptyState from "../../components/empty_state/empty_state";
import SkeletonList from "../../components/skeleton/skeleton";
import AnalysisFiltersSheet, {
  AnalysisFiltersPatch,
} from "../../components/dialog/analysis_filters_sheet/analysis_filters_sheet";
import "./category_detail_page.scss";
import { getMonthlyDetailsStatistics } from "../../features/statistics/api_calls";
import {
  selectMonthlyStatisticsData,
  selectStatisticsLoading,
} from "../../features/statistics/statistics_slice";
import { getCategorie } from "../../features/categorie/api_calls";
import { selectCategoriaCategorie } from "../../features/categorie/categoria_slice";
import { getTags } from "../../features/tags/api_calls";
import { getTransactionsByCategory } from "../../features/transactions/api_calls";
import { Transaction } from "../../features/transactions/interfaces";
import {
  mapTransaction,
  selectTransactionRevision,
} from "../../features/transactions/transaction_slice";
import { displayAmount, signedAmount } from "../../features/transactions/group";
import { transactionIcon } from "../../features/transactions/icons";
import { openSheet } from "../../features/ui/ui_slice";
import { toIsoDate } from "../../services/dates";

const localeTag = () => (getLocale() === "it" ? "it-IT" : "en-GB");

/**
 * Una categoria vista da sola: i movimenti del mese e nient'altro, con una
 * riga di pillole in cima per restringerli a una sottocategoria. Niente
 * grafici — l'andamento nel tempo si guarda dalla pagina Grafici.
 */
export default function CategoryDetailPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [periodOpen, setPeriodOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const today = new Date();
  const year = Number(searchParams.get("anno")) || today.getFullYear();
  const month = Number(searchParams.get("mese")) || today.getMonth() + 1;
  const tagId = searchParams.get("tag");
  // Arriva già dall'Analisi (`openCategory` la mette nel link) e la scrive il
  // tocco su una pillola qui sotto: in entrambi i casi restringe i movimenti.
  const sottocategoriaId = searchParams.get("sotto");

  const categorie = useAppSelector(selectCategoriaCategorie);
  const monthlyData = useAppSelector(selectMonthlyStatisticsData);
  const loading = useAppSelector(selectStatisticsLoading);
  // La lista di questa pagina vive qui, non nello store: senza questo una
  // modifica fatta dal form lasciava a schermo l'importo vecchio.
  const revision = useAppSelector(selectTransactionRevision);

  const categoria = categorie.find((item) => String(item.id) === String(id));

  useEffect(() => {
    dispatch(getCategorie());
    dispatch(getTags());
  }, [dispatch]);

  // Le statistiche del mese servono solo a sapere quali sottocategorie hanno
  // movimenti e per quanto: sono le pillole del filtro. Si chiedono senza
  // `sottocategoria_id`, così la riga resta intera anche a filtro acceso.
  useEffect(() => {
    dispatch(
      getMonthlyDetailsStatistics({
        year,
        month,
        categoria_id: id,
        tag_id: tagId,
      }),
    );
  }, [dispatch, id, year, month, tagId, revision]);

  useEffect(() => {
    let alive = true;

    dispatch(
      getTransactionsByCategory({
        categoria_id: id,
        sottocategoria_id: sottocategoriaId,
        tag_id: tagId,
        data_inizio: toIsoDate(new Date(year, month - 1, 1)),
        data_fine: toIsoDate(new Date(year, month, 0)),
      }),
    )
      .unwrap()
      // Gli importi arrivano come stringhe: la stessa conversione che fa lo
      // slice, perché qui la lista vive nella pagina e non ci passa.
      .then((rows) => alive && setTransactions((rows ?? []).map(mapTransaction)))
      .catch(() => alive && setTransactions([]));

    return () => {
      alive = false;
    };
  }, [dispatch, id, year, month, sottocategoriaId, tagId, revision]);

  // `monthDetails` filtrato su una categoria torna quella sola riga, con le
  // sue sottocategorie.
  const detail = monthlyData[0];

  // Le statistiche danno il nome della sottocategoria, non il suo id: per
  // poterci filtrare i movimenti lo ripeschiamo dalla categoria. Una riga senza
  // corrispondenza (le transazioni senza sottocategoria finiscono qui) resta
  // in elenco ma non si tocca: non c'è niente su cui filtrare.
  const subcategories = useMemo(
    () =>
      (detail?.sottocategorie ?? [])
        .map((sub) => ({
          nome: sub.sottocategoria,
          totale: Math.abs(sub.totale),
          id:
            categoria?.sottocategorie?.find(
              (item) => item.nome === sub.sottocategoria,
            )?.id ?? null,
        }))
        .filter((sub) => sub.totale > 0)
        .sort((a, b) => b.totale - a.totale),
    [detail, categoria],
  );

  // Toccare la pillola già accesa la spegne, e "Tutte" la spegne comunque: è
  // il modo di tornare a vedere l'intera categoria senza uscire dalla pagina.
  const filterBy = (subId: string | null) => {
    const next = new URLSearchParams(searchParams);

    if (subId === null || subId === sottocategoriaId) next.delete("sotto");
    else next.set("sotto", subId);

    setSearchParams(next, { replace: true });
  };

  // Somma con segno di quello che è a schermo: si muove con il filtro, così la
  // riga dice sempre quanto vale la lista che le sta sotto.
  const total = transactions.reduce((sum, row) => sum + signedAmount(row), 0);

  const monthName = (value: number) =>
    new Intl.DateTimeFormat(localeTag(), { month: "short" }).format(
      new Date(year, value - 1, 1),
    );

  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(localeTag(), {
      day: "numeric",
      month: "short",
    }).format(new Date(`${iso.slice(0, 10)}T00:00:00`));

  return (
    <>
      <Page className="category-detail">
        <PageHeader className="category-detail__header">
          <div className="category-detail__top">
            <button
              type="button"
              className="category-detail__back"
              aria-label={t("back")}
              onClick={() => navigate(-1)}
            >
              <i className="ph-bold ph-arrow-left" aria-hidden="true" />
            </button>

            <h1 className="category-detail__title">
              {categoria?.nome ?? t("category")}
            </h1>

            <button
              type="button"
              className="category-detail__period"
              onClick={() => setPeriodOpen(true)}
            >
              {`${monthName(month)} ${year}`}
              <i className="ph-bold ph-caret-down" aria-hidden="true" />
            </button>
          </div>
        </PageHeader>

        <PageContent>
          <section className="category-detail__movements">
            {subcategories.length > 0 && (
              <div className="category-detail__filter">
                <Chip
                  label={t("category_detail_all")}
                  variant={sottocategoriaId ? "outline" : "active"}
                  onClick={() => filterBy(null)}
                />

                {subcategories.map((sub) => {
                  const meta = (
                    <Amount value={sub.totale} decimals={0} hideCurrency />
                  );

                  if (sub.id === null) {
                    return (
                      <Chip
                        key={sub.nome}
                        label={sub.nome}
                        variant="solid"
                        meta={meta}
                      />
                    );
                  }

                  const selezionata = String(sub.id) === sottocategoriaId;

                  return (
                    <Chip
                      key={sub.nome}
                      label={sub.nome}
                      variant={selezionata ? "active" : "outline"}
                      meta={meta}
                      onClick={() => filterBy(String(sub.id))}
                    />
                  );
                })}
              </div>
            )}

            <SectionHeader aside={<Amount value={total} sign="always" />}>
              {`${t("category_detail_movements")} · ${transactions.length}`}
            </SectionHeader>

            {loading && transactions.length === 0 ? (
              <Card>
                <SkeletonList />
              </Card>
            ) : transactions.length === 0 ? (
              <EmptyState
                variant="search"
                icon="ph-bold ph-list-bullets"
                title={t("mov_empty_filtered_title")}
                description={t("category_detail_empty")}
              />
            ) : (
              <Card className="category-detail__card">
                <List>
                  {transactions.map((transaction) => (
                    <ListRow
                      key={transaction.id}
                      icon={transactionIcon(
                        transaction.tipo,
                        categoria?.nome,
                      )}
                      title={
                        transaction.descrizione ||
                        categoria?.nome ||
                        t("transaction")
                      }
                      meta={dayLabel(transaction.data)}
                      onClick={() =>
                        dispatch(
                          openSheet({
                            name: "newTransaction",
                            transactionId: transaction.id,
                          }),
                        )
                      }
                      trailing={
                        <Amount
                          value={displayAmount(transaction)}
                          sign="always"
                          hideCurrency
                        />
                      }
                    />
                  ))}
                </List>
              </Card>
            )}
          </section>
        </PageContent>
      </Page>

      <AnalysisFiltersSheet
        open={periodOpen}
        onClose={() => setPeriodOpen(false)}
        year={year}
        month={month}
        // La categoria è quella della pagina: qui si filtra solo il periodo
        // e il tag.
        showTaxonomy={false}
        categoriaId={null}
        sottocategoriaIds={[]}
        tagId={tagId}
        onChange={(patch: AnalysisFiltersPatch) => {
          const next = new URLSearchParams(searchParams);

          if (patch.year !== undefined) next.set("anno", String(patch.year));
          if (patch.month !== undefined) next.set("mese", String(patch.month));
          if (patch.tag !== undefined) {
            if (patch.tag === null) next.delete("tag");
            else next.set("tag", patch.tag);
          }

          setSearchParams(next, { replace: true });
        }}
      />
    </>
  );
}
