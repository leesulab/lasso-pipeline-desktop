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
