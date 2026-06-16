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

function getWidgetColors(percentage: number, remaining: number) {
  if (remaining < 0) {
    return {
      gradient: "from-rose-500/15 via-rose-500/5 to-transparent",
      bar: "bg-rose-500",
      text: "text-rose-400",
      icon: "bg-rose-500/20",
    };
  }
  if (percentage < 60) {
    return {
      gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      bar: "bg-emerald-500",
      text: "text-emerald-400",
      icon: "bg-emerald-500/20",
    };
  }
  if (percentage < 80) {
    return {
      gradient: "from-amber-400/15 via-amber-400/5 to-transparent",
      bar: "bg-amber-400",
      text: "text-amber-400",
      icon: "bg-amber-400/20",
    };
  }
  if (percentage < 100) {
    return {
      gradient: "from-orange-500/15 via-orange-500/5 to-transparent",
      bar: "bg-orange-500",
      text: "text-orange-400",
      icon: "bg-orange-500/20",
    };
  }
  return {
    gradient: "from-rose-500/15 via-rose-500/5 to-transparent",
    bar: "bg-rose-500",
    text: "text-rose-400",
    icon: "bg-rose-500/20",
  };
}

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
  const percentage = total > 0 ? Math.min(Math.round((consumed / total) * 100), 100) : consumed > 0 ? 100 : 0;
  const colors = getWidgetColors(percentage, remaining);

  const carePageUrl = `/${workspaceSlug}/projects/${activeProjectId}/care`;

  return (
    <div className="mx-3 my-1.5">
      <Link
        to={carePageUrl}
        className={cn(
          "group block w-full rounded-lg border border-subtle/50 p-3 text-left transition-all",
          "bg-gradient-to-br hover:border-subtle",
          colors.gradient
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn("rounded-md p-1", colors.icon)}>
            <Clock className={cn("size-3.5", colors.text)} />
          </div>
          <span className="text-body-xs-medium text-tertiary"><span className="font-bold">CARE</span>-Kontingent</span>
        </div>

        {/* Main stat */}
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className={cn("text-xl font-semibold", colors.text)}>
            {formatMinutes(remaining)}
          </span>
          <span className="text-body-xs-regular text-tertiary">verfügbar</span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-layer-3/50">
          <div
            className={cn("h-full rounded-full transition-all duration-700", colors.bar)}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Footer stats */}
        <div className="mt-1.5 flex items-center justify-between text-caption-xs text-tertiary">
          <span>{formatMinutes(consumed)} genutzt</span>
          <span>von {formatMinutes(total)}</span>
        </div>
        {remaining < 0 && (
          <div className="mt-1 text-caption-xs text-rose-400">
            Überziehung - wird im Folgemonat verrechnet
          </div>
        )}
        {remaining >= 0 && balance.borrowed_minutes > 0 && (
          <div className="mt-1 text-caption-xs text-rose-400">
            -{formatMinutes(balance.borrowed_minutes)} Überziehung Vormonat
          </div>
        )}
      </Link>
    </div>
  );
});
