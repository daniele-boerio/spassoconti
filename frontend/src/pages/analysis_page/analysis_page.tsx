import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "../../i18n/use-i18n";
import { getLocale } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { Page, PageContent, PageHeader } from "../../components/page/page";
import SegmentedControl from "../../components/segmented_control/segmented_control";
import Chip from "../../components/chip/chip";
import AnalysisFiltersSheet, {
  AnalysisFiltersPatch,
} from "../../components/dialog/analysis_filters_sheet/analysis_filters_sheet";
import { getTags } from "../../features/tags/api_calls";
import { selectTagTags } from "../../features/tags/tag_slice";
import { getCategorie } from "../../features/categorie/api_calls";
import { selectCategoriaCategorie } from "../../features/categorie/categoria_slice";
import "./analysis_page.scss";
import { lazyWithRetry } from "../../services/lazy_with_retry";

// Statistiche e Grafici erano due voci di menu distinte: ora sono tre viste
// della stessa schermata.
const MonthStatistics = lazyWithRetry(
  () => import("./month_statistics/month_statistics"),
);
const YearStatistics = lazyWithRetry(
  () => import("./year_statistics/year_statistics"),
);
const ChartsPage = lazyWithRetry(() => import("../charts_page/charts_page"));

type Scope = "month" | "year" | "categories";

const SCOPES: Scope[] = ["month", "year", "categories"];

const isScope = (value: string | null): value is Scope =>
  SCOPES.includes(value as Scope);

const localeTag = () => (getLocale() === "it" ? "it-IT" : "en-GB");

export default function AnalysisPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  // Vista e filtri stanno nell'URL: sopravvivono al refresh e si linkano.
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const tags = useAppSelector(selectTagTags);
  const categorie = useAppSelector(selectCategoriaCategorie);

  const today = new Date();
  const scopeParam = searchParams.get("scope");
  const scope: Scope = isScope(scopeParam) ? scopeParam : "month";
  const year = Number(searchParams.get("anno")) || today.getFullYear();
  const month = Number(searchParams.get("mese")) || today.getMonth() + 1;
  const categoriaId = searchParams.get("categoria");
  // Più sottocategorie in un parametro solo, separate da virgola: la stessa
  // forma che usano i filtri dei Movimenti, così l'URL resta leggibile.
  //
  // Memoizzato sulla stringa grezza: le viste lo mettono fra le dipendenze di
  // un `useEffect`, e un array nuovo a ogni render rifarebbe la chiamata in
  // continuazione.
  const sottoParam = searchParams.get("sotto") ?? "";
  const sottocategoriaIds = useMemo(
    () =>
      sottoParam
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [sottoParam],
  );
  const tagId = searchParams.get("tag");

  // Il foglio dei filtri elenca categorie e tag: qui è l'unico posto che li
  // carica per tutte e tre le viste.
  useEffect(() => {
    dispatch(getTags());
    dispatch(getCategorie());
  }, [dispatch]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }

    setSearchParams(next, { replace: true });
  };

  const applyFilters = (patch: AnalysisFiltersPatch) =>
    update({
      ...(patch.year !== undefined ? { anno: String(patch.year) } : {}),
      ...(patch.month !== undefined ? { mese: String(patch.month) } : {}),
      // Cambiare categoria butta via le sottocategorie: appartenevano all'altra.
      ...(patch.categoria !== undefined
        ? { categoria: patch.categoria, sotto: null }
        : {}),
      ...(patch.sottocategorie !== undefined
        ? {
            sotto:
              patch.sottocategorie.length > 0
                ? patch.sottocategorie.join(",")
                : null,
          }
        : {}),
      ...(patch.tag !== undefined ? { tag: patch.tag } : {}),
    });

  const nameOf = (id: string | null, list: { id: string; nome: string }[]) =>
    list.find((item) => String(item.id) === String(id))?.nome;

  const sottocategorie =
    categorie.find((cat) => String(cat.id) === String(categoriaId))
      ?.sottocategorie ?? [];

  // Solo i filtri accesi si vedono, e toccarli li spegne.
  const activeChips: { key: string; label: string; clear: () => void }[] = [];

  if (categoriaId) {
    activeChips.push({
      key: "categoria",
      label: nameOf(categoriaId, categorie) ?? t("category"),
      clear: () => update({ categoria: null, sotto: null }),
    });
  }

  // Una pillola per sottocategoria accesa: toglierne una non deve spegnere
  // anche le altre.
  for (const id of sottocategoriaIds) {
    activeChips.push({
      key: `sotto-${id}`,
      label: nameOf(id, sottocategorie) ?? t("sub_category"),
      clear: () => {
        const rimaste = sottocategoriaIds.filter((item) => item !== id);
        update({ sotto: rimaste.length > 0 ? rimaste.join(",") : null });
      },
    });
  }

  if (tagId) {
    activeChips.push({
      key: "tag",
      label: nameOf(tagId, tags) ?? t("tag"),
      clear: () => update({ tag: null }),
    });
  }

  const periodLabel =
    scope === "month"
      ? new Intl.DateTimeFormat(localeTag(), {
          month: "long",
          year: "numeric",
        }).format(new Date(year, month - 1, 1))
      : String(year);

  const renderScope = () => {
    switch (scope) {
      case "month":
        return (
          <MonthStatistics
            year={year}
            month={month}
            categoriaId={categoriaId}
            sottocategoriaIds={sottocategoriaIds}
            tagId={tagId}
          />
        );
      case "year":
        return (
          <YearStatistics
            year={year}
            categoriaId={categoriaId}
            sottocategoriaIds={sottocategoriaIds}
            tagId={tagId}
          />
        );
      case "categories":
        return (
          <ChartsPage
            year={year}
            categoriaId={categoriaId}
            sottocategoriaIds={sottocategoriaIds}
            tagId={tagId}
          />
        );
    }
  };

  return (
    <>
      <Page className="analysis-page">
        <PageHeader className="analysis-page__header">
          <div className="analysis-page__top">
            <h1 className="page-title">{t("nav_analysis")}</h1>

            <button
              type="button"
              className="analysis-page__period"
              aria-label={t("filters")}
              onClick={() => setFiltersOpen(true)}
            >
              {periodLabel}
              <i className="ph-bold ph-sliders-horizontal" aria-hidden="true" />
            </button>
          </div>

          <SegmentedControl
            value={scope}
            onChange={(next) => update({ scope: next })}
            ariaLabel={t("nav_analysis")}
            options={[
              { value: "month", label: t("analysis_scope_month") },
              { value: "year", label: t("analysis_scope_year") },
              { value: "categories", label: t("analysis_scope_charts") },
            ]}
          />

          {activeChips.length > 0 && (
            <div className="analysis-page__chips">
              {activeChips.map((chip) => (
                <Chip
                  key={chip.key}
                  label={chip.label}
                  icon="ph-bold ph-x"
                  variant="active"
                  onClick={chip.clear}
                />
              ))}
            </div>
          )}
        </PageHeader>

        <PageContent>
          <Suspense fallback={null}>{renderScope()}</Suspense>
        </PageContent>
      </Page>

      <AnalysisFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        year={year}
        month={scope === "month" ? month : undefined}
        categoriaId={categoriaId}
        sottocategoriaIds={sottocategoriaIds}
        tagId={tagId}
        onChange={applyFilters}
      />
    </>
  );
}
