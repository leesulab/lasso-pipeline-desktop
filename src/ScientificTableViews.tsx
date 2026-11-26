import {
  BookmarkPlus,
  Copy,
  Download,
  Pencil,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  SavedTableView,
} from "./tableViews";

type ScientificTableViewsProps = {
  views: SavedTableView[];
  viewName: string;
  disabled: boolean;
  onViewNameChange: (name: string) => void;
  onApply: (view: SavedTableView) => void;
  onSave: () => void;
  onUpdate: () => void;
  activeView: SavedTableView | null;
  activeViewModified: boolean;
  transferPending: boolean;
  transferMessage: string | null;
  onImport: () => void;
  onExport: () => void;
  onRename: (view: SavedTableView) => void;
  onDuplicate: (view: SavedTableView) => void;
  onDelete: (viewId: string) => void;
};

export function ScientificTableViews({
  views,
  viewName,
  disabled,
  onViewNameChange,
  onApply,
  onSave,
  onUpdate,
  activeView,
  activeViewModified,
  transferPending,
  transferMessage,
  onImport,
  onExport,
  onRename,
  onDuplicate,
  onDelete,
}: ScientificTableViewsProps) {
  return (
    <div className="scientific-table-views">
      <div className="scientific-table-transfer">
        <div>
          <button
            type="button"
            disabled={disabled || transferPending}
            onClick={onImport}
          >
            <Upload size={14} />
            Importer des vues
          </button>

          <button
            type="button"
            disabled={disabled || transferPending}
            onClick={onExport}
          >
            <Download size={14} />
            Exporter mes vues
          </button>
        </div>

        {transferMessage && (
          <span>{transferMessage}</span>
        )}
      </div>

      <div className="scientific-table-view-list">
        {views.length === 0 && (
          <div className="scientific-results-empty">
            Aucune vue disponible pour cette table.
          </div>
        )}

        {views.map((view) => (
          <article
            className="scientific-table-view"
            key={view.id}
          >
            <div>
              <strong>{view.name}</strong>

              <span>
                {view.filters.length} filtre(s)
                {" · "}
                {view.columns.length} colonne(s)
                {view.sortBy
                  ? (
                      ` · tri ${view.sortBy} ` +
                      `${view.sortDirection ?? "asc"}`
                    )
                  : ""}
              </span>

              <small>
                {view.builtIn
                  ? "Vue intégrée LASSO"
                  : "Vue utilisateur"}
              </small>
            </div>

            <div className="scientific-table-view-actions">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onApply(view)}
              >
                <Play size={13} />
                Appliquer
              </button>

              <button
                type="button"
                disabled={disabled}
                title="Dupliquer cette vue"
                onClick={() =>
                  onDuplicate(view)
                }
              >
                <Copy size={13} />
              </button>

              {!view.builtIn && (
                <button
                  type="button"
                  disabled={disabled}
                  title="Renommer cette vue"
                  onClick={() =>
                    onRename(view)
                  }
                >
                  <Pencil size={13} />
                </button>
              )}

              {!view.builtIn && (
                <button
                  type="button"
                  className="scientific-table-view-delete"
                  disabled={disabled}
                  title="Supprimer cette vue"
                  onClick={() =>
                    onDelete(view.id)
                  }
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {activeView &&
        !activeView.builtIn &&
        activeViewModified && (
          <div className="scientific-table-view-update">
            <span>
              La vue « {activeView.name} » a été modifiée.
            </span>

            <button
              type="button"
              disabled={disabled}
              onClick={onUpdate}
            >
              Mettre à jour la vue
            </button>
          </div>
        )}

      <div className="scientific-table-view-save">
        <label htmlFor="scientific-table-view-name">
          Enregistrer la vue actuelle
        </label>

        <div>
          <input
            id="scientific-table-view-name"
            type="text"
            value={viewName}
            disabled={disabled}
            maxLength={80}
            placeholder="Ex. Composés prioritaires"
            onChange={(event) =>
              onViewNameChange(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
          />

          <button
            type="button"
            disabled={
              disabled ||
              !viewName.trim()
            }
            onClick={onSave}
          >
            <BookmarkPlus size={14} />
            Enregistrer
          </button>
        </div>

        <small>
          La vue mémorise les colonnes, les filtres et
          le tri. Les données scientifiques ne sont pas
          dupliquées.
        </small>
      </div>
    </div>
  );
}
