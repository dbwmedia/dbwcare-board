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

type StatusLevel = "healthy" | "warning" | "danger";

function getStatusLevel(percentage: number, remaining: number): StatusLevel {
  if (remaining < 0 || percentage >= 85) return "danger";
  if (percentage >= 65) return "warning";
  return "healthy";
}

// Plane TW v4 has no default colors. Use semantic classes + inline for subtle bg.
const STATUS_STYLES = {
  healthy: {
    text: "text-success-primary",
    bar: "#22c55e",
    iconBg: "rgba(34, 197, 94, 0.15)",
    gradient: "linear-gradient(to bottom right, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.04), transparent)",
  },
  warning: {
    text: "text-warning-primary",
    bar: "#f59e0b",
    iconBg: "rgba(245, 158, 11, 0.15)",
    gradient: "linear-gradient(to bottom right, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04), transparent)",
  },
  danger: {
    text: "text-danger-primary",
    bar: "#ef4444",
    iconBg: "rgba(239, 68, 68, 0.15)",
    gradient: "linear-gradient(to bottom right, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04), transparent)",
  },
} as const;

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
  const level = getStatusLevel(percentage, remaining);
  const styles = STATUS_STYLES[level];

  const carePageUrl = `/${workspaceSlug}/projects/${activeProjectId}/care`;

  return (
    <div className="mx-3 my-1.5">
      <Link
        to={carePageUrl}
        className="group block w-full rounded-lg border border-subtle/50 p-3 text-left transition-all hover:border-subtle"
        style={{ background: styles.gradient }}
      >
        <div className="flex items-center gap-2">
          <div className="rounded-md p-1" style={{ backgroundColor: styles.iconBg }}>
            <Clock className={cn("size-3.5", styles.text)} />
          </div>
          <span className="text-body-xs-medium text-tertiary"><span className="font-bold">CARE</span>-Kontingent</span>
        </div>

        {/* Main stat */}
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className={cn("text-xl font-semibold", styles.text)}>
            {formatMinutes(remaining)}
          </span>
          <span className="text-body-xs-regular text-tertiary">verfügbar</span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-layer-3/50">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${percentage}%`, backgroundColor: styles.bar }}
          />
        </div>

        {/* Footer stats */}
        <div className="mt-1.5 flex items-center justify-between text-caption-xs text-tertiary">
          <span>{formatMinutes(consumed)} genutzt</span>
          <span>von {formatMinutes(total)}</span>
        </div>
        {remaining < 0 && (
          <div className="mt-1 text-caption-xs text-danger-primary">
            Überziehung - wird im Folgemonat verrechnet
          </div>
        )}
        {remaining >= 0 && balance.borrowed_minutes > 0 && (
          <div className="mt-1 text-caption-xs text-danger-primary">
            -{formatMinutes(balance.borrowed_minutes)} Überziehung Vormonat
          </div>
        )}
      </Link>
    </div>
  );
});
