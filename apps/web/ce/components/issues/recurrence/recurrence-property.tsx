import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Repeat } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { ToggleSwitch } from "@plane/ui";
import type { IIssueRecurrence, IIssueRecurrenceFormData, TRecurrenceType } from "@plane/types";
import { useCare } from "@/hooks/store/use-care";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import careService from "@/plane-web/services/care.service";

type TIssueRecurrenceProperty = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export const IssueRecurrenceProperty = observer(function IssueRecurrenceProperty(props: TIssueRecurrenceProperty) {
  const { workspaceSlug, projectId, issueId, disabled } = props;
  const { t } = useTranslation();
  const care = useCare();

  const [recurrence, setRecurrence] = useState<IIssueRecurrence | null>(null);
  const [loading, setLoading] = useState(false);

  // Local form state
  const [enabled, setEnabled] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<TRecurrenceType>("monthly_date");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [intervalDays, setIntervalDays] = useState(30);
  const [estimatedHours, setEstimatedHours] = useState(0);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch subscription + recurrence on mount
  useEffect(() => {
    if (!workspaceSlug || !projectId || !issueId) return;
    care.fetchSubscription(workspaceSlug, projectId);
    setLoading(true);
    careService
      .getRecurrence(workspaceSlug, projectId, issueId)
      .then((data) => {
        setRecurrence(data);
        if (data) {
          setEnabled(true);
          setRecurrenceType(data.recurrence_type);
          setDayOfMonth(data.day_of_month ?? 1);
          setIntervalDays(data.interval_days ?? 30);
          setEstimatedHours(Math.floor(data.estimated_minutes / 60));
          setEstimatedMinutes(data.estimated_minutes % 60);
          setIsPaused(!data.is_active);
        }
        return data;
      })
      .catch(() => setRecurrence(null))
      .finally(() => setLoading(false));
  }, [workspaceSlug, projectId, issueId, care]);

  const buildPayload = useCallback(
    (overrides?: Partial<IIssueRecurrenceFormData>): IIssueRecurrenceFormData => ({
      recurrence_type: recurrenceType,
      day_of_month: recurrenceType === "monthly_date" ? dayOfMonth : null,
      interval_days: recurrenceType === "interval_days" ? intervalDays : null,
      estimated_minutes: estimatedHours * 60 + estimatedMinutes,
      is_active: !isPaused,
      ...overrides,
    }),
    [recurrenceType, dayOfMonth, intervalDays, estimatedHours, estimatedMinutes, isPaused]
  );

  const handleToggle = async (value: boolean) => {
    if (disabled) return;
    setEnabled(value);
    if (value) {
      // Create with defaults
      const payload = buildPayload({ is_active: true });
      try {
        const created = await careService.createRecurrence(workspaceSlug, projectId, issueId, payload);
        setRecurrence(created);
        setIsPaused(false);
      } catch {
        setEnabled(false);
      }
    } else {
      // Delete
      try {
        await careService.deleteRecurrence(workspaceSlug, projectId, issueId);
        setRecurrence(null);
      } catch {
        setEnabled(true);
      }
    }
  };

  const handleUpdate = async (overrides?: Partial<IIssueRecurrenceFormData>) => {
    if (disabled || !recurrence) return;
    const payload = buildPayload(overrides);
    try {
      const updated = await careService.updateRecurrence(workspaceSlug, projectId, issueId, payload);
      setRecurrence(updated);
    } catch {
      // silent
    }
  };

  const handleRecurrenceTypeChange = (type: TRecurrenceType) => {
    setRecurrenceType(type);
    handleUpdate({
      recurrence_type: type,
      day_of_month: type === "monthly_date" ? dayOfMonth : null,
      interval_days: type === "interval_days" ? intervalDays : null,
    });
  };

  const handleDayOfMonthBlur = () => {
    handleUpdate({ day_of_month: dayOfMonth });
  };

  const handleIntervalDaysBlur = () => {
    handleUpdate({ interval_days: intervalDays });
  };

  const handleEstimatedDurationBlur = () => {
    handleUpdate({ estimated_minutes: estimatedHours * 60 + estimatedMinutes });
  };

  const handlePauseToggle = (value: boolean) => {
    setIsPaused(value);
    handleUpdate({ is_active: !value });
  };

  const subscription = care.getSubscription(projectId);
  // Don't hide until subscription is loaded (null = not yet fetched, undefined would mean no sub)
  if (subscription !== null && !subscription?.is_active) return null;

  return (
    <SidebarPropertyListItem icon={Repeat} label={t("dbwcare.recurrence")}>
      <div className="flex w-full flex-col gap-2">
        {/* Main toggle */}
        <div className="flex items-center justify-between">
          <span className="text-body-xs-regular text-tertiary">{t("dbwcare.recurrence")}</span>
          <ToggleSwitch value={enabled} onChange={handleToggle} disabled={disabled || loading} size="sm" />
        </div>

        {enabled && recurrence && (
          <>
            {/* Recurrence type radio */}
            <div className="flex flex-col gap-1.5 pl-1">
              <label className="flex cursor-pointer items-center gap-2 text-body-xs-regular">
                <input
                  type="radio"
                  name={`recurrence-type-${issueId}`}
                  checked={recurrenceType === "monthly_date"}
                  onChange={() => handleRecurrenceTypeChange("monthly_date")}
                  disabled={disabled}
                  className="size-3.5"
                />
                <span>{t("dbwcare.recurrence_monthly")}</span>
                {recurrenceType === "monthly_date" && (
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
                    onBlur={handleDayOfMonthBlur}
                    disabled={disabled}
                    className="border-subtle-2 h-6 w-12 rounded border bg-transparent px-1.5 text-center text-body-xs-regular text-primary"
                  />
                )}
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-body-xs-regular">
                <input
                  type="radio"
                  name={`recurrence-type-${issueId}`}
                  checked={recurrenceType === "interval_days"}
                  onChange={() => handleRecurrenceTypeChange("interval_days")}
                  disabled={disabled}
                  className="size-3.5"
                />
                <span>{t("dbwcare.recurrence_interval")}</span>
                {recurrenceType === "interval_days" && (
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Math.min(365, Math.max(1, Number(e.target.value))))}
                    onBlur={handleIntervalDaysBlur}
                    disabled={disabled}
                    className="border-subtle-2 h-6 w-14 rounded border bg-transparent px-1.5 text-center text-body-xs-regular text-primary"
                  />
                )}
              </label>
            </div>

            {/* Estimated duration */}
            <div className="flex items-center gap-2 pl-1">
              <span className="text-body-xs-regular text-tertiary">{t("dbwcare.estimated_duration")}:</span>
              <input
                type="number"
                min={0}
                max={23}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Math.min(23, Math.max(0, Number(e.target.value))))}
                onBlur={handleEstimatedDurationBlur}
                disabled={disabled}
                className="border-subtle-2 h-6 w-10 rounded border bg-transparent px-1 text-center text-body-xs-regular text-primary"
              />
              <span className="text-body-xs-regular text-tertiary">h</span>
              <input
                type="number"
                min={0}
                max={59}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                onBlur={handleEstimatedDurationBlur}
                disabled={disabled}
                className="border-subtle-2 h-6 w-10 rounded border bg-transparent px-1 text-center text-body-xs-regular text-primary"
              />
              <span className="text-body-xs-regular text-tertiary">min</span>
            </div>

            {/* Next occurrence (read-only) */}
            {recurrence.next_occurrence_at && (
              <div className="flex items-center gap-2 pl-1">
                <span className="text-body-xs-regular text-tertiary">{t("dbwcare.next_occurrence")}:</span>
                <span className="text-body-xs-regular text-primary">{formatDate(recurrence.next_occurrence_at)}</span>
              </div>
            )}

            {/* Pause toggle */}
            <div className="flex items-center justify-between pl-1">
              <span className="text-body-xs-regular text-tertiary">{t("dbwcare.pause_recurrence")}</span>
              <ToggleSwitch value={isPaused} onChange={handlePauseToggle} disabled={disabled} size="sm" />
            </div>
          </>
        )}
      </div>
    </SidebarPropertyListItem>
  );
});
