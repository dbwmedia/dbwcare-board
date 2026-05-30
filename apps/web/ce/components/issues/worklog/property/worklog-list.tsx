import { useState } from "react";
import { observer } from "mobx-react";
import { Gift, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/ui";
import { cn } from "@plane/utils";
import { useCare } from "@/hooks/store/use-care";
import type { IWorklogEntry } from "@plane/types";
import { WorklogEditEntryModal } from "./edit-entry-modal";

type Props = {
  entries: IWorklogEntry[];
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
};

const formatRelativeDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "heute";
  if (diffDays === 1) return "gestern";
  if (diffDays < 7) return `vor ${diffDays}T`;
  return date.toLocaleDateString("de-DE");
};

export const WorklogList = observer(function WorklogList(props: Props) {
  const { entries, workspaceSlug, projectId, issueId, disabled } = props;
  const { t } = useTranslation();
  const care = useCare();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<IWorklogEntry | null>(null);

  const handleDelete = async (entryId: string) => {
    await care.deleteWorklogEntry(workspaceSlug, projectId, issueId, entryId);
  };

  return (
    <>
      <div className="mt-1 space-y-1">
        {entries
          .filter((e) => !e.is_running)
          .map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "group flex flex-col rounded-sm px-2 py-1 text-body-xs-regular",
                entry.billing_status === "gift" && "bg-success-primary/5"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate">
                  {entry.logged_by_detail && (
                    <span className="truncate text-tertiary">{entry.logged_by_detail.display_name}</span>
                  )}
                  <span className="font-medium">{formatDuration(entry.duration_minutes)}</span>
                  {entry.billing_status === "gift" && (
                    <Tooltip tooltipContent={entry.gift_reason || t("dbwcare.gift")}>
                      <Gift className="size-3 text-success-primary" />
                    </Tooltip>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-tertiary">{formatRelativeDate(entry.created_at)}</span>
                  {!disabled && (
                    <>
                      <button
                        type="button"
                        className="hidden text-tertiary hover:text-primary group-hover:block"
                        onClick={() => setEditingEntry(entry)}
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        className="hidden text-danger-primary group-hover:block"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {entry.description && (
                <button
                  type="button"
                  className={cn(
                    "mt-0.5 text-left text-tertiary",
                    expandedId !== entry.id && "truncate"
                  )}
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  {entry.description}
                </button>
              )}
            </div>
          ))}
      </div>

      <WorklogEditEntryModal
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        entry={editingEntry}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issueId}
      />
    </>
  );
});
