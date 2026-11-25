import {
  createUserTableView,
  tableViewsForResult,
} from "./tableViews";

const view = createUserTableView(
  "Scores personnels",
  "identified-features",
  ["feature_idx", "global_score"],
  [
    {
      column: "global_score",
      operator: "gte",
      value: 0.8,
    },
  ],
  "global_score",
  "desc",
  50,
);

if (view.name !== "Scores personnels") {
  throw new Error("Nom de vue incorrect.");
}

if (view.filters.length !== 1) {
  throw new Error("Filtres de vue incorrects.");
}

const available = tableViewsForResult(
  "identified-features",
  [view],
);

if (available.length !== 5) {
  throw new Error(
    "Les quatre vues intégrées et la vue utilisateur "
    + "doivent être disponibles.",
  );
}
