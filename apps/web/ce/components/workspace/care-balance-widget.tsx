import { useEffect } from "react";
import { observer } from "mobx-react";
import { Clock } from "lucide-react";
import { useParams, Link } from "react-router";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/ui";
import { cn } from "@plane/utils";
import { useCare } from "@/hooks/store/use-care";

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatMinutes = (minutes: number) => {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = minutes < 0 ? "-" : "";
  if (h === 0) return `${sign}${m}min`;
  return `${sign}${h}h ${m}min`;
};

interface CareBalanceWidgetProps {
  projectId?: string;
}

export const CareBalanceWidget = observer(function CareBalanceWidget({ projectId }: CareBalanceWidgetProps) {
  const { workspaceSlug, projectId: routeProjectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const { t } = useTranslation();
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
  const percentage = total > 0 ? Math.min((consumed / total) * 100, 100) : 0;
  const remainingPercent = 100 - percentage;

  // Color logic
  let ringColor = "text-success-primary"; // > 50%
  if (remainingPercent <= 25) {
    ringColor = "text-warning-primary";
  } else if (remainingPercent <= 50) {
    ringColor = "text-warning-primary";
  }
  if (remaining < 0) {
    ringColor = "text-secondary";
  }

  const monthName = MONTH_NAMES[balance.month] || "";
  const packageLabel = subscription.package_label ? ` (${subscription.package_label})` : "";

  const linkTarget = activeProjectId
    ? `/${workspaceSlug}/settings/projects/${activeProjectId}/care`
    : `/${workspaceSlug}/care-overview/`;

  const tooltipContent = (
    <div className="space-y-1 p-1 text-left">
      <div className="font-medium">
        {monthName} {balance.year}
        {packageLabel}
      </div>
      <div className="space-y-0.5 border-t border-subtle pt-1 text-body-xs-regular">
        <div className="flex justify-between gap-4">
          <span>{t("dbwcare.base_quota")}</span>
          <span>{formatMinutes(balance.base_minutes)}</span>
        </div>
        {balance.rolled_over_minutes > 0 && (
          <div className="flex justify-between gap-4">
            <span>{t("dbwcare.rolled_over")}</span>
            <span>+ {formatMinutes(balance.rolled_over_minutes)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-subtle pt-0.5">
          <span>{t("dbwcare.total_available")}</span>
          <span>{formatMinutes(total)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>{t("dbwcare.consumed")}</span>
          <span>{formatMinutes(consumed)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-subtle pt-0.5 font-medium">
          <span>{t("dbwcare.remaining")}</span>
          <span>{formatMinutes(remaining)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <Tooltip tooltipContent={tooltipContent} position="right">
      <Link
        to={linkTarget}
        className="mx-3 my-1 flex items-center gap-2.5 rounded-md border border-subtle px-3 py-2 transition-colors hover:bg-layer-transparent-hover"
      >
        {/* Progress ring */}
        <div className="relative flex-shrink-0">
          <svg className="size-8 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" className="stroke-layer-3" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              className={cn("transition-all duration-500", ringColor)}
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${percentage} ${100 - percentage}`}
              strokeLinecap="round"
            />
          </svg>
          <Clock className={cn("absolute inset-0 m-auto size-3.5", ringColor)} />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-body-sm-medium">
            {remaining >= 0
              ? t("dbwcare.remaining_this_month", { time: formatMinutes(remaining) })
              : t("dbwcare.borrowed_this_month", { time: formatMinutes(Math.abs(remaining)) })}
          </div>
          <div className="text-caption-xs truncate text-tertiary">
            {t("dbwcare.of_total", { time: formatMinutes(total) })}
          </div>
        </div>
      </Link>
    </Tooltip>
  );
});
