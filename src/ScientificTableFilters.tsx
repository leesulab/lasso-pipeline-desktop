import {
  useEffect,
  useState,
} from "react";
import {
  Plus,
  Trash2,
} from "lucide-react";
import type {
  PipelineTableColumn,
  PipelineTableFilter,
  PipelineTableFilterOperator,
} from "./api";

type DraftFilter = {
  id: number;
  column: string;
  operator: PipelineTableFilterOperator;
  value: string;
};

type ScientificTableFiltersProps = {
  columns: PipelineTableColumn[];
  appliedFilters: PipelineTableFilter[];
  disabled: boolean;
  onApply: (filters: PipelineTableFilter[]) => void;
};

const operatorLabels:
Record<PipelineTableFilterOperator, string> = {
  eq: "égal à",
  ne: "différent de",
  lt: "inférieur à",
  lte: "inférieur ou égal à",
  gt: "supérieur à",
  gte: "supérieur ou égal à",
  contains: "contient",
  starts_with: "commence par",
  is_null: "est vide",
  not_null: "n’est pas vide",
};

const numericOperators:
PipelineTableFilterOperator[] = [
  "eq",
  "ne",
  "lt",
  "lte",
  "gt",
  "gte",
  "is_null",
  "not_null",
];

const textOperators:
PipelineTableFilterOperator[] = [
  "contains",
  "starts_with",
  "eq",
  "ne",
  "is_null",
  "not_null",
];

function isNumericColumn(
  column: PipelineTableColumn | undefined,
): boolean {
  if (!column) {
    return false;
  }

  return /int|float|double|decimal/i.test(
    column.type,
  );
}

function operatorNeedsValue(
  operator: PipelineTableFilterOperator,
): boolean {
  return (
    operator !== "is_null" &&
    operator !== "not_null"
  );
}

function createDraftFilter(
  id: number,
  columns: PipelineTableColumn[],
): DraftFilter {
  const firstColumn = columns[0];

  return {
    id,
    column: firstColumn?.name ?? "",
    operator: isNumericColumn(firstColumn)
      ? "gte"
      : "contains",
    value: "",
  };
}

function appliedToDrafts(
  filters: PipelineTableFilter[],
): DraftFilter[] {
  return filters.map((filter, index) => ({
    id: index + 1,
    column: filter.column,
    operator: filter.operator,
    value:
      filter.value === undefined ||
      filter.value === null
        ? ""
        : String(filter.value),
  }));
}

export function ScientificTableFilters({
  columns,
  appliedFilters,
  disabled,
  onApply,
}: ScientificTableFiltersProps) {
  const [drafts, setDrafts] =
    useState<DraftFilter[]>(
      appliedFilters.length > 0
        ? appliedToDrafts(appliedFilters)
        : [createDraftFilter(1, columns)],
    );

  useEffect(() => {
    setDrafts(
      appliedFilters.length > 0
        ? appliedToDrafts(appliedFilters)
        : [createDraftFilter(1, columns)],
    );
  }, [appliedFilters, columns]);

  function updateDraft(
    id: number,
    changes: Partial<DraftFilter>,
  ) {
    const next = drafts.map((draft) =>
      draft.id === id
        ? {
            ...draft,
            ...changes,
          }
        : draft,
    );

    setDrafts(next);
  }

  function buildFilters(
    currentDrafts: DraftFilter[],
    availableColumns: PipelineTableColumn[],
  ): PipelineTableFilter[] {
    return currentDrafts.flatMap((draft) => {
      const column = availableColumns.find(
        (item) => item.name === draft.column,
      );

      if (!column) {
        return [];
      }

      if (!operatorNeedsValue(draft.operator)) {
        return [
          {
            column: draft.column,
            operator: draft.operator,
          },
        ];
      }

      if (!draft.value.trim()) {
        return [];
      }

      const value = isNumericColumn(column)
        ? Number(draft.value)
        : draft.value;

      if (
        typeof value === "number" &&
        Number.isNaN(value)
      ) {
        return [];
      }

      return [
        {
          column: draft.column,
          operator: draft.operator,
          value,
        },
      ];
    });
  }

  function addFilter() {
    const nextId =
      Math.max(0, ...drafts.map((draft) => draft.id))
      + 1;

    setDrafts((current) => [
      ...current,
      createDraftFilter(nextId, columns),
    ]);
  }

  function removeFilter(id: number) {
    setDrafts((current) => {
      const remaining = current.filter(
        (draft) => draft.id !== id,
      );

      return remaining.length > 0
        ? remaining
        : [createDraftFilter(id + 1, columns)];
    });
  }

  return (
    <div className="scientific-filter-editor">
      <div className="scientific-filter-list">
        {drafts.map((draft) => {
          const selectedColumn = columns.find(
            (column) =>
              column.name === draft.column,
          );

          const operators = isNumericColumn(
            selectedColumn,
          )
            ? numericOperators
            : textOperators;

          return (
            <div
              className="scientific-filter-row"
              key={draft.id}
            >
              <select
                value={draft.column}
                disabled={disabled}
                onChange={(event) => {
                  const column = columns.find(
                    (item) =>
                      item.name === event.target.value,
                  );

                  updateDraft(draft.id, {
                    column: event.target.value,
                    operator: isNumericColumn(column)
                      ? "gte"
                      : "contains",
                    value: "",
                  });
                }}
              >
                {columns.map((column) => (
                  <option
                    value={column.name}
                    key={column.name}
                  >
                    {column.name}
                  </option>
                ))}
              </select>

              <select
                value={draft.operator}
                disabled={disabled}
                onChange={(event) =>
                  updateDraft(draft.id, {
                    operator:
                      event.target.value as
                        PipelineTableFilterOperator,
                  })
                }
              >
                {operators.map((operator) => (
                  <option
                    value={operator}
                    key={operator}
                  >
                    {operatorLabels[operator]}
                  </option>
                ))}
              </select>

              {operatorNeedsValue(
                draft.operator,
              ) ? (
                <input
                  type={
                    isNumericColumn(selectedColumn)
                      ? "number"
                      : "text"
                  }
                  value={draft.value}
                  disabled={disabled}
                  placeholder={
                    isNumericColumn(selectedColumn)
                      ? "Valeur numérique"
                      : "Texte recherché"
                  }
                  onChange={(event) =>
                    updateDraft(draft.id, {
                      value: event.target.value,
                    })
                  }
                />
              ) : (
                <span className="scientific-filter-no-value">
                  aucune valeur requise
                </span>
              )}

              <button
                type="button"
                disabled={disabled}
                title="Supprimer ce filtre"
                onClick={() =>
                  removeFilter(draft.id)
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="scientific-filter-actions">
        <button
          type="button"
          disabled={
            disabled ||
            columns.length === 0 ||
            appliedFilters.length >= 20
          }
          onClick={addFilter}
        >
          <Plus size={14} />
          Ajouter un filtre
        </button>

        <button
          type="button"
          disabled={disabled}
          className="scientific-filter-apply"
          onClick={() =>
            onApply(
              buildFilters(
                drafts,
                columns,
              ),
            )
          }
        >
          Appliquer
        </button>

        <button
          type="button"
          disabled={
            disabled ||
            (
              appliedFilters.length === 0 &&
              drafts.length === 1 &&
              !drafts[0].value
            )
          }
          onClick={() => {
            setDrafts([
              createDraftFilter(
                Date.now(),
                columns,
              ),
            ]);
            onApply([]);
          }}
        >
          Réinitialiser
        </button>
      </div>

      <small>
        Les conditions sont combinées avec ET et
        appliquées à l’ensemble du fichier Parquet.
      </small>
    </div>
  );
}
