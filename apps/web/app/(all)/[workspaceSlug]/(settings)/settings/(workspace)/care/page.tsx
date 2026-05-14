import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { useTranslation } from "@plane/i18n";
import { Button, Input, ToggleSwitch } from "@plane/ui";
import { useCare } from "@/hooks/store/use-care";
import { useUserPermissions } from "@/hooks/store/user";

const CareSettingsPage = observer(function CareSettingsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { t } = useTranslation();
  const care = useCare();
  const { getWorkspaceRoleByWorkspaceSlug } = useUserPermissions();

  const [monthlyHours, setMonthlyHours] = useState("");
  const [packageLabel, setPackageLabel] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const userRole = getWorkspaceRoleByWorkspaceSlug(workspaceSlug || "");
  const isAdmin = userRole === 20;

  useEffect(() => {
    if (workspaceSlug) {
      care.fetchSubscription(workspaceSlug);
      care.fetchCurrentBalance(workspaceSlug);
      care.fetchBalanceHistory(workspaceSlug, 12);
    }
  }, [workspaceSlug, care]);

  useEffect(() => {
    if (care.subscription) {
      setMonthlyHours(String(care.subscription.monthly_hours));
      setPackageLabel(care.subscription.package_label);
      setStartedAt(care.subscription.started_at);
      setIsActive(care.subscription.is_active);
    }
  }, [care.subscription]);

  const handleSave = async () => {
    if (!workspaceSlug) return;
    setIsSaving(true);
    try {
      await care.updateSubscription(workspaceSlug, {
        monthly_hours: parseFloat(monthlyHours) || 8,
        package_label: packageLabel,
        started_at: startedAt,
        is_active: isActive,
      });
      await care.fetchCurrentBalance(workspaceSlug);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-tertiary">{t("dbwcare.managed_by_team")}</p>
      </div>
    );
  }

  const balance = care.currentBalance;

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-6">
      <div className="max-w-2xl space-y-8">
        {/* Subscription config */}
        <section>
          <h4 className="text-lg font-medium">{t("dbwcare.care_settings")}</h4>

          <div className="mt-4 space-y-4">
            {/* Monthly hours */}
            <div>
              <label className="text-body-sm-medium">{t("dbwcare.monthly_hours")}</label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="care-monthly-hours"
                  name="monthly_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={monthlyHours}
                  onChange={(e) => setMonthlyHours(e.target.value)}
                  className="w-24"
                />
                <span className="text-body-sm-regular text-tertiary">h / {t("dbwcare.recurrence_monthly").toLowerCase()}</span>
              </div>
              {/* Quick select */}
              <div className="mt-2 flex gap-2">
                {[4, 8, 16].map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="rounded-sm border border-subtle px-2.5 py-1 text-body-xs-regular hover:bg-layer-transparent-hover"
                    onClick={() => {
                      setMonthlyHours(String(h));
                      setPackageLabel(h === 4 ? "S" : h === 8 ? "M" : "L");
                    }}
                  >
                    {h}h ({h === 4 ? "S" : h === 8 ? "M" : "L"})
                  </button>
                ))}
              </div>
            </div>

            {/* Package label */}
            <div>
              <label className="text-body-sm-medium">{t("dbwcare.package_label")}</label>
              <Input
                id="care-package-label"
                name="package_label"
                placeholder="S / M / L / Custom"
                value={packageLabel}
                onChange={(e) => setPackageLabel(e.target.value)}
                className="mt-1 w-48"
              />
            </div>

            {/* Contract start */}
            <div>
              <label className="text-body-sm-medium">{t("dbwcare.contract_start")}</label>
              <Input
                id="care-started-at"
                name="started_at"
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="mt-1 w-48"
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <ToggleSwitch value={isActive} onChange={() => setIsActive(!isActive)} />
              <span className="text-body-sm-regular">{t("dbwcare.subscription_active")}</span>
            </div>

            <Button variant="primary" size="sm" onClick={handleSave} loading={isSaving}>
              {t("common.save")}
            </Button>
          </div>
        </section>

        {/* Current balance */}
        {balance && (
          <section>
            <h4 className="text-lg font-medium">{t("dbwcare.care_status")}</h4>
            <div className="mt-4 rounded-lg border border-subtle p-4">
              <div className="grid grid-cols-2 gap-4 text-body-sm-regular">
                <div>
                  <span className="text-tertiary">{t("dbwcare.base_quota")}</span>
                  <div className="font-medium">{balance.base_hours}h ({balance.base_minutes}min)</div>
                </div>
                {balance.rolled_over_minutes > 0 && (
                  <div>
                    <span className="text-tertiary">{t("dbwcare.rolled_over")}</span>
                    <div className="font-medium">+{balance.rolled_over_minutes}min</div>
                  </div>
                )}
                <div>
                  <span className="text-tertiary">{t("dbwcare.total_available")}</span>
                  <div className="font-medium">{balance.total_available_minutes}min</div>
                </div>
                <div>
                  <span className="text-tertiary">{t("dbwcare.consumed")}</span>
                  <div className="font-medium">{balance.consumed_minutes}min ({balance.consumption_percentage}%)</div>
                </div>
                <div>
                  <span className="text-tertiary">{t("dbwcare.remaining")}</span>
                  <div className="font-medium">{balance.remaining_minutes}min</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-layer-3">
                  <div
                    className="h-full rounded-full bg-primary-500 transition-all duration-500"
                    style={{ width: `${Math.min(balance.consumption_percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Balance history */}
        {care.balanceHistory.length > 0 && (
          <section>
            <h4 className="text-lg font-medium">Verlauf (12 Monate)</h4>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-body-sm-regular">
                <thead>
                  <tr className="border-b border-subtle text-left text-tertiary">
                    <th className="py-2 pr-4">Monat</th>
                    <th className="py-2 pr-4">{t("dbwcare.base_quota")}</th>
                    <th className="py-2 pr-4">{t("dbwcare.rolled_over")}</th>
                    <th className="py-2 pr-4">{t("dbwcare.consumed")}</th>
                    <th className="py-2 pr-4">{t("dbwcare.remaining")}</th>
                  </tr>
                </thead>
                <tbody>
                  {care.balanceHistory.map((b) => (
                    <tr key={b.id} className="border-b border-subtle">
                      <td className="py-2 pr-4 font-medium">{b.year}-{String(b.month).padStart(2, "0")}</td>
                      <td className="py-2 pr-4">{b.base_hours}h</td>
                      <td className="py-2 pr-4">{b.rolled_over_minutes > 0 ? `+${b.rolled_over_minutes}min` : "-"}</td>
                      <td className="py-2 pr-4">{b.consumed_minutes}min</td>
                      <td className="py-2 pr-4">{b.remaining_minutes}min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
});

export default CareSettingsPage;
