import { useEffect } from "react";
import { observer } from "mobx-react";
import { Clock } from "lucide-react";
import { useParams, Link } from "react-router";
import { cn } from "@plane/utils";
import { useCare } from "@/hooks/store/use-care";

const formatMinutes = (minutes: number) => {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = minutes < 0 ? "-" : "";
  if (h === 0) return `${sign}${m}min`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}min`;
};

interface CareBalanceWidgetProps {
  projectId?: string;
}

export const CareBalanceWidget = observer(function CareBalanceWidget({ projectId }: CareBalanceWidgetProps) {
  const { workspaceSlug, projectId: routeProjectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const care = useCare();

  const activeProjectId = projectId || routeProjectId;

  useEffect(() => {
    if (workspaceSlug && activeProjectId) {
      care.fetchSubscription(workspaceSlug, activeProjectId);
      care.fetchCurrentBalance(workspaceSlug, activeProjectId);
    }
  }, [workspaceSlug, activeProjectId, care]);

  const subscription = activeProjectId ? care.getSubscription(activeProjectId) : null;
  const balance = activeProjectId ? care.getBalance(activeProjectId) : null;

  if (!subscription?.is_active || !balance) return null;

  const remaining = balance.remaining_minutes;
  const total = balance.total_available_minutes;
  const consumed = balance.consumed_minutes;
  const percentage = total > 0 ? Math.min(Math.round((consumed / total) * 100), 100) : 0;

  const isHealthy = percentage < 75;
  const isWarning = percentage >= 75 && percentage < 90;

  const gradientClass = isHealthy
    ? "from-emerald-500/20 via-emerald-500/10 to-transparent"
    : isWarning
      ? "from-amber-500/20 via-amber-500/10 to-transparent"
      : "from-red-500/20 via-red-500/10 to-transparent";

  const barColor = isHealthy ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-red-500";
  const accentText = isHealthy ? "text-emerald-400" : isWarning ? "text-amber-400" : "text-red-400";

  // Navigate to care overview page
  const carePageUrl = `/${workspaceSlug}/projects/${activeProjectId}/care`;

  return (
    <div className="mx-3 my-1.5">
      <Link
        to={carePageUrl}
        className={cn(
          "group block w-full rounded-lg border border-subtle/50 p-3 text-left transition-all",
          "bg-gradient-to-br hover:border-subtle",
          gradientClass
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn("rounded-md p-1", isHealthy ? "bg-emerald-500/20" : isWarning ? "bg-amber-500/20" : "bg-red-500/20")}>
            <Clock className={cn("size-3.5", accentText)} />
          </div>
          <span className="text-body-xs-medium text-tertiary"><span className="font-bold">CARE</span>-Kontingent</span>
        </div>

        {/* Main stat */}
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className={cn("text-xl font-semibold", accentText)}>
            {formatMinutes(remaining)}
          </span>
          <span className="text-body-xs-regular text-tertiary">verfügbar</span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-layer-3/50">
          <div
            className={cn("h-full rounded-full transition-all duration-700", barColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Footer stats */}
        <div className="mt-1.5 flex items-center justify-between text-caption-xs text-tertiary">
          <span>{formatMinutes(consumed)} genutzt</span>
          <span>von {formatMinutes(total)}</span>
        </div>
        {balance.borrowed_minutes > 0 && (
          <div className="mt-1 text-caption-xs text-red-400">
            -{formatMinutes(balance.borrowed_minutes)} Überziehung Vormonat
          </div>
        )}
      </Link>
    </div>
  );
});
