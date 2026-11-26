import type {
  PipelineTableFilter,
} from "./api";

export type TableViewSortDirection =
  | "asc"
  | "desc"
  | null;

export type SavedTableView = {
  version: 1;
  id: string;
  name: string;
  resultId: string;
  builtIn: boolean;
  createdAt: string | null;
  columns: string[];
  filters: PipelineTableFilter[];
  sortBy: string | null;
  sortDirection: TableViewSortDirection;
  pageSize: number;
};

const STORAGE_KEY = "lasso.table-views.v1";
const VIEW_VERSION = 1;

const identifiedFeatureColumns = [
  "feature_idx",
  "mz",
  "retention_time",
  "drift_time",
  "match_name",
  "global_score",
  "confidence_level",
];

export const builtInTableViews:
SavedTableView[] = [
  {
    version: VIEW_VERSION,
    id: "builtin-reliable-identifications",
    name: "Identifications fiables",
    resultId: "identified-features",
    builtIn: true,
    createdAt: null,
    columns: identifiedFeatureColumns,
    filters: [
      {
        column: "confidence_level",
        operator: "lte",
        value: 3,
      },
    ],
    sortBy: "confidence_level",
    sortDirection: "asc",
    pageSize: 50,
  },
  {
    version: VIEW_VERSION,
    id: "builtin-high-scores",
    name: "Scores élevés",
    resultId: "identified-features",
    builtIn: true,
    createdAt: null,
    columns: identifiedFeatureColumns,
    filters: [
      {
        column: "global_score",
        operator: "gte",
        value: 0.7,
      },
    ],
    sortBy: "global_score",
    sortDirection: "desc",
    pageSize: 50,
  },
  {
    version: VIEW_VERSION,
    id: "builtin-brominated-compounds",
    name: "Composés bromés",
    resultId: "identified-features",
    builtIn: true,
    createdAt: null,
    columns: identifiedFeatureColumns,
    filters: [
      {
        column: "match_name",
        operator: "contains",
        value: "bromo",
      },
    ],
    sortBy: "global_score",
    sortDirection: "desc",
    pageSize: 50,
  },
  {
    version: VIEW_VERSION,
    id: "builtin-unidentified",
    name: "Non identifiés",
    resultId: "identified-features",
    builtIn: true,
    createdAt: null,
    columns: identifiedFeatureColumns,
    filters: [
      {
        column: "match_name",
        operator: "is_empty",
      },
    ],
    sortBy: "feature_idx",
    sortDirection: "asc",
    pageSize: 50,
  },
];

function isSavedTableView(
  value: unknown,
): value is SavedTableView {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const candidate =
    value as Partial<SavedTableView>;

  return (
    candidate.version === VIEW_VERSION &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.resultId === "string" &&
    candidate.builtIn === false &&
    Array.isArray(candidate.columns) &&
    Array.isArray(candidate.filters) &&
    (
      candidate.sortBy === null ||
      typeof candidate.sortBy === "string"
    ) &&
    (
      candidate.sortDirection === null ||
      candidate.sortDirection === "asc" ||
      candidate.sortDirection === "desc"
    ) &&
    typeof candidate.pageSize === "number"
  );
}

export function loadUserTableViews():
SavedTableView[] {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEY,
    );

    if (!raw) {
      return [];
    }

    const decoded: unknown = JSON.parse(raw);

    if (!Array.isArray(decoded)) {
      return [];
    }

    return decoded.filter(isSavedTableView);
  } catch {
    return [];
  }
}

export function saveUserTableViews(
  views: SavedTableView[],
): void {
  const validViews = views.filter(
    (view) =>
      !view.builtIn &&
      view.version === VIEW_VERSION,
  );

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(validViews),
  );
}

export function createUserTableView(
  name: string,
  resultId: string,
  columns: string[],
  filters: PipelineTableFilter[],
  sortBy: string | null,
  sortDirection: TableViewSortDirection,
  pageSize: number,
): SavedTableView {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error(
      "Le nom de la vue est obligatoire.",
    );
  }

  return {
    version: VIEW_VERSION,
    id: `user-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    name: trimmedName,
    resultId,
    builtIn: false,
    createdAt: new Date().toISOString(),
    columns: [...columns],
    filters: filters.map((filter) => ({
      ...filter,
    })),
    sortBy,
    sortDirection,
    pageSize,
  };
}

export function tableViewsForResult(
  resultId: string,
  userViews: SavedTableView[],
): SavedTableView[] {
  return [
    ...builtInTableViews,
    ...userViews,
  ].filter(
    (view) => view.resultId === resultId,
  );
}

export type TableViewsFile = {
  format_version: 1;
  exported_at: string;
  views: SavedTableView[];
};

const TABLE_VIEWS_FILE_FORMAT_VERSION = 1;

const allowedFilterOperators = new Set([
  "eq",
  "ne",
  "lt",
  "lte",
  "gt",
  "gte",
  "contains",
  "starts_with",
  "is_null",
  "not_null",
  "is_empty",
  "not_empty",
]);

function isValidFilter(
  value: unknown,
): value is PipelineTableFilter {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const candidate =
    value as Partial<PipelineTableFilter>;

  if (
    typeof candidate.column !== "string" ||
    !candidate.column.trim() ||
    typeof candidate.operator !== "string" ||
    !allowedFilterOperators.has(
      candidate.operator,
    )
  ) {
    return false;
  }

  const operatorWithoutValue =
    candidate.operator === "is_null" ||
    candidate.operator === "not_null" ||
    candidate.operator === "is_empty" ||
    candidate.operator === "not_empty";

  if (operatorWithoutValue) {
    return (
      candidate.value === undefined ||
      candidate.value === null
    );
  }

  return (
    typeof candidate.value === "string" ||
    typeof candidate.value === "number" ||
    typeof candidate.value === "boolean"
  );
}

function isImportableTableView(
  value: unknown,
): value is SavedTableView {
  if (!isSavedTableView(value)) {
    return false;
  }

  if (
    !value.name.trim() ||
    value.name.length > 80 ||
    !value.resultId.trim() ||
    value.resultId.length > 120
  ) {
    return false;
  }

  if (
    value.columns.length < 1 ||
    value.columns.length > 200 ||
    !value.columns.every(
      (column) =>
        typeof column === "string" &&
        column.trim().length > 0 &&
        column.length <= 120,
    )
  ) {
    return false;
  }

  if (
    value.filters.length > 20 ||
    !value.filters.every(isValidFilter)
  ) {
    return false;
  }

  if (
    value.sortBy !== null &&
    (
      !value.sortBy.trim() ||
      value.sortBy.length > 120
    )
  ) {
    return false;
  }

  return (
    value.pageSize === 25 ||
    value.pageSize === 50 ||
    value.pageSize === 100
  );
}

export function serializeTableViewsFile(
  userViews: SavedTableView[],
): string {
  const exportableViews = userViews.filter(
    (view) =>
      !view.builtIn &&
      isImportableTableView(view),
  );

  const file: TableViewsFile = {
    format_version:
      TABLE_VIEWS_FILE_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    views: exportableViews.map((view) => ({
      ...view,
      columns: [...view.columns],
      filters: view.filters.map((filter) => ({
        ...filter,
      })),
    })),
  };

  return JSON.stringify(file, null, 2);
}

function uniqueImportedName(
  requestedName: string,
  existingNames: Set<string>,
): string {
  const baseName =
    requestedName.trim() || "Vue importée";

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;

  while (
    existingNames.has(
      `${baseName} (${suffix})`,
    )
  ) {
    suffix += 1;
  }

  return `${baseName} (${suffix})`;
}

export function parseTableViewsFile(
  content: string,
  existingViews: SavedTableView[],
): SavedTableView[] {
  let decoded: unknown;

  try {
    decoded = JSON.parse(content);
  } catch {
    throw new Error(
      "Le fichier de vues n’est pas un JSON valide.",
    );
  }

  if (
    decoded === null ||
    typeof decoded !== "object" ||
    Array.isArray(decoded)
  ) {
    throw new Error(
      "Le fichier de vues doit contenir un objet JSON.",
    );
  }

  const file = decoded as Partial<TableViewsFile>;

  if (
    file.format_version !==
    TABLE_VIEWS_FILE_FORMAT_VERSION
  ) {
    throw new Error(
      "Version du fichier de vues non prise en charge.",
    );
  }

  if (!Array.isArray(file.views)) {
    throw new Error(
      "Le fichier doit contenir un tableau views.",
    );
  }

  if (file.views.length > 100) {
    throw new Error(
      "Un fichier ne peut pas contenir plus de 100 vues.",
    );
  }

  if (
    !file.views.every(
      isImportableTableView,
    )
  ) {
    throw new Error(
      "Une ou plusieurs vues importées sont invalides.",
    );
  }

  const existingNames = new Set(
    existingViews.map((view) => view.name),
  );

  const importTimestamp = Date.now();

  return file.views.map((view, index) => {
    const name = uniqueImportedName(
      view.name,
      existingNames,
    );

    existingNames.add(name);

    return {
      ...view,
      id: (
        `user-imported-${importTimestamp}-` +
        `${index}-${Math.random()
          .toString(36)
          .slice(2, 8)}`
      ),
      name,
      builtIn: false,
      createdAt: new Date().toISOString(),
      columns: [...view.columns],
      filters: view.filters.map(
        (filter) => ({
          ...filter,
        }),
      ),
    };
  });
}
