import { useState, useEffect, useCallback } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Square, Timer } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/ui";
import { useCare } from "@/hooks/store/use-care";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
import { WorklogTimerStopModal } from "@/plane-web/components/issues/worklog/property/timer-stop-modal";

const pad = (n: number) => n.toString().padStart(2, "0");

const formatElapsed = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const ActiveTimerIndicator = observer(function ActiveTimerIndicator() {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const care = useCare();
  const router = useAppRouter();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getProjectIdentifierById } = useProject();
  const [elapsed, setElapsed] = useState(0);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);

  // Fetch active timer on mount
  useEffect(() => {
    if (workspaceSlug) {
      care.fetchActiveTimer(workspaceSlug.toString());
    }
  }, [workspaceSlug, care]);

  // Tick elapsed time
  useEffect(() => {
    if (!care.activeTimer?.started_at) {
      setElapsed(0);
      return;
    }
    const start = new Date(care.activeTimer.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [care.activeTimer?.started_at]);

  if (!care.activeTimer || !workspaceSlug) return null;

  const { project, issue } = care.activeTimer;
  const issueDetails = getIssueById(issue);
  const projectIdentifier = getProjectIdentifierById(project);
  const issueIdentifier =
    issueDetails && projectIdentifier
      ? `${projectIdentifier}-${issueDetails.sequence_id}`
      : null;

  const handleNavigate = useCallback(() => {
    if (project && issue) {
      router.push(`/${workspaceSlug}/projects/${project}/issues/?peekId=${issue}`);
    }
  }, [workspaceSlug, project, issue, router]);

  return (
    <>
      <Tooltip
        tooltipContent={
          issueIdentifier
            ? `${issueIdentifier}: ${issueDetails?.name ?? ""}`
            : t("dbwcare.timer_running")
        }
        position="bottom"
      >
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-success-primary/30 bg-success-primary/10 px-2.5 py-1 text-success-primary transition-colors hover:bg-success-primary/20"
          onClick={handleNavigate}
        >
          <Timer className="size-3.5 animate-pulse" />
          <span className="font-mono text-xs font-medium">{formatElapsed(elapsed)}</span>
          {issueIdentifier && (
            <span className="max-w-[120px] truncate text-xs opacity-80">{issueIdentifier}</span>
          )}
        </button>
      </Tooltip>
      <Tooltip tooltipContent={t("dbwcare.stop_timer")} position="bottom">
        <button
          type="button"
          className="flex items-center justify-center rounded-lg border border-danger-primary/30 bg-danger-primary/10 p-1.5 text-danger-primary transition-colors hover:bg-danger-primary/20"
          onClick={() => setIsStopModalOpen(true)}
        >
          <Square className="size-3 fill-current" />
        </button>
      </Tooltip>
      <WorklogTimerStopModal
        isOpen={isStopModalOpen}
        onClose={() => setIsStopModalOpen(false)}
        workspaceSlug={workspaceSlug.toString()}
        projectId={project}
        issueId={issue}
      />
    </>
  );
});
