import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  save,
} from "@tauri-apps/plugin-dialog";
import {
  fetchPipelineTablePreview,
  type PipelineResultEntry,
  type PipelineTableFilter,
  type PipelineTablePreview,
} from "./api";
import {
  ScientificTableFilters,
} from "./ScientificTableFilters";
import {
  ScientificTableViews,
} from "./ScientificTableViews";
import {
  exportTableViewsFile,
  importTableViewsFile,
} from "./tableViewFileActions";
import {
  createUserTableView,
  loadUserTableViews,
  saveUserTableViews,
  tableViewsForResult,
  type SavedTableView,
} from "./tableViews";
import {
  exportPipelineTableViewCsv,
  type BackendStatus,
} from "./backend";

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_VISIBLE_COLUMNS = 8;

type ScientificTablePreviewProps = {
  backendStatus: BackendStatus;
  jobId: string;
  result: PipelineResultEntry;
  requestedFilters: PipelineTableFilter[];
};

function formatCell(
  value: boolean | number | string | null,
): string {
  if (value === null) {
    return "∅";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return String(value);
    }

    return new Intl.NumberFormat("fr-FR", {
      maximumSignificantDigits: 8,
    }).format(value);
  }

  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }

  return value;
}

export function ScientificTablePreview({
  backendStatus,
  jobId,
  result,
  requestedFilters,
}: ScientificTablePreviewProps) {
  const [preview, setPreview] =
    useState<PipelineTablePreview | null>(null);

  const [offset, setOffset] = useState(0);

  const [pageSize, setPageSize] =
    useState(DEFAULT_PAGE_SIZE);

  const [sortBy, setSortBy] =
    useState<string | null>(null);

  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc" | null>(null);

  const [selectedColumns, setSelectedColumns] =
    useState<string[]>([]);

  const [availableColumns, setAvailableColumns] =
    useState<PipelineTablePreview["columns"]>([]);

  const [columnSelectorOpen, setColumnSelectorOpen] =
    useState(false);

  const [filterEditorOpen, setFilterEditorOpen] =
    useState(false);

  const [viewEditorOpen, setViewEditorOpen] =
    useState(false);

  const [viewName, setViewName] =
    useState("");

  const [activeViewId, setActiveViewId] =
    useState<string | null>(null);

  const [userViews, setUserViews] =
    useState<SavedTableView[]>(
      () => loadUserTableViews(),
    );

  const [
    tableViewsTransferPending,
    setTableViewsTransferPending,
  ] = useState(false);

  const [
    tableViewsTransferMessage,
    setTableViewsTransferMessage,
  ] = useState<string | null>(null);

  const [appliedFilters, setAppliedFilters] =
    useState<PipelineTableFilter[]>([]);

  const requestedFiltersKey =
    JSON.stringify(requestedFilters);

  const [
    csvExportPending,
    setCsvExportPending,
  ] = useState(false);

  const [
    csvExportMessage,
    setCsvExportMessage,
  ] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const filters = JSON.parse(
      requestedFiltersKey,
    ) as PipelineTableFilter[];

    setAppliedFilters(filters);
    setOffset(0);
    setFilterEditorOpen(
      filters.length > 0,
    );
  }, [requestedFiltersKey]);

  useEffect(() => {
    setOffset(0);
    setPageSize(DEFAULT_PAGE_SIZE);
    setActiveViewId(null);
    setSortBy(null);
    setSortDirection(null);
    setSelectedColumns([]);
    setAvailableColumns([]);
    setPreview(null);
    setError(null);
  }, [jobId, result.id]);

  useEffect(() => {
    if (
      !backendStatus.running ||
      result.kind !== "table"
    ) {
      return;
    }

    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setError(null);

      try {
        const loadedPreview =
          await fetchPipelineTablePreview(
            backendStatus,
            jobId,
            result.id,
            {
              offset,
              limit: pageSize,
              columns:
                availableColumns.length > 0 &&
                selectedColumns.length > 0
                  ? selectedColumns
                  : undefined,
              sortBy: sortBy ?? undefined,
              sortDirection:
                sortDirection ?? undefined,
              filters:
                appliedFilters.length > 0
                  ? appliedFilters
                  : undefined,
            },
          );

        if (cancelled) {
          return;
        }

        setPreview(loadedPreview);

        if (availableColumns.length === 0) {
          setAvailableColumns(
            loadedPreview.columns,
          );
        }

        if (selectedColumns.length === 0) {
          setSelectedColumns(
            loadedPreview.columns
              .slice(0, DEFAULT_VISIBLE_COLUMNS)
              .map((column) => column.name),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(String(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [
    backendStatus,
    jobId,
    result.id,
    result.kind,
    offset,
    pageSize,
    selectedColumns,
    availableColumns.length,
    sortBy,
    sortDirection,
    appliedFilters,
  ]);

  const availableViews = useMemo(
    () =>
      tableViewsForResult(
        result.id,
        userViews,
      ),
    [result.id, userViews],
  );

  const activeView = useMemo(
    () =>
      availableViews.find(
        (view) => view.id === activeViewId,
      ) ?? null,
    [activeViewId, availableViews],
  );

  const activeViewModified = useMemo(() => {
    if (!activeView) {
      return false;
    }

    return (
      JSON.stringify(activeView.columns) !==
        JSON.stringify(selectedColumns) ||
      JSON.stringify(activeView.filters) !==
        JSON.stringify(appliedFilters) ||
      activeView.sortBy !== sortBy ||
      activeView.sortDirection !== sortDirection ||
      activeView.pageSize !== pageSize
    );
  }, [
    activeView,
    selectedColumns,
    appliedFilters,
    sortBy,
    sortDirection,
    pageSize,
  ]);

  const pageNumber = Math.floor(
    offset / pageSize,
  ) + 1;

  const pageCount = preview
    ? Math.max(
        1,
        Math.ceil(preview.total / pageSize),
      )
    : 1;

  const visibleColumnNames = useMemo(
    () =>
      preview?.columns.map(
        (column) => column.name,
      ) ?? [],
    [preview],
  );

  function suggestedCsvFilename(): string {
    const baseName = result.title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `${
      baseName || result.id
    }-vue.csv`;
  }

  async function exportCurrentViewCsv() {
    if (
      csvExportPending ||
      loading ||
      selectedColumns.length === 0
    ) {
      return;
    }

    setCsvExportPending(true);
    setCsvExportMessage(null);
    setError(null);

    try {
      const proposedFilename =
        suggestedCsvFilename();

      const destinationPath = await save({
        title: "Exporter la vue tabulaire en CSV",
        defaultPath: proposedFilename,
        filters: [
          {
            name: "Table CSV",
            extensions: ["csv"],
          },
        ],
      });

      if (!destinationPath) {
        return;
      }

      const writtenBytes =
        await exportPipelineTableViewCsv({
          jobId,
          resultId: result.id,
          columns: selectedColumns,
          filters: appliedFilters,
          sortBy,
          sortDirection,
          filename: proposedFilename,
          destinationPath,
        });

      setCsvExportMessage(
        `Vue CSV exportée : ${writtenBytes.toLocaleString(
          "fr-FR",
        )} octets`,
      );
    } catch (exportError) {
      setError(
        `Export CSV impossible : ${String(
          exportError,
        )}`,
      );
    } finally {
      setCsvExportPending(false);
    }
  }

  async function importSavedViews() {
    if (tableViewsTransferPending) {
      return;
    }

    setTableViewsTransferPending(true);
    setTableViewsTransferMessage(null);
    setError(null);

    try {
      const imported =
        await importTableViewsFile(
          userViews,
        );

      if (!imported) {
        return;
      }

      const updatedViews = [
        ...userViews,
        ...imported.importedViews,
      ];

      saveUserTableViews(updatedViews);
      setUserViews(updatedViews);

      setTableViewsTransferMessage(
        `${imported.importedViews.length} vue(s) importée(s)`,
      );
    } catch (importError) {
      setError(
        `Import des vues impossible : ${String(
          importError,
        )}`,
      );
    } finally {
      setTableViewsTransferPending(false);
    }
  }

  async function exportSavedViews() {
    if (tableViewsTransferPending) {
      return;
    }

    setTableViewsTransferPending(true);
    setTableViewsTransferMessage(null);
    setError(null);

    try {
      const destination =
        await exportTableViewsFile(
          userViews,
        );

      if (!destination) {
        return;
      }

      setTableViewsTransferMessage(
        `${userViews.length} vue(s) utilisateur exportée(s)`,
      );
    } catch (exportError) {
      setError(
        `Export des vues impossible : ${String(
          exportError,
        )}`,
      );
    } finally {
      setTableViewsTransferPending(false);
    }
  }

  function applySavedView(
    view: SavedTableView,
  ) {
    const validColumnNames = new Set(
      availableColumns.map(
        (column) => column.name,
      ),
    );

    const validColumns = view.columns.filter(
      (column) =>
        validColumnNames.has(column),
    );

    const validFilters = view.filters.filter(
      (filter) =>
        validColumnNames.has(filter.column),
    );

    const validSortBy =
      view.sortBy &&
      validColumnNames.has(view.sortBy)
        ? view.sortBy
        : null;

    setSelectedColumns(
      validColumns.length > 0
        ? validColumns
        : availableColumns
            .slice(0, DEFAULT_VISIBLE_COLUMNS)
            .map((column) => column.name),
    );

    setAppliedFilters(validFilters);
    setPageSize(
      [25, 50, 100].includes(view.pageSize)
        ? view.pageSize
        : DEFAULT_PAGE_SIZE,
    );
    setSortBy(validSortBy);
    setSortDirection(
      validSortBy
        ? view.sortDirection ?? "asc"
        : null,
    );

    setOffset(0);
    setFilterEditorOpen(
      validFilters.length > 0,
    );
    setColumnSelectorOpen(false);
    setViewEditorOpen(false);
    setActiveViewId(view.id);
    setError(null);
  }

  function saveCurrentView() {
    try {
      const view = createUserTableView(
        viewName,
        result.id,
        selectedColumns,
        appliedFilters,
        sortBy,
        sortDirection,
        pageSize,
      );

      const updatedViews = [
        ...userViews,
        view,
      ];

      saveUserTableViews(updatedViews);
      setUserViews(updatedViews);
      setActiveViewId(view.id);
      setViewName("");
      setError(null);
    } catch (saveError) {
      setError(String(saveError));
    }
  }

  function updateActiveView() {
    if (!activeView || activeView.builtIn) {
      return;
    }

    const updatedViews = userViews.map((view) =>
      view.id === activeView.id
        ? {
            ...view,
            columns: [...selectedColumns],
            filters: appliedFilters.map(
              (filter) => ({
                ...filter,
              }),
            ),
            sortBy,
            sortDirection,
            pageSize,
          }
        : view,
    );

    saveUserTableViews(updatedViews);
    setUserViews(updatedViews);
    setError(null);
  }

  function deleteSavedView(viewId: string) {
    const updatedViews = userViews.filter(
      (view) => view.id !== viewId,
    );

    saveUserTableViews(updatedViews);
    setUserViews(updatedViews);

    if (activeViewId === viewId) {
      setActiveViewId(null);
    }
  }

  function cycleSort(columnName: string) {
    setOffset(0);

    if (sortBy !== columnName) {
      setSortBy(columnName);
      setSortDirection("asc");
      return;
    }

    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }

    setSortBy(null);
    setSortDirection(null);
  }

  function sortIndicator(
    columnName: string,
  ): string {
    if (sortBy !== columnName) {
      return "↕";
    }

    return sortDirection === "desc"
      ? "↓"
      : "↑";
  }

  function toggleColumn(columnName: string) {
    setSelectedColumns((current) => {
      if (current.includes(columnName)) {
        if (current.length === 1) {
          return current;
        }

        if (sortBy === columnName) {
          setSortBy(null);
          setSortDirection(null);
        }

        return current.filter(
          (name) => name !== columnName,
        );
      }

      return [...current, columnName];
    });

    setOffset(0);
  }

  if (error) {
    return (
      <div className="scientific-table-error">
        Prévisualisation impossible : {error}
      </div>
    );
  }

  return (
    <div className="scientific-table-preview">
      <header className="scientific-table-toolbar">
        <div>
          <strong>
            {preview
              ? `${preview.total.toLocaleString(
                  "fr-FR",
                )} ligne(s)`
              : "Chargement…"}
          </strong>

          {preview && (
            <span>
              Page {pageNumber} sur {pageCount}
            </span>
          )}

          {activeView && (
            <span className="scientific-active-view">
              Vue active :{" "}
              <strong>{activeView.name}</strong>
              {activeViewModified && (
                <em> · modifiée</em>
              )}
            </span>
          )}
        </div>

        <div className="scientific-table-toolbar-actions">
          <button
            type="button"
            className={
              viewEditorOpen
                ? "is-active"
                : ""
            }
            disabled={availableColumns.length === 0}
            onClick={() =>
              setViewEditorOpen(
                (current) => !current,
              )
            }
          >
            Vues
            {availableViews.length > 0 && (
              <span className="scientific-filter-count">
                {availableViews.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={
              appliedFilters.length > 0
                ? "is-active"
                : ""
            }
            onClick={() =>
              setFilterEditorOpen(
                (current) => !current,
              )
            }
          >
            Filtres
            {appliedFilters.length > 0 && (
              <span className="scientific-filter-count">
                {appliedFilters.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setColumnSelectorOpen(
                (current) => !current,
              )
            }
          >
            Colonnes
          </button>

          <button
            type="button"
            className="scientific-table-export-view"
            disabled={
              loading ||
              csvExportPending ||
              selectedColumns.length === 0
            }
            title={
              "Exporter toutes les lignes correspondant " +
              "aux colonnes, filtres et tri actifs"
            }
            onClick={() =>
              void exportCurrentViewCsv()
            }
          >
            {csvExportPending
              ? "Export CSV…"
              : "Exporter la vue CSV"}
          </button>

          <label className="scientific-page-size">
            <span>Lignes</span>

            <select
              value={pageSize}
              disabled={loading}
              onChange={(event) => {
                setPageSize(
                  Number(event.target.value),
                );
                setOffset(0);
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <button
            type="button"
            disabled={
              loading ||
              !preview ||
              offset === 0
            }
            onClick={() =>
              setOffset((current) =>
                Math.max(0, current - pageSize),
              )
            }
          >
            Précédent
          </button>

          <button
            type="button"
            disabled={
              loading ||
              !preview ||
              !preview.hasMore
            }
            onClick={() =>
              setOffset(
                (current) =>
                  current + pageSize,
              )
            }
          >
            Suivant
          </button>
        </div>
      </header>

      {csvExportMessage && (
        <div className="scientific-table-export-success">
          {csvExportMessage}
        </div>
      )}

      {viewEditorOpen &&
        availableColumns.length > 0 && (
          <ScientificTableViews
            views={availableViews}
            viewName={viewName}
            disabled={loading}
            onViewNameChange={setViewName}
            onApply={applySavedView}
            onSave={saveCurrentView}
            onUpdate={updateActiveView}
            activeView={activeView}
            activeViewModified={
              activeViewModified
            }
            transferPending={
              tableViewsTransferPending
            }
            transferMessage={
              tableViewsTransferMessage
            }
            onImport={() =>
              void importSavedViews()
            }
            onExport={() =>
              void exportSavedViews()
            }
            onDelete={deleteSavedView}
          />
        )}

      {filterEditorOpen &&
        availableColumns.length > 0 && (
          <ScientificTableFilters
            columns={availableColumns}
            appliedFilters={appliedFilters}
            disabled={loading}
            onApply={(filters) => {
              setAppliedFilters(filters);
              setOffset(0);
            }}
          />
        )}

      {columnSelectorOpen && preview && (
        <div className="scientific-column-selector">
          <div className="scientific-column-selector-actions">
            <button
              type="button"
              onClick={() => {
                setSelectedColumns(
                  availableColumns.map(
                    (column) => column.name,
                  ),
                );
                setOffset(0);
              }}
            >
              Tout sélectionner
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedColumns(
                  availableColumns
                    .slice(
                      0,
                      DEFAULT_VISIBLE_COLUMNS,
                    )
                    .map(
                      (column) => column.name,
                    ),
                );
                setOffset(0);
              }}
            >
              Sélection courte
            </button>
          </div>

          <div className="scientific-column-options">
            {availableColumns.map((column) => (
              <label key={column.name}>
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(
                    column.name,
                  )}
                  onChange={() =>
                    toggleColumn(column.name)
                  }
                />

                <span>
                  <strong>{column.name}</strong>
                  <small>{column.type}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {loading && !preview && (
        <div className="scientific-results-empty">
          Chargement de la table…
        </div>
      )}

      {preview && (
        <div className="scientific-table-scroll">
          <table>
            <thead>
              <tr>
                {visibleColumnNames.map(
                  (columnName) => {
                    const column =
                      preview.columns.find(
                        (item) =>
                          item.name === columnName,
                      );

                    return (
                      <th
                        key={columnName}
                        aria-sort={
                          sortBy !== columnName
                            ? "none"
                            : sortDirection === "desc"
                              ? "descending"
                              : "ascending"
                        }
                      >
                        <button
                          type="button"
                          className={
                            sortBy === columnName
                              ? "scientific-table-sort is-active"
                              : "scientific-table-sort"
                          }
                          title={
                            sortBy !== columnName
                              ? "Trier par ordre croissant"
                              : sortDirection === "asc"
                                ? "Trier par ordre décroissant"
                                : "Supprimer le tri"
                          }
                          onClick={() =>
                            cycleSort(columnName)
                          }
                        >
                          <span>{columnName}</span>

                          <strong
                            aria-hidden="true"
                            className="scientific-sort-indicator"
                          >
                            {sortIndicator(
                              columnName,
                            )}
                          </strong>
                        </button>

                        <small>
                          {column?.type ?? ""}
                        </small>
                      </th>
                    );
                  },
                )}
              </tr>
            </thead>

            <tbody>
              {preview.rows.map(
                (row, rowIndex) => (
                  <tr
                    key={`${offset}-${rowIndex}`}
                  >
                    {visibleColumnNames.map(
                      (columnName) => (
                        <td key={columnName}>
                          {formatCell(
                            row[columnName] ??
                              null,
                          )}
                        </td>
                      ),
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>

          {preview.rows.length === 0 && (
            <div className="scientific-results-empty">
              Aucune ligne sur cette page.
            </div>
          )}

          {loading && (
            <div className="scientific-table-loading">
              Actualisation…
            </div>
          )}
        </div>
      )}

      {preview && (
        <footer className="scientific-table-footer">
          Lignes{" "}
          {preview.returned > 0
            ? preview.offset + 1
            : 0}
          –{preview.offset + preview.returned} sur{" "}
          {preview.total.toLocaleString("fr-FR")}
          {" · "}
          maximum {pageSize} lignes par page
        </footer>
      )}
    </div>
  );
}
