import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { useTranslation } from "@plane/i18n";
import { Send } from "lucide-react";
import { Button, Input, ToggleSwitch } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useCare } from "@/hooks/store/use-care";
import { useUserPermissions } from "@/hooks/store/user";
import careService from "@/plane-web/services/care.service";

const ProjectCareSettingsPage = observer(function ProjectCareSettingsPage() {
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const { t } = useTranslation();
  const care = useCare();
  const { getWorkspaceRoleByWorkspaceSlug } = useUserPermissions();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [monthlyHours, setMonthlyHours] = useState("");
  const [packageLabel, setPackageLabel] = useState("");
  const [startedAt, setStartedAt] = useState(todayStr);
  const [isActive, setIsActive] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [reportEnabled, setReportEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportMonth, setReportMonth] = useState("");

  const userRole = getWorkspaceRoleByWorkspaceSlug(workspaceSlug || "");
  const isAdmin = userRole === 20;

  useEffect(() => {
    if (workspaceSlug && projectId) {
      care.fetchSubscription(workspaceSlug, projectId);
      care.fetchCurrentBalance(workspaceSlug, projectId);
      care.fetchBalanceHistory(workspaceSlug, projectId, 12);
    }
  }, [workspaceSlug, projectId, care]);

  const subscription = projectId ? care.getSubscription(projectId) : null;

  useEffect(() => {
    if (subscription) {
      setMonthlyHours(String(subscription.monthly_hours));
      setPackageLabel(subscription.package_label);
      setStartedAt(subscription.started_at);
      setIsActive(subscription.is_active);
      setCustomerName(subscription.customer_name || "");
      setCustomerEmail(subscription.customer_email || "");
      setReportEnabled(subscription.report_enabled ?? true);
    }
  }, [subscription]);

  const handleSave = async () => {
    if (!workspaceSlug || !projectId) return;
    setIsSaving(true);
    try {
      await care.updateSubscription(workspaceSlug, projectId, {
        monthly_hours: parseFloat(monthlyHours) || 8,
        package_label: packageLabel,
        started_at: startedAt || new Date().toISOString().slice(0, 10),
        is_active: isActive,
        customer_name: customerName,
        customer_email: customerEmail,
        report_enabled: reportEnabled,
      });
      await care.fetchCurrentBalance(workspaceSlug, projectId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("dbwcare.save_success"),
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("dbwcare.save_error"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendReport = async () => {
    if (!workspaceSlug || !projectId) return;
    setIsSendingReport(true);
    try {
      const payload: { year?: number; month?: number } = {};
      if (reportMonth) {
        const [y, m] = reportMonth.split("-").map(Number);
        payload.year = y;
        payload.month = m;
      }
      const result = await careService.sendReport(workspaceSlug, projectId, payload);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("dbwcare.report_sent_success"),
        message: result.message,
      });
    } catch (err: any) {
      const errorMsg = err?.data?.error || err?.message || t("dbwcare.report_sent_error");
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("dbwcare.report_sent_error"),
        message: errorMsg,
      });
    } finally {
      setIsSendingReport(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-tertiary">{t("dbwcare.managed_by_team")}</p>
      </div>
    );
  }

  const balance = projectId ? care.getBalance(projectId) : null;
  const balanceHistory = projectId ? care.getBalanceHistory(projectId) : [];

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
                <span className="text-body-sm-regular text-tertiary">
                  h / {t("dbwcare.recurrence_monthly").toLowerCase()}
                </span>
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
              {t("save")}
            </Button>
          </div>
        </section>

        {/* Customer & Report Settings */}
        <section>
          <h4 className="text-lg font-medium">{t("dbwcare.report_settings")}</h4>
          <p className="mt-1 text-body-sm-regular text-tertiary">{t("dbwcare.report_settings_desc")}</p>

          <div className="mt-4 space-y-4">
            {/* Customer name */}
            <div>
              <label className="text-body-sm-medium">{t("dbwcare.customer_name")}</label>
              <Input
                id="care-customer-name"
                name="customer_name"
                placeholder={t("dbwcare.customer_name_placeholder")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 w-72"
              />
            </div>

            {/* Customer email */}
            <div>
              <label className="text-body-sm-medium">{t("dbwcare.customer_email")}</label>
              <Input
                id="care-customer-email"
                name="customer_email"
                type="email"
                placeholder="kunde@beispiel.de"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-1 w-72"
              />
            </div>

            {/* Report toggle */}
            <div className="flex items-center gap-3">
              <ToggleSwitch value={reportEnabled} onChange={() => setReportEnabled(!reportEnabled)} />
              <span className="text-body-sm-regular">{t("dbwcare.report_enabled")}</span>
            </div>

            {!customerEmail && reportEnabled && (
              <p className="text-body-xs-regular text-amber-500">{t("dbwcare.report_no_email_warning")}</p>
            )}

            <div className="flex items-center gap-3">
              <Button variant="primary" size="sm" onClick={handleSave} loading={isSaving}>
                {t("save")}
              </Button>

              {subscription && customerEmail && (
                <>
                  <select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="h-8 rounded-md border border-subtle bg-transparent px-2 text-body-xs-regular text-primary"
                  >
                    <option value="">{t("dbwcare.report_current_month")}</option>
                    {balanceHistory.map((b) => (
                      <option key={`${b.year}-${b.month}`} value={`${b.year}-${b.month}`}>
                        {b.year}-{String(b.month).padStart(2, "0")} ({b.consumed_minutes}min)
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={handleSendReport}
                    loading={isSendingReport}
                    prependIcon={<Send className="size-3.5" />}
                  >
                    {t("dbwcare.send_report_now")}
                  </Button>
                </>
              )}
            </div>
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
                  <div className="font-medium">
                    {balance.base_hours}h ({balance.base_minutes}min)
                  </div>
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
                  <div className="font-medium">
                    {balance.consumed_minutes}min ({balance.consumption_percentage}%)
                  </div>
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
                    className="bg-primary-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(balance.consumption_percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Balance history */}
        {balanceHistory.length > 0 && (
          <section>
            <h4 className="text-lg font-medium">{t("dbwcare.balance_history")}</h4>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-body-sm-regular">
                <thead>
                  <tr className="border-b border-subtle text-left text-tertiary">
                    <th className="py-2 pr-4">{t("dbwcare.month")}</th>
                    <th className="py-2 pr-4">{t("dbwcare.base_quota")}</th>
                    <th className="py-2 pr-4">{t("dbwcare.rolled_over")}</th>
                    <th className="py-2 pr-4">{t("dbwcare.consumed")}</th>
                    <th className="py-2 pr-4">{t("dbwcare.remaining")}</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceHistory.map((b) => (
                    <tr key={b.id} className="border-b border-subtle">
                      <td className="py-2 pr-4 font-medium">
                        {b.year}-{String(b.month).padStart(2, "0")}
                      </td>
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

export default ProjectCareSettingsPage;
