import { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { ArrowLeft, Clock, TrendingUp } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@plane/utils";
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
  const percentage = total > 0 ? Math.min(Math.round((consumed / total) * 100), 100) : 0;

  const isHealthy = percentage < 75;
  const isWarning = percentage >= 75 && percentage < 90;

  const barColor = isHealthy ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-red-500";
  const accentText = isHealthy ? "text-emerald-400" : isWarning ? "text-amber-400" : "text-red-400";
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
        <div className="rounded-xl border border-subtle bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5 p-6">
          <div className="flex items-center gap-2 text-body-sm-medium text-tertiary">
            <Clock className="size-4" />
            <span><span className="font-bold">CARE</span>-Kontingent — Paket {packageLabel}</span>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className={cn("text-4xl font-bold", accentText)}>
              {formatMinutes(remaining)}
            </span>
            <span className="text-lg text-tertiary">verfügbar</span>
          </div>

          {/* Big progress bar */}
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-layer-3">
            <div
              className={cn("h-full rounded-full transition-all duration-700", barColor)}
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
              +{formatMinutes(balance.rolled_over_minutes)} aus dem Vormonat übertragen
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
            {/* Current month first, highlighted */}
            <MonthRow
              month={balance.month}
              year={balance.year}
              baseMinutes={balance.base_minutes}
              rolledOver={balance.rolled_over_minutes}
              consumed={balance.consumed_minutes}
              totalAvailable={balance.total_available_minutes}
              isCurrent
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
                  consumed={b.consumed_minutes}
                  totalAvailable={b.total_available_minutes}
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

function MonthRow({
  month,
  year,
  baseMinutes,
  rolledOver,
  consumed,
  totalAvailable,
  isCurrent = false,
}: {
  month: number;
  year: number;
  baseMinutes: number;
  rolledOver: number;
  consumed: number;
  totalAvailable: number;
  isCurrent?: boolean;
}) {
  const pct = totalAvailable > 0 ? Math.min(Math.round((consumed / totalAvailable) * 100), 100) : 0;
  const remaining = totalAvailable - consumed;
  const isHealthy = pct < 75;
  const isWarning = pct >= 75 && pct < 90;
  const barColor = isHealthy ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-red-500";

  return (
    <div
      className={cn(
        "rounded-lg border border-subtle p-4",
        isCurrent && "border-primary/30 bg-layer-1"
      )}
    >
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
          className={cn("h-full rounded-full", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Detail row */}
      <div className="mt-2 flex gap-6 text-caption-xs text-tertiary">
        <span>Basis: {formatMinutes(baseMinutes)}</span>
        {rolledOver > 0 && <span className="text-emerald-400">+{formatMinutes(rolledOver)} Übertrag</span>}
        <span>Verbraucht: {formatMinutes(consumed)}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

export default CareOverviewCustomerPage;
