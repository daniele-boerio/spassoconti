import { Column } from "primereact/column";
import {
  DataTable as PrimeDataTable,
  type DataTableValue,
  type DataTableValueArray,
} from "primereact/datatable";
import { confirmPopup } from "primereact/confirmpopup";
import { type ReactNode } from "react";
import Button from "../legacy_button/legacy_button";
import { useI18n } from "../../i18n/use-i18n";
import "./table_visualization.scss";

export type TableVisualizationProps = {
  className?: string;
  invisible?: boolean;
  id?: string;
  dataKey?: string;
  value: DataTableValueArray;
  columns: VisualizationColumnProps[];
  disabledRows?: string[];
  paginator?: PaginatorProps;
  selectionRow?: SelectionRow;
  filters?: Record<string, { value: any; mode?: string }>;
  deleteRow?: (id: string) => void;
  customRowClassName?: (rowData: DataTableValue) => string | undefined;
  scrollable?: boolean;
  loading?: boolean;
};

export type SelectionRow = {
  selectedRow: DataTableValue | undefined;
  onSelectionChange: (value: DataTableValue) => void;
};

export type PaginatorProps = {
  row: number;
  lazy?: boolean;
  totalRecords?: number;
  first?: number;
  onPage?: (event: any) => void;
  loading?: boolean;
};

export type VisualizationColumnProps = {
  field?: string;
  header?: string | ReactNode | ((rowData: DataTableValue) => ReactNode);
  body?: ReactNode | ((rowData: DataTableValue) => ReactNode);
  width?: string;
  sortable?: boolean;
  filter?: boolean;
  className?: string;
};

export default function TableVisualization(props: TableVisualizationProps) {
  const { t } = useI18n();

  return (
    <div
      className={`div-table-visualization ${props.className ?? ""} ${props.invisible ? "invisible" : ""}`}
    >
      <PrimeDataTable
        id={props.id}
        value={props.value}
        dataKey={props.dataKey || "id"}
        loading={props.paginator?.loading || props.loading} // Loading overlay di PrimeReact
        rowClassName={(rowData) =>
          props.disabledRows?.includes(rowData.id)
            ? "table-row-disabled"
            : props.customRowClassName
              ? props.customRowClassName(rowData)
              : undefined
        }
        // Paginazione
        paginator={!!props.paginator}
        rows={props.paginator?.row || 10}
        lazy={props.paginator?.lazy}
        totalRecords={props.paginator?.totalRecords}
        first={props.paginator?.first}
        onPage={props.paginator?.onPage}
        // Selezione
        selectionMode={props.selectionRow ? "single" : undefined}
        selection={props.selectionRow?.selectedRow}
        onSelectionChange={(e: any) =>
          props.selectionRow?.onSelectionChange(e.value)
        }
        scrollable={props.scrollable}
        scrollHeight={props.scrollable ? "50vh" : undefined}
        // Altro
        removableSort
        breakpoint="60rem"
      >
        {props.columns.map((col, i) => (
          <Column
            className={col.className}
            key={col.field || `col-${i}`}
            field={col.field}
            header={col.header}
            sortable={col.sortable}
            filter={col.filter}
            style={col.width ? { width: col.width } : { minWidth: "7.5rem" }}
            body={col.body} // PrimeReact gestisce sia ReactNode che Function
          />
        ))}

        {props.deleteRow && (
          <Column
            style={{ width: "4rem" }}
            body={(rowData) => (
              <Button
                icon="ph-bold ph-trash"
                className="trasparent-danger-button"
                compact
                onClick={(event) =>
                  confirmPopup({
                    target: event.currentTarget as HTMLElement,
                    message: t("delete_message"),
                    icon: "ph-bold ph-warning",
                    acceptClassName: "p-button-danger",
                    acceptLabel: t("yes"),
                    rejectLabel: t("no"),
                    accept: () =>
                      props.deleteRow!(rowData[props.dataKey || "id"]),
                    reject: () => {},
                  })
                }
              />
            )}
          />
        )}
      </PrimeDataTable>
    </div>
  );
}
