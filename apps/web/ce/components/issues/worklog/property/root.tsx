import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Plus, Clock } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/ui";
import { useCare } from "@/hooks/store/use-care";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { WorklogManualEntryModal } from "./manual-entry-modal";
import { WorklogTimer } from "./timer";
import { WorklogList } from "./worklog-list";

type TIssueWorklogProperty = {
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

export const IssueWorklogProperty = observer(function IssueWorklogProperty(props: TIssueWorklogProperty) {
  const { workspaceSlug, projectId, issueId, disabled } = props;
  const { t } = useTranslation();
  const care = useCare();
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (workspaceSlug && projectId && issueId) {
      care.fetchWorklogEntries(workspaceSlug, projectId, issueId);
      care.fetchActiveTimer(workspaceSlug);
    }
  }, [workspaceSlug, projectId, issueId, care]);

  const entries = care.worklogEntries[issueId] || [];
  const totalMinutes = entries
    .filter((e) => !e.is_running)
    .reduce((sum, e) => sum + e.duration_minutes, 0);

  const activeTimerOnThisIssue = care.activeTimer?.issue === issueId ? care.activeTimer : null;

  if (!care.hasActiveSubscription) return null;

  return (
    <>
      <SidebarPropertyListItem
        icon={Clock}
        label={t("dbwcare.time_tracking")}
      >
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center gap-2">
            <WorklogTimer
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              activeEntry={activeTimerOnThisIssue}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-body-xs-regular text-tertiary hover:text-primary cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {t("dbwcare.total")}: {formatDuration(totalMinutes)}
              {entries.length > 0 && ` (${entries.length})`}
            </button>

            {!disabled && (
              <Tooltip tooltipContent={t("dbwcare.manual_add")}>
                <button
                  type="button"
                  className="flex items-center gap-1 text-body-xs-regular text-tertiary hover:text-primary cursor-pointer"
                  onClick={() => setIsManualModalOpen(true)}
                >
                  <Plus className="size-3" />
                </button>
              </Tooltip>
            )}
          </div>

          {isExpanded && entries.length > 0 && (
            <WorklogList
              entries={entries}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              disabled={disabled}
            />
          )}
        </div>
      </SidebarPropertyListItem>

      <WorklogManualEntryModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issueId}
      />
    </>
  );
});
