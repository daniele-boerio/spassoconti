import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../../i18n/use-i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { Page, PageContent, PageHeader } from "../../components/page/page";
import { Card, CardTitle } from "../../components/card/card";
import SegmentedControl from "../../components/segmented_control/segmented_control";
import Chip from "../../components/chip/chip";
import Alert from "../../components/alert/alert";
import EmptyState from "../../components/empty_state/empty_state";
import Button from "../../components/button/button";
import CategoryDialog from "../../components/dialog/category_dialog/category_dialog";
import TagDialog from "../../components/dialog/tag_dialog/tag_dialog";
import MigrateTransactionsDialog from "../../components/dialog/migrate_transactions_dialog/migrate_transactions_dialog";
import "./category_page.scss";
import {
  deleteCategoria,
  getCategorie,
} from "../../features/categorie/api_calls";
import {
  selectCategoriaCategorie,
  selectCategoriaLoading,
} from "../../features/categorie/categoria_slice";
import { Categoria } from "../../features/categorie/interfaces";
import { categoryIcon } from "../../features/categorie/icons";
import { deleteTag, getTags } from "../../features/tags/api_calls";
import { selectTagTags } from "../../features/tags/tag_slice";
import { Tag } from "../../features/tags/interfaces";
import { getMonthlyDetailsStatistics } from "../../features/statistics/api_calls";
import { selectMonthlyStatisticsData } from "../../features/statistics/statistics_slice";
import { showToast } from "../../features/ui/ui_slice";

type View = "expenses" | "incomes" | "tags";

const VIEWS: View[] = ["expenses", "incomes", "tags"];

// Come il BE chiama le transazioni senza categoria negli aggregati.
const UNCATEGORIZED = "Uncategorized";

const isView = (value: string | null): value is View =>
  VIEWS.includes(value as View);

/**
 * Categorie e tag in una schermata sola, come nel design: due viste sulle
 * categorie (uscite ed entrate) più una sui tag. Le categorie senza vincolo di
 * tipo compaiono in tutte e due — sono usabili in tutte e due.
 */
export default function CategoryPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const categorie = useAppSelector(selectCategoriaCategorie);
  const loading = useAppSelector(selectCategoriaLoading);
  const tags = useAppSelector(selectTagTags);
  const monthlyData = useAppSelector(selectMonthlyStatisticsData);

  const viewParam = searchParams.get("vista");
  const view: View = isView(viewParam) ? viewParam : "expenses";

  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<Categoria | null>(null);
  const [pendingTag, setPendingTag] = useState<Tag | null>(null);

  useEffect(() => {
    const today = new Date();

    dispatch(getCategorie());
    dispatch(getTags());
    // Gli importi del mese accanto a ogni categoria vengono da qui, insieme
    // ai totali delle sottocategorie e alle transazioni senza categoria.
    dispatch(
      getMonthlyDetailsStatistics({
        year: today.getFullYear(),
        month: today.getMonth() + 1,
      }),
    );
  }, [dispatch]);

  // Totali del mese indicizzati per nome: `monthDetails` non manda gli id.
  const totals = useMemo(
    () => new Map(monthlyData.map((entry) => [entry.categoria, entry])),
    [monthlyData],
  );

  const uncategorized = totals.get(UNCATEGORIZED);

  const visible = useMemo(
    () =>
      categorie.filter((categoria) => {
        // Una categoria senza vincoli va bene per entrambi i versi: nasconderla
        // da una delle due viste la renderebbe irraggiungibile a metà.
        const generic = !categoria.solo_entrata && !categoria.solo_uscita;

        return view === "incomes"
          ? categoria.solo_entrata || generic
          : categoria.solo_uscita || generic;
      }),
    [categorie, view],
  );

  const openCategory = (categoria: Categoria | null) => {
    setEditingCategory(categoria);
    setCategoryDialogOpen(true);
  };

  const openTag = (tag: Tag | null) => {
    setEditingTag(tag);
    setTagDialogOpen(true);
  };

  const confirmDeleteCategory = () => {
    if (!pendingCategory) return;

    dispatch(deleteCategoria({ id: pendingCategory.id }));
    dispatch(showToast({ variant: "success", title: t("category_deleted") }));
    setPendingCategory(null);
  };

  const confirmDeleteTag = () => {
    if (!pendingTag) return;

    dispatch(deleteTag({ id: pendingTag.id }));
    dispatch(showToast({ variant: "success", title: t("tag_deleted") }));
    setPendingTag(null);
  };

  return (
    <>
      <Page className="taxonomy">
        <PageHeader className="taxonomy__header">
          <div className="taxonomy__top">
            <button
              type="button"
              className="taxonomy__back"
              aria-label={t("back")}
              onClick={() => navigate(-1)}
            >
              <i className="ph-bold ph-arrow-left" aria-hidden="true" />
            </button>

            <h1 className="page-title">{t("taxonomy_title")}</h1>

            <Chip
              label={t("migrate_transactions")}
              variant="outline"
              onClick={() => setMigrateOpen(true)}
            />
          </div>

          <SegmentedControl
            value={view}
            ariaLabel={t("taxonomy_title")}
            onChange={(next) => setSearchParams({ vista: next }, { replace: true })}
            options={[
              { value: "expenses", label: t("expenses") },
              { value: "incomes", label: t("income") },
              { value: "tags", label: t("nav_tags") },
            ]}
          />
        </PageHeader>

        <PageContent>
          {view === "tags" ? (
            <>
              <Card>
                <CardTitle>{t("taxonomy_tags")}</CardTitle>

                {tags.length === 0 ? (
                  <p className="taxonomy__muted">{t("taxonomy_no_tags")}</p>
                ) : (
                  <div className="taxonomy__pills">
                    {tags.map((tag) => (
                      // Pillola in due pezzi: il nome apre la modifica, la x
                      // elimina. Un tag non ha una schermata sua dove mettere
                      // le azioni.
                      <span className="tag-pill" key={tag.id}>
                        <button
                          type="button"
                          className="tag-pill__name"
                          onClick={() => openTag(tag)}
                        >
                          {`#${tag.nome}`}
                          {tag.n_transazioni ? (
                            <span className="tag-pill__count">
                              {tag.n_transazioni}
                            </span>
                          ) : null}
                        </button>

                        <button
                          type="button"
                          className="tag-pill__remove"
                          aria-label={`${t("delete")} ${tag.nome}`}
                          onClick={() => setPendingTag(tag)}
                        >
                          <i className="ph-bold ph-x" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Card>

              <button
                type="button"
                className="taxonomy__add"
                onClick={() => openTag(null)}
              >
                <i className="ph-bold ph-plus" aria-hidden="true" />
                {t("add_tag")}
              </button>
            </>
          ) : (
            <>
              {uncategorized && (
                <Card className="taxonomy__orphans">
                  <div className="taxonomy__orphans-text">
                    <span className="taxonomy__orphans-title">
                      {t("taxonomy_uncategorized")}
                    </span>
                    <span className="taxonomy__orphans-hint">
                      {t("taxonomy_uncategorized_hint")}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="neutral"
                    onClick={() => navigate("/transactions?senza_categoria=1")}
                  >
                    {t("taxonomy_assign")}
                  </Button>
                </Card>
              )}

              {!loading && visible.length === 0 ? (
                <EmptyState
                  icon="ph-bold ph-tag-simple"
                  title={t("taxonomy_empty_title")}
                  description={t("taxonomy_empty_text")}
                  actions={
                    <Button size="sm" onClick={() => openCategory(null)}>
                      {t("add_category")}
                    </Button>
                  }
                />
              ) : (
                // Una card sola per tutto l'elenco: una card per categoria
                // faceva di ogni riga un oggetto a sé, e la pagina un mosaico.
                <Card className="category-group">
                {visible.map((categoria) => {
                  const isOpen = expanded === categoria.id;
                  const children = categoria.sottocategorie ?? [];

                  return (
                    <div key={categoria.id} className="category-card">
                      <button
                        type="button"
                        className="category-card__head"
                        onClick={() =>
                          setExpanded(isOpen ? null : categoria.id)
                        }
                      >
                        <span
                          className="category-card__icon"
                          aria-hidden="true"
                        >
                          <i className={categoryIcon(categoria.nome)} />
                        </span>

                        <span className="category-card__text">
                          <span className="category-card__name">
                            {categoria.nome}
                          </span>
                          {children.length > 0 && (
                            <span className="category-card__meta">
                              {`${children.length} ${t("taxonomy_subcategories")}`}
                            </span>
                          )}
                        </span>

                        <i
                          className={`ph-bold ph-caret-${isOpen ? "down" : "right"} category-card__chevron`}
                          aria-hidden="true"
                        />
                      </button>

                      {isOpen && (
                        <div className="category-card__children">
                          {children.map((sub) => (
                            <Chip
                              key={sub.id}
                              variant="solid"
                              label={sub.nome}
                              onClick={() => openCategory(categoria)}
                            />
                          ))}

                          <Chip
                            variant="dashed"
                            icon="ph-bold ph-plus"
                            label={t("add")}
                            onClick={() => openCategory(categoria)}
                          />

                          <Chip
                            variant="dashed"
                            icon="ph-bold ph-trash"
                            label={t("delete")}
                            className="chip--danger"
                            onClick={() => setPendingCategory(categoria)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                </Card>
              )}

              <button
                type="button"
                className="taxonomy__add"
                onClick={() => openCategory(null)}
              >
                <i className="ph-bold ph-plus" aria-hidden="true" />
                {t("add_category")}
              </button>
            </>
          )}
        </PageContent>
      </Page>

      <CategoryDialog
        visible={categoryDialogOpen}
        category={editingCategory}
        onHide={() => {
          setCategoryDialogOpen(false);
          setEditingCategory(null);
        }}
        loading={loading}
      />

      <TagDialog
        visible={tagDialogOpen}
        tag={editingTag}
        onHide={() => {
          setTagDialogOpen(false);
          setEditingTag(null);
        }}
      />

      <MigrateTransactionsDialog
        visible={migrateOpen}
        onHide={() => setMigrateOpen(false)}
      />

      <Alert
        open={pendingCategory !== null}
        title={t("taxonomy_delete_category_title")}
        description={t("taxonomy_delete_category_text")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDeleteCategory}
        onCancel={() => setPendingCategory(null)}
      />

      <Alert
        open={pendingTag !== null}
        title={t("taxonomy_delete_tag_title")}
        description={t("taxonomy_delete_tag_text")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={confirmDeleteTag}
        onCancel={() => setPendingTag(null)}
      />
    </>
  );
}
