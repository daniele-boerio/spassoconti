import Sheet from "../../sheet/sheet";
import Chip from "../../chip/chip";
import { useI18n } from "../../../i18n/use-i18n";
import { getLocale } from "../../../i18n";
import { useAppSelector } from "../../../store/store";
import { selectTagTags } from "../../../features/tags/tag_slice";
import { selectCategoriaCategorie } from "../../../features/categorie/categoria_slice";
import "./analysis_filters_sheet.scss";

// Quanto indietro si può andare: oltre non c'è storia da guardare.
const YEARS_BACK = 5;

export type AnalysisFilters = {
  year: number;
  /** Assente quando il periodo è un anno intero (viste Anno e Grafici). */
  month?: number;
  categoriaId: string | null;
  /** Più d'una: le sottocategorie si accendono a piacere, non a turno. */
  sottocategoriaIds: string[];
  tagId: string | null;
};

export type AnalysisFiltersPatch = {
  year?: number;
  month?: number;
  categoria?: string | null;
  /** L'elenco intero dopo il tocco, non il singolo id: vuoto vuol dire tutte. */
  sottocategorie?: string[];
  tag?: string | null;
};

type AnalysisFiltersSheetProps = AnalysisFilters & {
  open: boolean;
  onClose: () => void;
  /**
   * Falso dove la categoria la decide la schermata (il dettaglio di una
   * categoria): lì sceglierne un'altra non vorrebbe dire niente.
   */
  showTaxonomy?: boolean;
  onChange: (patch: AnalysisFiltersPatch) => void;
};

/**
 * I filtri dell'Analisi: periodo, categoria, sottocategoria e tag. Sta in un
 * foglio invece che in cinque dropdown perché l'intestazione della schermata
 * ha spazio per una pillola sola.
 */
export default function AnalysisFiltersSheet({
  open,
  onClose,
  year,
  month,
  categoriaId,
  sottocategoriaIds,
  tagId,
  showTaxonomy = true,
  onChange,
}: AnalysisFiltersSheetProps) {
  const { t } = useI18n();
  const tags = useAppSelector(selectTagTags);
  const categorie = useAppSelector(selectCategoriaCategorie);

  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: YEARS_BACK + 1 },
    (_, index) => currentYear - index,
  );

  const monthName = (value: number) =>
    new Intl.DateTimeFormat(getLocale() === "it" ? "it-IT" : "en-GB", {
      month: "short",
    }).format(new Date(year, value - 1, 1));

  // Le sottocategorie hanno senso solo dentro la loro categoria: senza una
  // categoria scelta si guarderebbe un elenco lungo e senza contesto.
  const sottocategorie =
    categorie.find((cat) => String(cat.id) === String(categoriaId))
      ?.sottocategorie ?? [];

  const isOn = (id: string) =>
    sottocategoriaIds.some((item) => String(item) === String(id));

  // Toccare una sottocategoria accesa la spegne: è l'unico modo di togliere
  // una voce da una selezione multipla senza azzerarla tutta.
  const toggle = (id: string) =>
    onChange({
      sottocategorie: isOn(id)
        ? sottocategoriaIds.filter((item) => String(item) !== String(id))
        : [...sottocategoriaIds, String(id)],
    });

  return (
    <Sheet open={open} onClose={onClose} title={t("filters")}>
      <section className="analysis-filters__section">
        <span className="analysis-filters__label">{t("year")}</span>
        <div className="analysis-filters__chips">
          {years.map((value) => (
            <Chip
              key={value}
              label={String(value)}
              variant={value === year ? "accent" : "solid"}
              onClick={() => onChange({ year: value })}
            />
          ))}
        </div>
      </section>

      {month !== undefined && (
        <section className="analysis-filters__section">
          <span className="analysis-filters__label">{t("month")}</span>
          <div className="analysis-filters__months">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
              <Chip
                key={value}
                className="analysis-filters__month"
                label={monthName(value)}
                variant={value === month ? "accent" : "solid"}
                onClick={() => onChange({ month: value })}
              />
            ))}
          </div>
        </section>
      )}

      {showTaxonomy && categorie.length > 0 && (
        <section className="analysis-filters__section">
          <span className="analysis-filters__label">{t("category")}</span>
          <div className="analysis-filters__chips">
            <Chip
              label={t("mov_type_all")}
              variant={categoriaId ? "solid" : "accent"}
              onClick={() => onChange({ categoria: null })}
            />

            {categorie.map((categoria) => (
              <Chip
                key={categoria.id}
                label={categoria.nome}
                variant={
                  String(categoria.id) === String(categoriaId)
                    ? "accent"
                    : "solid"
                }
                onClick={() => onChange({ categoria: categoria.id })}
              />
            ))}
          </div>
        </section>
      )}

      {/* La sezione compare solo dopo aver scelto una categoria: le
          sottocategorie di tutte insieme sarebbero un elenco senza contesto.
          Se quella scelta non ne ha, lo diciamo — prima non compariva niente,
          e da fuori sembrava che il filtro mancasse. */}
      {showTaxonomy && categoriaId && sottocategorie.length === 0 && (
        <section className="analysis-filters__section">
          <span className="analysis-filters__label">{t("sub_category")}</span>
          <p className="analysis-filters__empty">
            {t("filters_no_subcategories")}
          </p>
        </section>
      )}

      {showTaxonomy && sottocategorie.length > 0 && (
        <section className="analysis-filters__section">
          <span className="analysis-filters__label">{t("sub_category")}</span>
          <div className="analysis-filters__chips">
            <Chip
              label={t("mov_type_all")}
              variant={sottocategoriaIds.length > 0 ? "solid" : "accent"}
              onClick={() => onChange({ sottocategorie: [] })}
            />

            {sottocategorie.map((sotto) => (
              <Chip
                key={sotto.id}
                label={sotto.nome}
                icon={isOn(sotto.id) ? "ph-bold ph-check" : undefined}
                variant={isOn(sotto.id) ? "accent" : "solid"}
                onClick={() => toggle(sotto.id)}
              />
            ))}
          </div>
        </section>
      )}

      {tags.length > 0 && (
        <section className="analysis-filters__section">
          <span className="analysis-filters__label">{t("tag")}</span>
          <div className="analysis-filters__chips">
            <Chip
              label={t("mov_type_all")}
              variant={tagId ? "solid" : "accent"}
              onClick={() => onChange({ tag: null })}
            />

            {tags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.nome}
                variant={String(tag.id) === String(tagId) ? "accent" : "solid"}
                onClick={() => onChange({ tag: tag.id })}
              />
            ))}
          </div>
        </section>
      )}
    </Sheet>
  );
}
