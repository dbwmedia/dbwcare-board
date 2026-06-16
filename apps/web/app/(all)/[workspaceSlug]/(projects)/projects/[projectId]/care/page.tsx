import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { ArrowLeft, ChevronDown, Clock, Gift, TrendingUp } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@plane/utils";
import type { IMonthWorklogGroup } from "@plane/types";
import { useCare } from "@/hooks/store/use-care";

const MONATSNAMEN = [
  "", "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const formatMinutes = (minutes: number) => {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = minutes < 0 ? "-" : "";
  if (h === 0) return `${sign}${m}min`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}min`;
};

function getStatusColors(percentage: number, remaining: number) {
  if (remaining < 0) {
    return {
      bar: "bg-red-500",
      text: "text-red-400",
      hero: "from-red-500/5 via-transparent to-transparent",
    };
  }
  if (percentage < 65) {
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-400",
      hero: "from-emerald-500/5 via-transparent to-blue-500/3",
    };
  }
  if (percentage < 85) {
    return {
      bar: "bg-amber-500",
      text: "text-amber-400",
      hero: "from-amber-500/5 via-transparent to-transparent",
    };
  }
  return {
    bar: "bg-red-500",
    text: "text-red-400",
    hero: "from-red-500/5 via-transparent to-transparent",
  };
}

const CareOverviewCustomerPage = observer(function CareOverviewCustomerPage() {
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const care = useCare();

  useEffect(() => {
    if (workspaceSlug && projectId) {
      care.fetchSubscription(workspaceSlug, projectId);
      care.fetchCurrentBalance(workspaceSlug, projectId);
      care.fetchBalanceHistory(workspaceSlug, projectId, 12);
    }
  }, [workspaceSlug, projectId, care]);

  const subscription = projectId ? care.getSubscription(projectId) : null;
  const balance = projectId ? care.getBalance(projectId) : null;
  const history = projectId ? care.getBalanceHistory(projectId) : [];

  if (!subscription || !balance) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-tertiary">Lade Care-Daten...</p>
      </div>
    );
  }

  const remaining = balance.remaining_minutes;
  const total = balance.total_available_minutes;
  const consumed = balance.consumed_minutes;
  const percentage = total > 0 ? Math.min(Math.round((consumed / total) * 100), 100) : consumed > 0 ? 100 : 0;
  const colors = getStatusColors(percentage, remaining);
  const packageLabel = subscription.package_label || "-";

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Back link */}
        <Link
          to={`/${workspaceSlug}/projects/${projectId}/issues`}
          className="mb-6 inline-flex items-center gap-1.5 text-body-sm-medium text-tertiary hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Zurück zum Board
        </Link>

        {/* Hero section */}
        <div className={cn("rounded-xl border border-subtle bg-gradient-to-br p-6", colors.hero)}>
          <div className="flex items-center gap-2 text-body-sm-medium text-tertiary">
            <Clock className="size-4" />
            <span><span className="font-bold">CARE</span>-Kontingent — Paket {packageLabel}</span>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className={cn("text-4xl font-bold", colors.text)}>
              {formatMinutes(remaining)}
            </span>
            <span className="text-lg text-tertiary">verfügbar</span>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-layer-3">
            <div
              className={cn("h-full rounded-full transition-all duration-700", colors.bar)}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <div className="text-body-xs-regular text-tertiary">Basis-Kontingent</div>
              <div className="mt-0.5 text-body-md-medium">{formatMinutes(balance.base_minutes)}</div>
            </div>
            <div>
              <div className="text-body-xs-regular text-tertiary">Verbraucht</div>
              <div className="mt-0.5 text-body-md-medium">{formatMinutes(consumed)}</div>
            </div>
            <div>
              <div className="text-body-xs-regular text-tertiary">Gesamt verfügbar</div>
              <div className="mt-0.5 text-body-md-medium">{formatMinutes(total)}</div>
            </div>
          </div>

          {balance.rolled_over_minutes > 0 && (
            <div className="mt-3 rounded-md bg-emerald-500/10 px-3 py-2 text-body-xs-regular text-emerald-400">
              +{formatMinutes(balance.rolled_over_minutes)} aus dem Vormonat als Depot übertragen
            </div>
          )}
          {balance.borrowed_minutes > 0 && (
            <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-body-xs-regular text-red-400">
              -{formatMinutes(balance.borrowed_minutes)} vom Vormonat abgezogen (Überziehung)
            </div>
          )}
          {remaining < 0 && (
            <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-body-xs-regular text-red-400">
              {formatMinutes(Math.abs(remaining))} Überziehung - wird im Folgemonat verrechnet
            </div>
          )}
        </div>

        {/* History */}
        <div className="mt-8">
          <div className="flex items-center gap-2 text-body-md-medium">
            <TrendingUp className="size-4" />
            <span>Monatsverlauf</span>
          </div>

          <div className="mt-4 space-y-3">
            {/* Current month first */}
            <MonthRow
              month={balance.month}
              year={balance.year}
              baseMinutes={balance.base_minutes}
              rolledOver={balance.rolled_over_minutes}
              borrowed={balance.borrowed_minutes}
              consumed={balance.consumed_minutes}
              totalAvailable={balance.total_available_minutes}
              isCurrent
              workspaceSlug={workspaceSlug!}
              projectId={projectId!}
            />

            {/* Past months */}
            {history
              .filter((b) => !(b.year === balance.year && b.month === balance.month))
              .map((b) => (
                <MonthRow
                  key={b.id}
                  month={b.month}
                  year={b.year}
                  baseMinutes={b.base_minutes}
                  rolledOver={b.rolled_over_minutes}
                  borrowed={b.borrowed_minutes}
                  consumed={b.consumed_minutes}
                  totalAvailable={b.total_available_minutes}
                  workspaceSlug={workspaceSlug!}
                  projectId={projectId!}
                />
              ))}
          </div>

          {history.length === 0 && (
            <p className="mt-4 text-body-sm-regular text-tertiary">
              Noch keine vergangenen Monate vorhanden.
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

const MonthRow = observer(function MonthRow({
  month,
  year,
  baseMinutes,
  rolledOver,
  borrowed = 0,
  consumed,
  totalAvailable,
  isCurrent = false,
  workspaceSlug,
  projectId,
}: {
  month: number;
  year: number;
  baseMinutes: number;
  rolledOver: number;
  borrowed?: number;
  consumed: number;
  totalAvailable: number;
  isCurrent?: boolean;
  workspaceSlug: string;
  projectId: string;
}) {
  const care = useCare();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const pct = totalAvailable > 0 ? Math.min(Math.round((consumed / totalAvailable) * 100), 100) : consumed > 0 ? 100 : 0;
  const remaining = totalAvailable - consumed;
  const colors = getStatusColors(pct, remaining);

  const worklogs = care.getMonthWorklogs(projectId, year, month);

  const handleToggle = async () => {
    if (!expanded && worklogs.length === 0) {
      setLoading(true);
      await care.fetchMonthWorklogs(workspaceSlug, projectId, year, month);
      setLoading(false);
    }
    setExpanded((prev) => !prev);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-subtle overflow-hidden transition-colors",
        isCurrent && "border-primary/30 bg-layer-1"
      )}
    >
      {/* Header (clickable) */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-layer-1/50 transition-colors"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-tertiary transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-body-sm-medium">
                {MONATSNAMEN[month]} {year}
              </span>
              {isCurrent && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-caption-xs font-medium text-primary">
                  Aktuell
                </span>
              )}
            </div>
            <span className={cn("text-body-sm-medium", remaining < 0 ? "text-red-400" : "text-tertiary")}>
              {formatMinutes(remaining)} übrig
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-layer-3">
            <div
              className={cn("h-full rounded-full", colors.bar)}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Detail row */}
          <div className="mt-2 flex gap-6 text-caption-xs text-tertiary">
            <span>Basis: {formatMinutes(baseMinutes)}</span>
            {rolledOver > 0 && <span className="text-emerald-400">+{formatMinutes(rolledOver)} Depot</span>}
            {borrowed > 0 && <span className="text-red-400">-{formatMinutes(borrowed)} Überziehung</span>}
            <span>Verbraucht: {formatMinutes(consumed)}</span>
            <span>{pct}%</span>
          </div>
        </div>
      </button>

      {/* Expanded: Worklog details */}
      {expanded && (
        <div className="border-t border-subtle bg-layer-1/30 px-4 py-3">
          {loading ? (
            <p className="text-caption-xs text-tertiary py-2">Lade Einträge...</p>
          ) : worklogs.length === 0 ? (
            <p className="text-caption-xs text-tertiary py-2">Keine Einträge in diesem Monat.</p>
          ) : (
            <WorklogList groups={worklogs} />
          )}
        </div>
      )}
    </div>
  );
});

function WorklogList({ groups }: { groups: IMonthWorklogGroup[] }) {
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.issue_id}>
          <div className="flex items-center justify-between">
            <span className="text-body-xs-medium truncate">{group.issue_title}</span>
            <span className="text-caption-xs text-tertiary shrink-0 ml-2">
              {formatMinutes(group.total_minutes)}
            </span>
          </div>
          <div className="mt-1 space-y-1">
            {group.entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 pl-3 text-caption-xs text-tertiary"
              >
                <span className="shrink-0 font-medium text-primary/80">
                  {formatMinutes(entry.duration_minutes)}
                </span>
                <span className="truncate flex-1">{entry.description || "Ohne Beschreibung"}</span>
                {entry.billing_status === "gift" && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-emerald-400" title={entry.gift_reason || "Geschenk"}>
                    <Gift className="size-3" />
                  </span>
                )}
                {entry.logged_by && (
                  <span className="shrink-0 text-quaternary">{entry.logged_by.display_name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default CareOverviewCustomerPage;
