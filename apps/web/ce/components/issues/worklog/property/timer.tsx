import { useState, useEffect, useCallback } from "react";
import { observer } from "mobx-react";
import { Play, Square } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/ui";
import { cn } from "@plane/utils";
import { useCare } from "@/hooks/store/use-care";
import type { IWorklogEntry } from "@plane/types";
import { WorklogTimerStopModal } from "./timer-stop-modal";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  activeEntry: IWorklogEntry | null;
  disabled: boolean;
};

const pad = (n: number) => n.toString().padStart(2, "0");

const formatElapsed = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const WorklogTimer = observer(function WorklogTimer(props: Props) {
  const { workspaceSlug, projectId, issueId, activeEntry, disabled } = props;
  const { t } = useTranslation();
  const care = useCare();
  const [elapsed, setElapsed] = useState(0);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!activeEntry?.started_at) {
      setElapsed(0);
      return;
    }
    const start = new Date(activeEntry.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.started_at]);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    try {
      if (care.activeTimer && care.activeTimer.issue !== issueId) {
        await care.startTimer(workspaceSlug, projectId, issueId, { force_stop: true });
      } else {
        await care.startTimer(workspaceSlug, projectId, issueId);
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error?.response?.status === 409) {
        await care.startTimer(workspaceSlug, projectId, issueId, { force_stop: true });
      }
    } finally {
      setIsStarting(false);
    }
  }, [care, workspaceSlug, projectId, issueId]);

  if (disabled) return null;

  if (activeEntry) {
    return (
      <>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-body-sm-medium text-success-primary")}>
            {formatElapsed(elapsed)}
          </span>
          <Tooltip tooltipContent={t("dbwcare.stop_timer")}>
            <button
              type="button"
              className="flex items-center justify-center rounded-sm bg-danger-primary/10 p-1 text-danger-primary hover:bg-danger-primary/20"
              onClick={() => setIsStopModalOpen(true)}
            >
              <Square className="size-3 fill-current" />
            </button>
          </Tooltip>
        </div>
        <WorklogTimerStopModal
          isOpen={isStopModalOpen}
          onClose={() => setIsStopModalOpen(false)}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
        />
      </>
    );
  }

  return (
    <Tooltip tooltipContent={t("dbwcare.start_timer")}>
      <button
        type="button"
        disabled={isStarting}
        className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-body-xs-regular text-tertiary hover:bg-layer-transparent-hover hover:text-primary"
        onClick={handleStart}
      >
        <Play className="size-3" />
        <span>{t("dbwcare.start_timer")}</span>
      </button>
    </Tooltip>
  );
});
